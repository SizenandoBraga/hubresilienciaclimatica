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

const bodyConfig = document.body.dataset || {};

function canonicalTerritoryId(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  if (!raw) return "vila-pinto";
  if (raw === "crgr-vila-pinto") return "vila-pinto";
  if (raw === "crgr-cooadesc" || raw === "crgr-coadesc" || raw === "coadesc") return "cooadesc";
  if (raw === "crgr-padre-cacique") return "padre-cacique";

  return raw;
}

const PAGE_TERRITORY = {
  territoryId: canonicalTerritoryId(bodyConfig.territoryId || "vila-pinto"),
  cooperativeName: bodyConfig.cooperativeName || "Vila Pinto"
};

const els = {
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  logoutLink: document.getElementById("logoutLink"),

  userNameTop: document.getElementById("userNameTop"),
  accessBanner: document.getElementById("accessBanner"),

  indicatorParticipants: document.getElementById("indicatorParticipants"),
  indicatorColetas: document.getElementById("indicatorColetas"),
  indicatorActions: document.getElementById("indicatorActions"),

  indicatorPesoRecebido: document.getElementById("indicatorPesoRecebido"),
  indicatorRejeito: document.getElementById("indicatorRejeito"),
  indicatorNaoComercializado: document.getElementById("indicatorNaoComercializado"),
  indicatorQualidadeMedia: document.getElementById("indicatorQualidadeMedia"),

  recentColetasTableBody: document.getElementById("recentColetasTableBody"),

  chartColetasMensais: document.getElementById("chartColetasMensais"),
  chartParticipantesPerfil: document.getElementById("chartParticipantesPerfil")
};

const STATE = {
  currentUser: null,
  profile: null,
  participants: [],
  coletas: [],
  approvalRequests: [],
  unsubscribers: [],
  recentLimit: 10
};

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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatKg(value) {
  return `${formatNumber(Math.round(Number(value || 0)))} kg`;
}

function animateNumber(el, value, suffix = "") {
  if (!el) return;
  el.textContent = `${Number(value || 0).toLocaleString("pt-BR")}${suffix}`;
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
  return (
    item.participantName ||
    item.nomeParticipante ||
    item.nome ||
    item.name ||
    item.payloadSnapshot?.participantName ||
    item.payloadSnapshot?.name ||
    getParticipantCode(item) ||
    "-"
  );
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
  ].filter(Boolean).map(canonicalTerritoryId);

  if (PAGE_TERRITORY.territoryId === "vila-pinto") {
    return (
      code.startsWith("VPD") ||
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

function getDateValue(item = {}) {
  const possible =
    item.dataColeta ||
    item.coletaData ||
    item.dateColeta ||
    item.opDate ||
    item.createdAt ||
    item.createdAtISO ||
    item.date ||
    item.data ||
    item.payloadSnapshot?.dataColeta ||
    item.payloadSnapshot?.data ||
    null;

  if (!possible) return null;
  if (typeof possible?.toDate === "function") return possible.toDate();
  if (possible instanceof Date) return possible;

  const parsed = new Date(possible);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    item.localType ||
    item.codeLocalType ||
    item.payloadSnapshot?.flowType ||
    item.payloadSnapshot?.tipoRecebimento ||
    "recebimento"
  );
}

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "recebimento") return "Recebimento";
  if (normalized === "final_turno") return "Final do turno";
  if (normalized.includes("final")) return "Final do turno";

  return value || "Recebimento";
}

function getPesoRecebido(coleta = {}) {
  return (
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
    toNumber(coleta.payloadSnapshot?.totalKg) ||
    0
  );
}

function getRejeito(coleta = {}) {
  return (
    toNumber(coleta.rejeito) ||
    toNumber(coleta.pesoRejeito) ||
    toNumber(coleta.totalRejeito) ||
    toNumber(coleta.rejeitos) ||
    toNumber(coleta.recebimento?.pesoRejeitoKg) ||
    toNumber(coleta.finalTurno?.pesoRejeitoKg) ||
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
    toNumber(coleta.materialNaoComercializado) ||
    toNumber(coleta.naoVenda) ||
    toNumber(coleta.semComercializacao) ||
    toNumber(coleta.recebimento?.pesoNaoComercializadoKg) ||
    toNumber(coleta.finalTurno?.pesoNaoComercializadoKg) ||
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
    toNumber(coleta.payloadSnapshot?.qualidade) ||
    0
  );
}

function getColetaStatusLabel(item = {}) {
  const raw = item.status || item.situacao || item.decision || "Realizada";
  const normalized = normalizeText(raw);

  if (normalized === "approved" || normalized === "aprovado") return "Realizada";
  if (normalized === "active" || normalized === "ativo") return "Realizada";
  if (normalized === "pending") return "Pendente";
  if (normalized === "rejected") return "Rejeitada";

  return raw || "Realizada";
}

function statusBadge(status) {
  const label = String(status || "Realizada");
  const normalized = normalizeText(label);

  let className = "status-badge";

  if (normalized.includes("pend")) className += " pendente";
  if (normalized.includes("reje") || normalized.includes("cancel")) className += " rejeitado";
  if (normalized.includes("real") || normalized.includes("aprov")) className += " realizada";

  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    throw new Error("Usuário não encontrado.");
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}

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
      console.error(error);
    }

    window.location.href = "index.html";
  });
}

function fillHeader(profile) {
  const name =
    profile.displayName ||
    profile.name ||
    profile.nome ||
    "Administrador VP";

  if (els.userNameTop) {
    els.userNameTop.textContent = name;
  }

  if (els.accessBanner) {
    els.accessBanner.innerHTML = `
      <strong>Acesso administrativo ativo.</strong>
      Indicadores vinculados à cooperativa ${PAGE_TERRITORY.cooperativeName}.
    `;
  }
}

function clearUnsubscribers() {
  STATE.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (_) {}
  });

  STATE.unsubscribers = [];
}

function listenCollection(collectionName, callback) {
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
      console.error(`[${collectionName}]`, error);
      callback([]);
    }
  );

  STATE.unsubscribers.push(unsubscribe);
}

function updateKpis() {
  const participants = STATE.participants.length;
  const coletas = STATE.coletas.length;

  const pesoRecebido = STATE.coletas.reduce((acc, item) => acc + getPesoRecebido(item), 0);
  const rejeito = STATE.coletas.reduce((acc, item) => acc + getRejeito(item), 0);
  const naoComercializado = STATE.coletas.reduce((acc, item) => acc + getNaoComercializado(item), 0);

  const qualidadeItens = STATE.coletas.map(getQualidade).filter((v) => v > 0);

  const qualidade = qualidadeItens.length
    ? (qualidadeItens.reduce((acc, item) => acc + item, 0) / qualidadeItens.length).toFixed(1)
    : "0";

  animateNumber(els.indicatorParticipants, participants);
  animateNumber(els.indicatorColetas, coletas);
  animateNumber(els.indicatorActions, STATE.approvalRequests.length);

  if (els.indicatorPesoRecebido) els.indicatorPesoRecebido.textContent = formatKg(pesoRecebido);
  if (els.indicatorRejeito) els.indicatorRejeito.textContent = formatKg(rejeito);
  if (els.indicatorNaoComercializado) els.indicatorNaoComercializado.textContent = formatKg(naoComercializado);
  if (els.indicatorQualidadeMedia) els.indicatorQualidadeMedia.textContent = qualidade;

  renderRecentColetas();

  updateCharts({
    participants,
    coletas,
    pesoRecebido,
    rejeito,
    naoComercializado
  });
}

function renderRecentColetas() {
  if (!els.recentColetasTableBody) return;

  const recent = [...STATE.coletas]
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
  const btn = document.getElementById("btnLoadMoreColetas");
  if (!btn) return;

  const total = STATE.coletas.length;

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
  const btn = document.getElementById("btnLoadMoreColetas");
  if (!btn) return;

  btn.addEventListener("click", () => {
    STATE.recentLimit += 10;
    renderRecentColetas();
  });
}

function renderMaterialsList(item = {}) {
  const materials =
    item.materials ||
    item.materiais ||
    item.payloadSnapshot?.materials ||
    item.payloadSnapshot?.materiais ||
    {};

  const entries = Object.entries(materials);

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
        <div class="coleta-info-card"><strong>Participante:</strong> ${escapeHtml(getParticipantName(item))}</div>
        <div class="coleta-info-card"><strong>Código:</strong> ${escapeHtml(getParticipantCode(item))}</div>
        <div class="coleta-info-card"><strong>Tipo:</strong> ${escapeHtml(formatFluxoLabel(getTipoRecebimento(item)))}</div>
        <div class="coleta-info-card"><strong>Status:</strong> ${escapeHtml(getColetaStatusLabel(item))}</div>
        <div class="coleta-info-card"><strong>Peso recebido:</strong> ${escapeHtml(formatKg(getPesoRecebido(item)))}</div>
        <div class="coleta-info-card"><strong>Rejeito:</strong> ${escapeHtml(formatKg(getRejeito(item)))}</div>
        <div class="coleta-info-card"><strong>Não comercializado:</strong> ${escapeHtml(formatKg(getNaoComercializado(item)))}</div>
      </div>

      <div class="coleta-materials-box">
        <h3>Materiais informados</h3>
        <div class="coleta-materials-list">${renderMaterialsList(item)}</div>
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
}

function buildMonthlyColetasSeries(items = []) {
  const map = new Map();

  items.forEach((item) => {
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
  if (totalLabel) totalLabel.textContent = String(data.coletas || 0);

  if (els.chartColetasMensais) {
    if (!monthly.length) {
      els.chartColetasMensais.innerHTML = `
        <div class="empty-chart-message">Sem coletas para exibir.</div>
      `;
    } else {
      const max = Math.max(...monthly.map((item) => item.total), 1);

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

  const families = STATE.participants.filter((item) => {
    const type = normalizeText(
      item.localType ||
      item.codeLocalType ||
      item.participantType ||
      item.tipo ||
      item.payloadSnapshot?.localType
    );

    return type === "casa" || type === "familia" || type === "família" || type === "morador";
  }).length;

  const condos = STATE.participants.filter((item) => {
    const type = normalizeText(
      item.localType ||
      item.codeLocalType ||
      item.participantType ||
      item.tipo ||
      item.payloadSnapshot?.localType
    );

    return type === "condominio" || type === "condomínio";
  }).length;

  const others = Math.max(totalParticipants - families - condos, 0);
  const totalForDonut = Math.max(totalParticipants, 1);

  const p1 = (families / totalForDonut) * 100;
  const p2 = p1 + (condos / totalForDonut) * 100;
  const p3 = p2 + (others / totalForDonut) * 100;

  const donut = document.getElementById("chartParticipantesPerfil");
  const donutTotal = document.getElementById("chartTotalParticipantesLabel");

  if (donutTotal) donutTotal.textContent = String(totalParticipants);

  if (donut) {
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
  const barNao = document.getElementById("barNaoComercializado");

  const pesoLabel = document.getElementById("barPesoRecebidoLabel");
  const rejeitoLabel = document.getElementById("barRejeitoLabel");
  const naoLabel = document.getElementById("barNaoComercializadoLabel");

  if (barPeso) barPeso.style.width = `${Math.max(2, (peso / maxPeso) * 100)}%`;
  if (barRejeito) barRejeito.style.width = `${Math.max(2, (rejeito / maxPeso) * 100)}%`;
  if (barNao) barNao.style.width = `${Math.max(2, (naoComercializado / maxPeso) * 100)}%`;

  if (pesoLabel) pesoLabel.textContent = formatKg(peso);
  if (rejeitoLabel) rejeitoLabel.textContent = formatKg(rejeito);
  if (naoLabel) naoLabel.textContent = formatKg(naoComercializado);
}

function listenDashboardData() {
  clearUnsubscribers();

  listenCollection("participants", (items) => {
    STATE.participants = items
      .filter(itemBelongsToTerritory)
      .filter(isApprovedParticipant);

    updateKpis();
  });

  listenCollection("coletas", (items) => {
    STATE.coletas = items
      .filter(itemBelongsToTerritory)
      .filter(isColetaRealizada);

    console.table(
      STATE.coletas.slice(0, 10).map((item) => ({
        id: item.id,
        participante: getParticipantName(item),
        codigo: getParticipantCode(item),
        peso: getPesoRecebido(item),
        rejeito: getRejeito(item),
        naoComercializado: getNaoComercializado(item)
      }))
    );

    updateKpis();
  });

  listenCollection("approvalRequests", (items) => {
    STATE.approvalRequests = items
      .filter(itemBelongsToTerritory)
      .filter(isPendingParticipant);

    console.table(
      STATE.approvalRequests.map((item) => ({
        id: item.id,
        nome: getParticipantName(item),
        codigo: getParticipantCode(item),
        status: item.status || item.decision || item.approvalStatus
      }))
    );

    updateKpis();
  });
}

function boot() {
  setupSidebar();
  setupLogout();
  setupLoadMoreColetasButton();
  setupRecentColetasActions();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      STATE.currentUser = user;

      const profile = await getUserProfile(user.uid);
      STATE.profile = profile;

      fillHeader(profile);
      listenDashboardData();

      document.body.classList.add("dashboard-loaded");
    } catch (error) {
      console.error("Erro ao carregar painel:", error);
      alert("Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();