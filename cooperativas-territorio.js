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

  recentColetasTableBody:
    document.getElementById("recentColetasTableBody") ||
    document.getElementById("latestColetasBody"),

  exportParticipantsPdfBtn: document.getElementById("exportParticipantsPdfBtn"),
  btnLoadMoreColetas: document.getElementById("btnLoadMoreColetas")
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
  unsubscribers: [],
  recentLimit: 10
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

/* =========================================================
   TERRITÓRIO
========================================================= */

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

function itemBelongsToTerritory(item = {}) {
  const code = getParticipantCode(item).toUpperCase();

  const fields = [
    item.territoryId,
    item.territory,
    item.territorio,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeName,
    item.cooperativa,
    item.localCrgr,
    item.payloadSnapshot?.territoryId,
    item.payloadSnapshot?.territory,
    item.payloadSnapshot?.cooperativeId,
    item.payloadSnapshot?.cooperativaId,
    item.payloadSnapshot?.localCrgr
  ]
    .filter(Boolean)
    .map(canonicalTerritoryId);

  if (PAGE_TERRITORY.territoryId === "vila-pinto") {
    return (
      code.startsWith("VPD") ||
      code.startsWith("C") ||
      code === "FAMILIAS" ||
      fields.includes("vila-pinto")
    );
  }

  if (PAGE_TERRITORY.territoryId === "cooadesc") {
    return (
      code.startsWith("COA") ||
      code.startsWith("COO") ||
      fields.includes("cooadesc")
    );
  }

  if (PAGE_TERRITORY.territoryId === "padre-cacique") {
    return (
      code.startsWith("PC") ||
      fields.includes("padre-cacique")
    );
  }

  return false;
}

/* =========================================================
   PARTICIPANTES / STATUS
========================================================= */

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

function participantType(item = {}) {
  return normalizeText(
    item.participantType ||
    item.tipoParticipante ||
    item.tipo ||
    item.localType ||
    item.codeLocalType ||
    item.payloadSnapshot?.localType ||
    item.payloadSnapshot?.codeLocalType
  );
}

function isApprovedParticipant(item = {}) {
  const status = normalizeText(item.approvalStatus || item.status || item.decision);

  return (
    status === "approved" ||
    status === "aprovado" ||
    status === "active" ||
    status === "ativo" ||
    item.active === true
  );
}

function isPendingParticipant(item = {}) {
  const status = normalizeText(item.status || item.decision || item.approvalStatus);

  return (
    status === "pending" ||
    status === "pendente" ||
    status === "waiting" ||
    status === "aguardando"
  );
}

function isColetaRealizada(item = {}) {
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

/* =========================================================
   DATA / TIPO / STATUS COLETA
========================================================= */

function getDateValue(item = {}) {
  const possible =
    item.opDate ||
    item.dataOperacao ||
    item.operationDate ||
    item.dataColeta ||
    item.coletaData ||
    item.dateColeta ||
    item.createdAtISO ||
    item.updatedAtISO ||
    item.createdAt ||
    item.updatedAt ||
    item.date ||
    item.data ||
    item.payloadSnapshot?.opDate ||
    item.payloadSnapshot?.dataOperacao ||
    item.payloadSnapshot?.operationDate ||
    item.payloadSnapshot?.dataColeta ||
    item.payloadSnapshot?.createdAtISO ||
    item.payloadSnapshot?.data ||
    item.recebimento?.dataColeta ||
    item.finalTurno?.dataColeta ||
    null;

  if (!possible) return null;

  if (typeof possible?.toDate === "function") return possible.toDate();

  if (typeof possible?.seconds === "number") {
    return new Date(possible.seconds * 1000);
  }

  if (possible instanceof Date) return possible;

  if (typeof possible === "string") {
    const brDateTime = possible.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);

    if (brDateTime) {
      return new Date(
        Number(brDateTime[3]),
        Number(brDateTime[2]) - 1,
        Number(brDateTime[1]),
        Number(brDateTime[4] || 0),
        Number(brDateTime[5] || 0)
      );
    }

    const parsed = new Date(possible);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function formatDateLabel(item = {}) {
  const date = getDateValue(item);
  return date ? date.toLocaleDateString("pt-BR") : "-";
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

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "recebimento") return "Recebimento";
  if (normalized === "final_turno") return "Final do turno";
  if (normalized.includes("final")) return "Final do turno";

  return value && value !== "-" ? String(value) : "Recebimento";
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

/* =========================================================
   MATERIAIS / PESOS / QUALIDADE
========================================================= */

function getMateriaisObject(coleta = {}) {
  return (
    coleta.materiais ||
    coleta.materials ||
    coleta.materiaisInformados ||
    coleta.recebimento?.materiais ||
    coleta.recebimento?.materials ||
    coleta.finalTurno?.materiais ||
    coleta.finalTurno?.materials ||
    coleta.payloadSnapshot?.materiais ||
    coleta.payloadSnapshot?.materials ||
    coleta.payloadSnapshot?.materiaisInformados ||
    {}
  );
}

function getFinalTurnoMateriais(item = {}) {
  return {
    "Plástico":
      toNumber(item.plasticoKg) ||
      toNumber(item.plastico) ||
      toNumber(item.finalTurno?.plasticoKg) ||
      toNumber(item.finalTurno?.plastico) ||
      toNumber(item.payloadSnapshot?.plasticoKg) ||
      toNumber(item.payloadSnapshot?.plastico),

    "Vidro":
      toNumber(item.vidroKg) ||
      toNumber(item.vidro) ||
      toNumber(item.finalTurno?.vidroKg) ||
      toNumber(item.finalTurno?.vidro) ||
      toNumber(item.payloadSnapshot?.vidroKg) ||
      toNumber(item.payloadSnapshot?.vidro),

    "Sacaria":
      toNumber(item.sacariaKg) ||
      toNumber(item.sacaria) ||
      toNumber(item.finalTurno?.sacariaKg) ||
      toNumber(item.finalTurno?.sacaria) ||
      toNumber(item.payloadSnapshot?.sacariaKg) ||
      toNumber(item.payloadSnapshot?.sacaria),

    "Papel misto":
      toNumber(item.papelMistoKg) ||
      toNumber(item.papelMisto) ||
      toNumber(item.finalTurno?.papelMistoKg) ||
      toNumber(item.finalTurno?.papelMisto) ||
      toNumber(item.payloadSnapshot?.papelMistoKg) ||
      toNumber(item.payloadSnapshot?.papelMisto),

    "Papelão":
      toNumber(item.papelaoKg) ||
      toNumber(item.papelao) ||
      toNumber(item.finalTurno?.papelaoKg) ||
      toNumber(item.finalTurno?.papelao) ||
      toNumber(item.payloadSnapshot?.papelaoKg) ||
      toNumber(item.payloadSnapshot?.papelao),

    "Metal / Alumínio":
      toNumber(item.aluminioMetalKg) ||
      toNumber(item.metalKg) ||
      toNumber(item.aluminioKg) ||
      toNumber(item.finalTurno?.aluminioMetalKg) ||
      toNumber(item.finalTurno?.metalKg) ||
      toNumber(item.finalTurno?.aluminioKg) ||
      toNumber(item.payloadSnapshot?.aluminioMetalKg) ||
      toNumber(item.payloadSnapshot?.metalKg) ||
      toNumber(item.payloadSnapshot?.aluminioKg),

    "Isopor":
      toNumber(item.isoporKg) ||
      toNumber(item.isopor) ||
      toNumber(item.finalTurno?.isoporKg) ||
      toNumber(item.finalTurno?.isopor) ||
      toNumber(item.payloadSnapshot?.isoporKg) ||
      toNumber(item.payloadSnapshot?.isopor)
  };
}

function somaMateriais(coleta = {}) {
  const fixedMaterials = getFinalTurnoMateriais(coleta);

  const fixedTotal = Object.values(fixedMaterials).reduce((acc, value) => {
    return acc + toNumber(value);
  }, 0);

  if (fixedTotal > 0) return fixedTotal;

  const materiais = getMateriaisObject(coleta);

  if (Array.isArray(materiais)) {
    return materiais.reduce((acc, item) => {
      return acc + toNumber(item.peso || item.kg || item.valor || item.quantidade);
    }, 0);
  }

  if (typeof materiais === "object" && materiais !== null) {
    return Object.values(materiais).reduce((acc, value) => {
      if (typeof value === "object" && value !== null) {
        return acc + toNumber(value.peso || value.kg || value.valor || value.quantidade);
      }

      return acc + toNumber(value);
    }, 0);
  }

  return 0;
}

function getPesoRecebido(coleta = {}) {
  return (
    toNumber(coleta.pesoRecebido) ||
    toNumber(coleta.peso_recebido) ||
    toNumber(coleta.totalPesoRecebido) ||
    toNumber(coleta.totalRecebido) ||
    toNumber(coleta.totalRecebidoKg) ||
    toNumber(coleta.totalKg) ||
    toNumber(coleta.pesoTotal) ||
    toNumber(coleta.peso) ||
    toNumber(coleta.kg) ||
    toNumber(coleta.recebimento?.pesoResiduoSecoKg) ||
    toNumber(coleta.recebimento?.pesoRecebido) ||
    toNumber(coleta.recebimento?.totalKg) ||
    toNumber(coleta.finalTurno?.pesoResiduoSecoKg) ||
    toNumber(coleta.finalTurno?.pesoRecebido) ||
    toNumber(coleta.finalTurno?.totalKg) ||
    toNumber(coleta.payloadSnapshot?.pesoRecebido) ||
    toNumber(coleta.payloadSnapshot?.totalKg) ||
    toNumber(coleta.payloadSnapshot?.pesoResiduoSecoKg) ||
    somaMateriais(coleta) ||
    0
  );
}

function getRejeito(coleta = {}) {
  return (
    toNumber(coleta.rejeito) ||
    toNumber(coleta.pesoRejeito) ||
    toNumber(coleta.totalRejeito) ||
    toNumber(coleta.totalRejeitoKg) ||
    toNumber(coleta.rejeitoKg) ||
    toNumber(coleta.rejeitos) ||
    toNumber(coleta.recebimento?.pesoRejeitoKg) ||
    toNumber(coleta.recebimento?.rejeito) ||
    toNumber(coleta.finalTurno?.pesoRejeitoKg) ||
    toNumber(coleta.finalTurno?.rejeito) ||
    toNumber(coleta.payloadSnapshot?.rejeito) ||
    toNumber(coleta.payloadSnapshot?.pesoRejeito) ||
    toNumber(coleta.payloadSnapshot?.totalRejeito) ||
    0
  );
}

function getNaoComercializado(coleta = {}) {
  return (
    toNumber(coleta.naoComercializado) ||
    toNumber(coleta.nao_comercializado) ||
    toNumber(coleta.totalNaoComercializado) ||
    toNumber(coleta.totalNaoComercializadoKg) ||
    toNumber(coleta.naoComercializadoKg) ||
    toNumber(coleta.materialNaoComercializado) ||
    toNumber(coleta.naoVenda) ||
    toNumber(coleta.semComercializacao) ||
    toNumber(coleta.recebimento?.pesoNaoComercializadoKg) ||
    toNumber(coleta.recebimento?.naoComercializado) ||
    toNumber(coleta.finalTurno?.pesoNaoComercializadoKg) ||
    toNumber(coleta.finalTurno?.naoComercializado) ||
    toNumber(coleta.payloadSnapshot?.naoComercializado) ||
    toNumber(coleta.payloadSnapshot?.totalNaoComercializado) ||
    0
  );
}

function getQualidade(coleta = {}) {
  return (
    toNumber(coleta.qualidade) ||
    toNumber(coleta.notaQualidade) ||
    toNumber(coleta.qualityScore) ||
    toNumber(coleta.recebimento?.qualidade) ||
    toNumber(coleta.recebimento?.notaQualidade) ||
    toNumber(coleta.recebimento?.qualidadeNota) ||
    toNumber(coleta.finalTurno?.qualidade) ||
    toNumber(coleta.finalTurno?.notaQualidade) ||
    toNumber(coleta.finalTurno?.qualidadeNota) ||
    toNumber(coleta.payloadSnapshot?.qualidade) ||
    toNumber(coleta.payloadSnapshot?.notaQualidade) ||
    toNumber(coleta.payloadSnapshot?.qualidadeNota) ||
    0
  );
}

function renderMaterialsList(item = {}) {
  const fixedMaterials = getFinalTurnoMateriais(item);

  const fixedEntries = Object.entries(fixedMaterials)
    .filter(([, value]) => toNumber(value) > 0);

  if (fixedEntries.length) {
    return fixedEntries
      .map(([name, value]) => {
        return `
          <div class="material-line">
            <span>${escapeHtml(name)}</span>
            <strong>${escapeHtml(formatKg(value))}</strong>
          </div>
        `;
      })
      .join("");
  }

  const materiais = getMateriaisObject(item);
  let entries = [];

  if (Array.isArray(materiais)) {
    entries = materiais.map((mat) => [
      mat.nome || mat.material || mat.tipo || "Material",
      mat.peso || mat.kg || mat.valor || mat.quantidade || 0
    ]);
  } else if (typeof materiais === "object" && materiais !== null) {
    entries = Object.entries(materiais).map(([name, value]) => {
      if (typeof value === "object" && value !== null) {
        return [
          value.nome || value.material || name,
          value.peso || value.kg || value.valor || value.quantidade || 0
        ];
      }

      return [name, value];
    });
  }

  entries = entries.filter(([, value]) => toNumber(value) > 0);

  if (!entries.length) {
    return `<div class="empty-materials">Nenhum material informado.</div>`;
  }

  return entries
    .map(([name, value]) => {
      return `
        <div class="material-line">
          <span>${escapeHtml(name)}</span>
          <strong>${escapeHtml(formatKg(value))}</strong>
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   AUTH
========================================================= */

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    throw new Error("Usuário não encontrado.");
  }

  const data = {
    id: snap.id,
    ...snap.data()
  };

  if (data.territoryId) {
    data.territoryId = canonicalTerritoryId(data.territoryId);
  }

  return data;
}

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil de usuário inválido.");

  if (profile.status && profile.status !== "active") {
    throw new Error("Usuário sem acesso ativo.");
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
  const isAdmin = isAdminUser(profile.role);
  const isGovernanca = isGovernancaUser(profile.role);

  const name =
    profile.displayName ||
    profile.name ||
    profile.nome ||
    (isAdmin ? "Administrador VP" : "Usuário");

  if (els.userNameTop) {
    els.userNameTop.textContent = name;
  }

  if (els.accessBanner) {
    if (isGovernanca) {
      els.accessBanner.className = "access-banner show admin";
      els.accessBanner.innerHTML =
        `<strong>Acesso de governança ativo.</strong> Visualização geral dos indicadores do sistema.`;
    } else {
      els.accessBanner.className = "access-banner show cooperativa";
      els.accessBanner.innerHTML =
        `<strong>Acesso administrativo ativo.</strong> Indicadores vinculados à cooperativa ${PAGE_TERRITORY.cooperativeName}.`;
    }
  }

  if (els.sidebarHelpText) {
    els.sidebarHelpText.textContent =
      "Dashboard da cooperativa com dados operacionais, participantes e coletas.";
  }
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
  if (els.syncCoopDashboardStatus) {
    els.syncCoopDashboardStatus.textContent = text;
  }
}

/* =========================================================
   FIREBASE
========================================================= */

function clearUnsubscribers() {
  STATE.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (_) {}
  });

  STATE.unsubscribers = [];
}

function listenCollection(collectionName, callback) {
  try {
    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data()
        }));

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
    ["morador", "familia", "família", "lideranca", "participante", "user", "usuario", "casa"].includes(participantType(item))
  ).length;

  const condoCount = approvedParticipants.filter((item) =>
    ["condominio", "condomínio"].includes(participantType(item))
  ).length;

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
    actions: STATE.approvalRequests.length,
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

function renderRecentColetas() {
  if (!els.recentColetasTableBody) return;

  const recent = [...STATE.coletas]
    .filter(isColetaRealizada)
    .sort((a, b) => {
      const dateA = getDateValue(a)?.getTime() || 0;
      const dateB = getDateValue(b)?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, STATE.recentLimit);

  if (!recent.length) {
    els.recentColetasTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma coleta cadastrada.</td>
      </tr>
    `;
    updateLoadMoreButton();
    return;
  }

  els.recentColetasTableBody.innerHTML = recent
    .map((item) => {
      return `
        <tr>
          <td>${escapeHtml(formatDateLabel(item))}</td>

          <td>${escapeHtml(getParticipantName(item))}</td>

          <td>${escapeHtml(getParticipantCode(item))}</td>

          <td>${escapeHtml(formatFluxoLabel(getTipoRecebimento(item)))}</td>

          <td>${statusBadge(getColetaStatusLabel(item))}</td>

          <td>
            <div class="details-metrics">
              <span><strong>Peso recebido:</strong> ${escapeHtml(formatKg(getPesoRecebido(item)))}</span>
              <span><strong>Rejeito:</strong> ${escapeHtml(formatKg(getRejeito(item)))}</span>
              <span><strong>Não comercializado:</strong> ${escapeHtml(formatKg(getNaoComercializado(item)))}</span>
            </div>
          </td>

          <td>
            <button
              class="table-action-link"
              type="button"
              data-view-coleta="${escapeHtml(item.id)}"
            >
              Ver coleta
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  updateLoadMoreButton();
}

function updateLoadMoreButton() {
  const btn = els.btnLoadMoreColetas || document.getElementById("btnLoadMoreColetas");
  if (!btn) return;

  const total = STATE.coletas.filter(isColetaRealizada).length;

  if (!total) {
    btn.textContent = "Nenhuma coleta disponível";
    btn.disabled = true;
    return;
  }

  if (STATE.recentLimit >= total) {
    btn.textContent = "Todas as coletas já estão visíveis";
    btn.disabled = true;
    return;
  }

  btn.textContent = "Visualizar mais 10 coletas";
  btn.disabled = false;
}

function setupLoadMoreColetasButton() {
  const btn = els.btnLoadMoreColetas || document.getElementById("btnLoadMoreColetas");
  if (!btn) return;

  btn.addEventListener("click", () => {
    STATE.recentLimit += 10;
    renderRecentColetas();
  });
}

/* =========================================================
   MODAL COLETA
========================================================= */

function openColetaModal(item) {
  const old = document.getElementById("coletaDetailsModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "coletaDetailsModal";
  modal.className = "coleta-modal-overlay";

  modal.innerHTML = `
    <div class="coleta-modal">
      <button class="coleta-modal-close" id="closeColetaModal" type="button">×</button>

      <div class="coleta-modal-head">
        <h2>Detalhes da coleta</h2>
        <p>Visualização completa do registro salvo.</p>
      </div>

      <div class="coleta-modal-grid">
        <div class="coleta-info-card"><strong>Data:</strong> ${escapeHtml(formatDateLabel(item))}</div>
        <div class="coleta-info-card"><strong>Fluxo:</strong> ${escapeHtml(formatFluxoLabel(getTipoRecebimento(item)))}</div>
        <div class="coleta-info-card"><strong>Participante:</strong> ${escapeHtml(getParticipantName(item))}</div>
        <div class="coleta-info-card"><strong>Código:</strong> ${escapeHtml(getParticipantCode(item))}</div>
        <div class="coleta-info-card"><strong>Status:</strong> ${escapeHtml(getColetaStatusLabel(item))}</div>
        <div class="coleta-info-card"><strong>Qualidade:</strong> ${escapeHtml(getQualidade(item) || "—")}</div>
        <div class="coleta-info-card"><strong>Peso recebido:</strong> ${escapeHtml(formatKg(getPesoRecebido(item)))}</div>
        <div class="coleta-info-card"><strong>Rejeito:</strong> ${escapeHtml(formatKg(getRejeito(item)))}</div>
        <div class="coleta-info-card"><strong>Não comercializado:</strong> ${escapeHtml(formatKg(getNaoComercializado(item)))}</div>
      </div>

      <div class="coleta-materials-box">
        <h3>Materiais informados</h3>
        <div class="coleta-materials-list">
          ${renderMaterialsList(item)}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  modal.addEventListener("click", (event) => {
    if (event.target.id === "closeColetaModal" || event.target === modal) {
      modal.remove();
      document.body.classList.remove("modal-open");
    }
  });
}

function setupRecentColetasActions() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view-coleta]");
    if (!button) return;

    const coletaId = button.dataset.viewColeta;
    const coleta = STATE.coletas.find((item) => String(item.id) === String(coletaId));

    if (!coleta) return;

    openColetaModal(coleta);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    const modal = document.getElementById("coletaDetailsModal");

    if (modal) {
      modal.remove();
      document.body.classList.remove("modal-open");
    }
  });
}

/* =========================================================
   GRÁFICOS
========================================================= */

function buildMonthlyColetasSeries(items = []) {
  const map = new Map();

  items
    .filter(isColetaRealizada)
    .forEach((item) => {
      const date = getDateValue(item);
      if (!date) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const label = date.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit"
      });

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          total: 0
        });
      }

      map.get(key).total += 1;
    });

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-8);
}

function updateCharts(data) {
  const monthly = buildMonthlyColetasSeries(STATE.coletas);

  const totalLabel = document.getElementById("chartTotalColetasLabel");

  if (totalLabel) {
    totalLabel.textContent = String(data.coletas || 0);
  }

  if (els.chartColetasMensais) {
    const max = Math.max(...monthly.map((item) => item.total), 1);

    if (!monthly.length) {
      els.chartColetasMensais.innerHTML = `
        <div class="empty-chart-message">Sem coletas para exibir.</div>
      `;
    } else {
      els.chartColetasMensais.innerHTML = monthly
        .map((item) => {
          const height = Math.max(8, Math.round((item.total / max) * 100));

          return `
            <div class="powerbi-bar-item">
              <span class="powerbi-bar-value">${item.total}</span>
              <div class="powerbi-bar" style="height:${height}%"></div>
              <span class="powerbi-bar-label">${escapeHtml(item.label)}</span>
            </div>
          `;
        })
        .join("");
    }
  }

  const totalParticipants = Math.max(Number(data.participants || 0), 0);
  const people = Math.max(Number(data.people || 0), 0);
  const condos = Math.max(Number(data.condos || 0), 0);
  const others = Math.max(totalParticipants - people - condos, 0);
  const totalForDonut = Math.max(totalParticipants, 1);

  const peoplePercent = (people / totalForDonut) * 100;
  const condoPercent = (condos / totalForDonut) * 100;
  const otherPercent = (others / totalForDonut) * 100;

  const donut = document.getElementById("chartParticipantesPerfil");
  const chartTotalParticipantesLabel = document.getElementById("chartTotalParticipantesLabel");

  if (chartTotalParticipantesLabel) {
    chartTotalParticipantesLabel.textContent = String(totalParticipants);
  }

  if (donut) {
    const p1 = peoplePercent;
    const p2 = peoplePercent + condoPercent;
    const p3 = peoplePercent + condoPercent + otherPercent;

    donut.style.background = `
      conic-gradient(
        #81B92A 0 ${p1}%,
        #53ACDE ${p1}% ${p2}%,
        #EF6B22 ${p2}% ${p3}%
      )
    `;
  }

  const peso = Number(data.pesoRecebido || 0);
  const rejeito = Number(data.rejeito || 0);
  const naoComercializado = Number(data.naoComercializado || 0);
  const maxPeso = Math.max(peso, rejeito, naoComercializado, 1);

  const barPeso = document.getElementById("barPesoRecebido");
  const barRejeito = document.getElementById("barRejeito");
  const barNaoComercializado = document.getElementById("barNaoComercializado");

  const barPesoLabel = document.getElementById("barPesoRecebidoLabel");
  const barRejeitoLabel = document.getElementById("barRejeitoLabel");
  const barNaoComercializadoLabel = document.getElementById("barNaoComercializadoLabel");

  if (barPeso) barPeso.style.width = `${Math.max(2, (peso / maxPeso) * 100)}%`;
  if (barRejeito) barRejeito.style.width = `${Math.max(2, (rejeito / maxPeso) * 100)}%`;
  if (barNaoComercializado) barNaoComercializado.style.width = `${Math.max(2, (naoComercializado / maxPeso) * 100)}%`;

  if (barPesoLabel) barPesoLabel.textContent = formatKg(peso);
  if (barRejeitoLabel) barRejeitoLabel.textContent = formatKg(rejeito);
  if (barNaoComercializadoLabel) barNaoComercializadoLabel.textContent = formatKg(naoComercializado);
}

/* =========================================================
   PERMISSÕES / DADOS
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

function listenDashboardData(profile) {
  clearUnsubscribers();

  listenCollection("participants", (items) => {
    STATE.participants = items
      .filter(itemBelongsToTerritory)
      .filter((item) => {
        const status = normalizeText(item.approvalStatus || item.status || item.decision);
        return status !== "rejected" && status !== "rejeitado";
      });

    updateKpis();
  });

  listenCollection("coletas", (items) => {
    STATE.coletas = items
      .filter(itemBelongsToTerritory)
      .filter(isColetaRealizada)
      .sort((a, b) => {
        const dateA = getDateValue(a)?.getTime() || 0;
        const dateB = getDateValue(b)?.getTime() || 0;
        return dateB - dateA;
      });

    updateKpis();
    renderRecentColetas();
  });

  listenCollection("approvalRequests", (items) => {
    STATE.approvalRequests = items
      .filter(itemBelongsToTerritory)
      .filter(isPendingParticipant);

    updateKpis();
  });
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
    renderRecentColetas();
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
  setupLoadMoreColetasButton();
  setupRecentColetasActions();
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