import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
   CONFIG
========================================================= */

const bodyConfig = document.body.dataset || {};

function canonicalTerritoryId(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  if (!raw) return "vila-pinto";
  if (raw === "crgr-vila-pinto") return "vila-pinto";
  if (raw === "crgr-cooadesc") return "cooadesc";
  if (raw === "crgr-coadesc") return "cooadesc";
  if (raw === "coadesc") return "cooadesc";
  if (raw === "crgr-padre-cacique") return "padre-cacique";

  return raw;
}

const PAGE_TERRITORY = {
  territoryId: canonicalTerritoryId(bodyConfig.territoryId || "vila-pinto"),
  territoryLabel: bodyConfig.territoryLabel || "Centro de Triagem Vila Pinto",
  cooperativeName: bodyConfig.cooperativeName || "Vila Pinto",
  participantUrl: bodyConfig.participantUrl || "cadastro-participantes-vila-pinto.html",
  participantsListUrl: bodyConfig.participantsListUrl || "usuarios-vila-pinto.html",
  coletasUrl: bodyConfig.coletasUrl || "cadastro-coletas-vila-pinto.html"
};

/* =========================================================
   ELEMENTOS
========================================================= */

const els = {
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  logoutLink: document.getElementById("logoutLink"),

  userNameTop: document.getElementById("userNameTop"),
  accessBanner: document.getElementById("accessBanner"),
  sidebarHelpText: document.getElementById("sidebarHelpText"),

  syncCoopDashboardBtn: document.getElementById("syncCoopDashboardBtn"),
  syncCoopDashboardStatus: document.getElementById("syncCoopDashboardStatus"),

  indicatorParticipants: document.getElementById("indicatorParticipants"),
  indicatorColetas: document.getElementById("indicatorColetas"),
  indicatorActions: document.getElementById("indicatorActions"),

  indicatorPesoRecebido: document.getElementById("indicatorPesoRecebido"),
  indicatorRejeito: document.getElementById("indicatorRejeito"),
  indicatorNaoComercializado: document.getElementById("indicatorNaoComercializado"),
  indicatorQualidadeMedia: document.getElementById("indicatorQualidadeMedia"),

  participantsTotalCount: document.getElementById("participantsTotalCount"),
  participantsPeopleCount: document.getElementById("participantsPeopleCount"),
  participantsCondoCount: document.getElementById("participantsCondoCount"),

  noticesList: document.getElementById("noticesList"),
  territoryCommunications: document.getElementById("territoryCommunications"),

  chartColetasMensais: document.getElementById("chartColetasMensais"),
  chartParticipantesPerfil: document.getElementById("chartParticipantesPerfil"),

  recentColetasTableBody: document.getElementById("recentColetasTableBody"),
  exportParticipantsPdfBtn: document.getElementById("exportParticipantsPdfBtn")
};

/* =========================================================
   STATE
========================================================= */

const STATE = {
  currentUser: null,
  profile: null,
  isAdmin: false,
  canEditAll: false,
  participants: [],
  coletas: [],
  approvalRequests: [],
  unsubscribers: []
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? "");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatKg(value) {
  return `${formatNumber(Math.round(Number(value || 0)))} kg`;
}

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "recebimento") return "Recebimento";
  if (normalized === "final_turno") return "Final do turno";
  if (normalized.includes("final")) return "Final do turno";

  return value && value !== "-" ? value : "Recebimento";
}

function animateNumber(el, value, suffix = "") {
  if (!el) return;

  const target = Number(value || 0);
  const current = Number(String(el.textContent || "0").replace(/[^\d.-]/g, "")) || 0;
  const duration = 450;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const next = Math.round(current + (target - current) * progress);

    el.textContent = next.toLocaleString("pt-BR") + suffix;

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function isAdminUser(role) {
  return role === "admin";
}

function isGovernancaUser(role) {
  return role === "governanca" || role === "gestor";
}

function isApprovedParticipant(item) {
  const status = normalizeText(item.approvalStatus || item.status || item.decision);

  return (
    status === "approved" ||
    status === "aprovado" ||
    status === "active" ||
    status === "ativo" ||
    item.active === true
  );
}

function isColetaRealizada(item) {
  const status = normalizeText(
    item.status ||
    item.situacao ||
    item.decision ||
    item.approvalStatus ||
    item.coletaStatus ||
    "realizada"
  );

  return ![
    "cancelada",
    "cancelado",
    "rejected",
    "rejeitada",
    "rejeitado",
    "pendente",
    "pending",
    "rascunho",
    "draft"
  ].includes(status);
}

function participantType(item) {
  return normalizeText(
    item.participantType ||
    item.tipoParticipante ||
    item.tipo ||
    item.localType ||
    item.codeLocalType
  );
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(
    String(value)
      .trim()
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function getParticipantCode(item = {}) {
  return String(
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.code ||
    item.payloadSnapshot?.participantCode ||
    item.payloadSnapshot?.codigoParticipante ||
    ""
  ).trim();
}

function getParticipantName(item = {}) {
  const code = getParticipantCode(item);

  return (
    item.participantName ||
    item.nomeParticipante ||
    item.nome ||
    item.name ||
    item.payloadSnapshot?.participantName ||
    item.payloadSnapshot?.name ||
    code ||
    "-"
  );
}

function getTipoRecebimento(item = {}) {
  return (
    item.flowType ||
    item.fluxo ||
    item.tipoColeta ||
    item.tipoRecebimento ||
    item.receiptType ||
    item.tipo ||
    item.recebimento?.flowType ||
    item.finalTurno?.flowType ||
    item.localType ||
    item.codeLocalType ||
    item.payloadSnapshot?.flowType ||
    item.payloadSnapshot?.tipoRecebimento ||
    item.payloadSnapshot?.localType ||
    "recebimento"
  );
}

function getPossibleTerritoryValues(profile) {
  const canonical = canonicalTerritoryId(profile?.territoryId || PAGE_TERRITORY.territoryId);

  if (canonical === "vila-pinto") return ["vila-pinto", "crgr_vila_pinto", "crgr-vila-pinto"];

  if (canonical === "cooadesc") {
    return ["cooadesc", "coadesc", "crgr_cooadesc", "crgr_coadesc", "crgr-cooadesc", "crgr-coadesc"];
  }

  if (canonical === "padre-cacique") return ["padre-cacique", "crgr_padre_cacique", "crgr-padre-cacique"];

  return [canonical];
}

function itemBelongsToTerritory(item, profile) {
  if (isGovernancaUser(profile.role)) return true;

  const possible = getPossibleTerritoryValues(profile).map(canonicalTerritoryId);

  const fields = [
    item.territoryId,
    item.territory,
    item.territorio,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeCode,
    item.cooperativaCode,
    item.cooperativeName,
    item.cooperativa,
    item.localCrgr,
    item.crgrId,
    item.payloadSnapshot?.territoryId,
    item.payloadSnapshot?.territory,
    item.payloadSnapshot?.cooperativeId,
    item.payloadSnapshot?.cooperativaId,
    item.payloadSnapshot?.localCrgr
  ]
    .filter(Boolean)
    .map(canonicalTerritoryId);

  if (fields.some((field) => possible.includes(field))) return true;

  const participantCode = getParticipantCode(item).toUpperCase();

  if (PAGE_TERRITORY.territoryId === "vila-pinto") return participantCode.startsWith("VPD");
  if (PAGE_TERRITORY.territoryId === "cooadesc") return participantCode.startsWith("COA") || participantCode.startsWith("COO");
  if (PAGE_TERRITORY.territoryId === "padre-cacique") return participantCode.startsWith("PC");

  return false;
}

/* =========================================================
   EXTRAÇÃO DE VALORES DAS COLETAS
========================================================= */

function deepSumNumbers(obj) {
  if (!obj || typeof obj !== "object") return 0;

  return Object.values(obj).reduce((acc, value) => {
    if (typeof value === "object" && value !== null) return acc + deepSumNumbers(value);
    return acc + toNumber(value);
  }, 0);
}

function deepFindNumber(obj, keyMatchers = []) {
  if (!obj || typeof obj !== "object") return 0;

  let total = 0;

  Object.entries(obj).forEach(([key, value]) => {
    const normalizedKey = normalizeText(key).replaceAll(" ", "");

    const matched = keyMatchers.some((matcher) => normalizedKey.includes(matcher));

    if (matched) {
      total += typeof value === "object" && value !== null ? deepSumNumbers(value) : toNumber(value);
      return;
    }

    if (typeof value === "object" && value !== null) {
      total += deepFindNumber(value, keyMatchers);
    }
  });

  return total;
}

function getPesoRecebido(coleta = {}) {
  const direct =
    toNumber(coleta.pesoRecebido) ||
    toNumber(coleta.peso_recebido) ||
    toNumber(coleta.totalPesoRecebido) ||
    toNumber(coleta.totalRecebido) ||
    toNumber(coleta.totalKg) ||
    toNumber(coleta.pesoTotal) ||
    toNumber(coleta.peso) ||
    toNumber(coleta.kg) ||
    toNumber(coleta.recebimento?.pesoResiduoSecoKg) ||
    toNumber(coleta.finalTurno?.pesoResiduoSecoKg) ||
    toNumber(coleta.payloadSnapshot?.pesoRecebido) ||
    toNumber(coleta.payloadSnapshot?.totalKg);

  if (direct) return Math.round(direct);

  return Math.round(
    deepFindNumber(coleta, [
      "pesorecebido",
      "recebido",
      "totalkg",
      "pesototal",
      "pesoresiduosecokg"
    ]) || 0
  );
}

function getRejeito(coleta = {}) {
  const direct =
    toNumber(coleta.rejeito) ||
    toNumber(coleta.pesoRejeito) ||
    toNumber(coleta.totalRejeito) ||
    toNumber(coleta.rejeitos) ||
    toNumber(coleta.recebimento?.pesoRejeitoKg) ||
    toNumber(coleta.finalTurno?.pesoRejeitoKg) ||
    toNumber(coleta.payloadSnapshot?.rejeito) ||
    toNumber(coleta.payloadSnapshot?.pesoRejeito);

  if (direct) return Math.round(direct);

  return Math.round(
    deepFindNumber(coleta, [
      "rejeito",
      "rejeitos",
      "pesorejeito"
    ]) || 0
  );
}

function getNaoComercializado(coleta = {}) {
  const direct =
    toNumber(coleta.naoComercializado) ||
    toNumber(coleta.nao_comercializado) ||
    toNumber(coleta.totalNaoComercializado) ||
    toNumber(coleta.materialNaoComercializado) ||
    toNumber(coleta.naoVenda) ||
    toNumber(coleta.semComercializacao) ||
    toNumber(coleta.recebimento?.pesoNaoComercializadoKg) ||
    toNumber(coleta.finalTurno?.pesoNaoComercializadoKg) ||
    toNumber(coleta.payloadSnapshot?.naoComercializado) ||
    toNumber(coleta.payloadSnapshot?.totalNaoComercializado);

  if (direct) return Math.round(direct);

  return Math.round(
    deepFindNumber(coleta, [
      "naocomercializado",
      "semcomercializacao",
      "naovenda"
    ]) || 0
  );
}

function getQualidade(coleta = {}) {
  return (
    toNumber(coleta.qualidade) ||
    toNumber(coleta.notaQualidade) ||
    toNumber(coleta.qualityScore) ||
    toNumber(coleta.recebimento?.qualidadeNota) ||
    toNumber(coleta.finalTurno?.qualidadeNota) ||
    toNumber(coleta.payloadSnapshot?.qualidade) ||
    0
  );
}

function getDateValue(item = {}) {
  const possible =
    item.dataColeta ||
    item.coletaData ||
    item.dateColeta ||
    item.opDate ||
    item.data ||
    item.date ||
    item.createdAt ||
    item.createdAtISO ||
    item.updatedAt ||
    item.payloadSnapshot?.dataColeta ||
    item.payloadSnapshot?.data ||
    null;

  if (!possible) return null;
  if (typeof possible?.toDate === "function") return possible.toDate();
  if (possible instanceof Date) return possible;

  if (typeof possible === "string") {
    const iso = new Date(possible);
    if (!Number.isNaN(iso.getTime())) return iso;

    const br = possible.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`);
  }

  return null;
}

function formatDateLabel(item = {}) {
  const date = getDateValue(item);
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR");
}

function getColetaStatusLabel(item = {}) {
  const raw =
    item.status ||
    item.situacao ||
    item.decision ||
    item.approvalStatus ||
    item.coletaStatus ||
    "Realizada";

  const normalized = normalizeText(raw);

  if (normalized === "approved" || normalized === "aprovado") return "Realizada";
  if (normalized === "active" || normalized === "ativo") return "Realizada";
  if (normalized === "pending") return "Pendente";
  if (normalized === "rejected") return "Rejeitada";

  return String(raw || "Realizada");
}

/* =========================================================
   AUTH
========================================================= */

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) throw new Error("Usuário não encontrado.");

  const data = {
    id: snap.id,
    ...snap.data()
  };

  if (data.territoryId) data.territoryId = canonicalTerritoryId(data.territoryId);

  return data;
}

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil de usuário inválido.");
  if (profile.status !== "active") throw new Error("Usuário sem acesso ativo.");

  const acceptedRoles = ["admin", "cooperativa", "user", "usuario", "governanca", "gestor"];

  if (!acceptedRoles.includes(profile.role)) {
    throw new Error("Acesso permitido apenas para perfis autorizados.");
  }

  if (!isGovernancaUser(profile.role) && !profile.territoryId) {
    profile.territoryId = PAGE_TERRITORY.territoryId;
  }
}

/* =========================================================
   UI
========================================================= */

function setupSidebar() {
  function openSidebar() {
    els.sidebar?.classList.add("open");
    els.mobileOverlay?.classList.add("show");
    document.body.classList.add("menu-open");
  }

  function closeSidebar() {
    els.sidebar?.classList.remove("open");
    els.mobileOverlay?.classList.remove("show");
    document.body.classList.remove("menu-open");
  }

  els.menuBtn?.addEventListener("click", openSidebar);
  els.mobileOverlay?.addEventListener("click", closeSidebar);

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1180) closeSidebar();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) closeSidebar();
  });
}

function setupLogout() {
  els.logoutLink?.addEventListener("click", async (event) => {
    event.preventDefault();

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      window.location.href = "index.html";
    }
  });
}

function setupTopbarShadow() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  window.addEventListener("scroll", () => {
    topbar.style.boxShadow =
      window.scrollY > 8
        ? "0 10px 28px rgba(15,23,42,.08)"
        : "0 6px 20px rgba(15,23,42,.04)";
  });
}

function fillHeader(profile) {
  const isGovernanca = isGovernancaUser(profile.role);
  const isAdmin = isAdminUser(profile.role);

  const name =
    profile.displayName ||
    profile.name ||
    profile.nome ||
    (isAdmin ? "Administrador VP" : "Usuário");

  if (els.userNameTop) els.userNameTop.textContent = name;

  if (els.accessBanner) {
    if (isGovernanca) {
      els.accessBanner.className = "access-banner show admin";
      els.accessBanner.innerHTML =
        `<strong>Acesso de governança ativo.</strong> Visualização geral dos indicadores do sistema.`;
    } else if (isAdmin) {
      els.accessBanner.className = "access-banner show cooperativa";
      els.accessBanner.innerHTML =
        `<strong>Acesso administrativo ativo.</strong> Indicadores da cooperativa ${PAGE_TERRITORY.cooperativeName}.`;
    } else {
      els.accessBanner.className = "access-banner show cooperativa";
      els.accessBanner.innerHTML =
        `<strong>Acesso da cooperativa ativo.</strong> Indicadores vinculados ao seu território.`;
    }
  }

  if (els.sidebarHelpText) {
    els.sidebarHelpText.textContent =
      "Dashboard da cooperativa com dados operacionais, participantes e coletas.";
  }

  document.querySelectorAll(`a[href="cadastro-coletas-vila-pinto.html"]`).forEach((a) => {
    a.href = PAGE_TERRITORY.coletasUrl;
  });

  document.querySelectorAll(`a[href="usuarios-vila-pinto.html"]`).forEach((a) => {
    a.href = PAGE_TERRITORY.participantsListUrl;
  });

  document.querySelectorAll(`a[href="cadastro-participantes-vila-pinto.html"]`).forEach((a) => {
    a.href = PAGE_TERRITORY.participantUrl;
  });
}

function renderInfoList(container, items) {
  if (!container) return;

  container.innerHTML = items
    .map((item) => {
      return `
        <article class="info-item">
          <div class="info-copy">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.description)}</span>
          </div>
          ${item.meta ? `<span class="info-meta">${escapeHtml(item.meta)}</span>` : ""}
        </article>
      `;
    })
    .join("");
}

function fillStaticPanels() {
  renderInfoList(els.noticesList, [
    {
      title: "Indicadores atualizados",
      description: "Os dados do painel são sincronizados com os registros da cooperativa.",
      meta: "Sistema"
    },
    {
      title: "Acompanhamento operacional",
      description: "Use o dashboard para acompanhar participantes, coletas e ações pendentes.",
      meta: "Painel"
    }
  ]);

  renderInfoList(els.territoryCommunications, [
    {
      title: "Resumo da cooperativa",
      description: "Painel inicial otimizado para leitura rápida dos principais números.",
      meta: "Dashboard"
    },
    {
      title: "Dados integrados",
      description: "Participantes, coletas e solicitações são carregados diretamente do Firebase.",
      meta: "Firebase"
    }
  ]);
}

function setCoopSyncStatus(text) {
  if (els.syncCoopDashboardStatus) els.syncCoopDashboardStatus.textContent = text;
}

/* =========================================================
   FIREBASE LISTENERS
========================================================= */

function clearUnsubscribers() {
  STATE.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (_) {}
  });

  STATE.unsubscribers = [];
}

function listenCollection(collectionName, profile, callback, options = {}) {
  const { clientFilter = true } = options;

  try {
    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data()
        }));

        if (clientFilter) {
          docs = docs.filter((item) => itemBelongsToTerritory(item, profile));
        }

        callback(docs);
      },
      (error) => {
        console.error(`[${collectionName}] Erro ao carregar dados:`, error);
        callback([]);
      }
    );

    STATE.unsubscribers.push(unsubscribe);
  } catch (error) {
    console.error(`[${collectionName}] Erro ao iniciar listener:`, error);
    callback([]);
  }
}

/* =========================================================
   KPIs
========================================================= */

function computeDashboardData() {
  const approvedParticipants = STATE.participants.filter(isApprovedParticipant);
  const coletasRealizadas = STATE.coletas.filter(isColetaRealizada);

  const peopleCount = approvedParticipants.filter((item) =>
    ["morador", "familia", "lideranca", "participante", "user", "usuario", "casa"].includes(participantType(item))
  ).length;

  const condoCount = approvedParticipants.filter((item) =>
    ["condominio", "condomínio"].includes(participantType(item))
  ).length;

  const actionsCount = STATE.approvalRequests.filter((item) => {
    const status = normalizeText(item.status || item.decision || item.approvalStatus);
    return status === "pending" || status === "pendente";
  }).length;

  const pesoRecebido = coletasRealizadas.reduce((acc, item) => acc + getPesoRecebido(item), 0);
  const rejeito = coletasRealizadas.reduce((acc, item) => acc + getRejeito(item), 0);
  const naoComercializado = coletasRealizadas.reduce((acc, item) => acc + getNaoComercializado(item), 0);

  const qualidadeItens = coletasRealizadas
    .map(getQualidade)
    .filter((value) => value > 0);

  const qualidadeMedia = qualidadeItens.length
    ? (qualidadeItens.reduce((acc, value) => acc + value, 0) / qualidadeItens.length).toFixed(1)
    : "0";

  return {
    participants: approvedParticipants.length,
    people: peopleCount,
    condos: condoCount,
    coletas: coletasRealizadas.length,
    actions: STATE.isAdmin || STATE.canEditAll ? actionsCount : 0,
    pesoRecebido,
    rejeito,
    naoComercializado,
    qualidadeMedia
  };
}

function updateKpis() {
  const data = computeDashboardData();

  animateNumber(els.indicatorParticipants, data.participants);
  animateNumber(els.indicatorColetas, data.coletas);
  animateNumber(els.indicatorActions, data.actions);

  animateNumber(els.participantsTotalCount, data.participants);
  animateNumber(els.participantsPeopleCount, data.people);
  animateNumber(els.participantsCondoCount, data.condos);

  setText(els.indicatorPesoRecebido, formatKg(data.pesoRecebido));
  setText(els.indicatorRejeito, formatKg(data.rejeito));
  setText(els.indicatorNaoComercializado, formatKg(data.naoComercializado));
  setText(els.indicatorQualidadeMedia, data.qualidadeMedia);

  renderRecentColetas();
  updateCharts(data);
}

/* =========================================================
   TABELA RECENTE
========================================================= */

function statusBadge(status) {
  const label = String(status || "Realizada");
  const normalized = normalizeText(label);

  let className = "status-badge";

  if (normalized.includes("pend")) className += " pendente";
  if (normalized.includes("cancel") || normalized.includes("reje")) className += " rejeitado";
  if (normalized.includes("real") || normalized.includes("aprov") || normalized.includes("ativ")) {
    className += " realizada";
  }

  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function renderRecentColetas() {
  if (!els.recentColetasTableBody) return;

  const recent = [...STATE.coletas]
    .filter(isColetaRealizada)
    .sort((a, b) => {
      const dateA = getDateValue(a)?.getTime() || 0;
      const dateB = getDateValue(b)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, 8);

  if (!recent.length) {
    els.recentColetasTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma coleta cadastrada.</td>
      </tr>
    `;
    return;
  }

  els.recentColetasTableBody.innerHTML = recent
    .map((item) => {
      const participantCode = getParticipantCode(item);
      const participantName = getParticipantName(item);
      const tipoRecebimento = formatFluxoLabel(getTipoRecebimento(item));

      return `
        <tr>
          <td>${escapeHtml(formatDateLabel(item))}</td>

          <td>${escapeHtml(participantName || "-")}</td>

          <td>${escapeHtml(participantCode || "-")}</td>

          <td>${escapeHtml(tipoRecebimento)}</td>

          <td>${statusBadge(getColetaStatusLabel(item))}</td>

          <td>
            <div class="details-metrics">
              <span><strong>Peso recebido:</strong> ${escapeHtml(formatKg(getPesoRecebido(item)))}</span>
              <span><strong>Rejeito:</strong> ${escapeHtml(formatKg(getRejeito(item)))}</span>
              <span><strong>Não comercializado:</strong> ${escapeHtml(formatKg(getNaoComercializado(item)))}</span>
            </div>
          </td>

          <td>
            <a class="table-action-link" href="${PAGE_TERRITORY.coletasUrl}">
              Abrir
            </a>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* =========================================================
   GRÁFICOS
========================================================= */

function updateCharts(data) {
  const bars = els.chartColetasMensais?.querySelectorAll(".fake-bars span");

  if (bars?.length) {
    const values = [
      data.coletas * 0.42,
      data.coletas * 0.58,
      data.coletas * 0.34,
      data.coletas * 0.72,
      data.coletas * 0.62,
      data.coletas * 0.86
    ];

    const max = Math.max(...values, 1);

    bars.forEach((bar, index) => {
      const height = Math.max(18, Math.round((values[index] / max) * 92));
      bar.style.height = `${height}%`;
    });
  }

  const donut = els.chartParticipantesPerfil?.querySelector(".fake-donut");

  if (donut) {
    const total = Math.max(data.participants, 1);
    const peoplePercent = Math.round((data.people / total) * 100);
    const condoPercent = Math.round((data.condos / total) * 100);
    const otherPercent = Math.max(0, 100 - peoplePercent - condoPercent);

    donut.style.background = `
      conic-gradient(
        #81B92A 0 ${peoplePercent}%,
        #53ACDE ${peoplePercent}% ${peoplePercent + condoPercent}%,
        #EF6B22 ${peoplePercent + condoPercent}% ${peoplePercent + condoPercent + otherPercent}%
      )
    `;
  }
}

/* =========================================================
   PERMISSÕES
========================================================= */

function applyPermissionRules(profile) {
  STATE.isAdmin = isAdminUser(profile.role);
  STATE.canEditAll = isGovernancaUser(profile.role);
}

function applyRoleVisibility(profile) {
  const canManageUsers = isAdminUser(profile.role) || isGovernancaUser(profile.role);

  const userLinks = [
    document.querySelector('a[href="usuario-cooperativa-vila-pinto.html"]'),
    document.querySelector('a[href="usuarios.html"]')
  ].filter(Boolean);

  userLinks.forEach((link) => {
    link.style.display = canManageUsers ? "" : "none";
  });

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !canManageUsers);
  });
}

/* =========================================================
   DASHBOARD DATA
========================================================= */

function listenDashboardData(profile) {
  clearUnsubscribers();

  listenCollection(
    "participants",
    profile,
    (items) => {
      STATE.participants = items.filter((item) => {
        const status = normalizeText(item.approvalStatus || item.status || item.decision);
        return status !== "rejected" && status !== "rejeitado";
      });

      updateKpis();
    }
  );

  listenCollection(
    "coletas",
    profile,
    (items) => {
      STATE.coletas = items.filter(isColetaRealizada);

      console.log("[Dashboard] Coletas encontradas:", items.length);
      console.log("[Dashboard] Coletas realizadas:", STATE.coletas.length);

      console.table(
        STATE.coletas.slice(0, 5).map((item) => ({
          id: item.id,
          data: formatDateLabel(item),
          codigo: getParticipantCode(item),
          participante: getParticipantName(item),
          tipo: formatFluxoLabel(getTipoRecebimento(item)),
          pesoRecebido: getPesoRecebido(item),
          rejeito: getRejeito(item),
          naoComercializado: getNaoComercializado(item)
        }))
      );

      updateKpis();
    }
  );

  listenCollection(
    "approvalRequests",
    profile,
    (items) => {
      STATE.approvalRequests = items.filter((item) => {
        const status = normalizeText(item.status || item.decision || item.approvalStatus);
        return status === "pending" || status === "pendente";
      });

      updateKpis();
    }
  );
}

/* =========================================================
   EXPORTAÇÃO / SINCRONIZAÇÃO
========================================================= */

function setupExportButton() {
  els.exportParticipantsPdfBtn?.addEventListener("click", () => {
    window.print();
  });
}

function setupSyncButton() {
  els.syncCoopDashboardBtn?.addEventListener("click", () => {
    setCoopSyncStatus(`Atualizado em ${new Date().toLocaleString("pt-BR")}`);
    updateKpis();
  });
}

/* =========================================================
   BOOT
========================================================= */

function boot() {
  setupSidebar();
  setupLogout();
  setupTopbarShadow();
  setupExportButton();
  setupSyncButton();
  fillStaticPanels();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      STATE.currentUser = user;

      const profile = await getUserProfile(user.uid);
      validateProfile(profile);

      STATE.profile = profile;

      applyPermissionRules(profile);
      fillHeader(profile);
      applyRoleVisibility(profile);
      listenDashboardData(profile);

      setCoopSyncStatus("Indicadores carregados em tempo real.");

      document.body.classList.add("dashboard-loaded");
    } catch (error) {
      console.error("Erro ao carregar painel da cooperativa:", error);
      alert(error.message || "Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();