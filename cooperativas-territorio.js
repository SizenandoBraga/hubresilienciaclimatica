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
  if (raw === "crgr-padre-cacique") return "padre-cacique";

  return raw;
}

const PAGE_TERRITORY = {
  territoryId: canonicalTerritoryId(bodyConfig.territoryId || "vila-pinto"),
  cooperativeName: bodyConfig.cooperativeName || "Vila Pinto"
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

/* =========================================================
   STATE
========================================================= */

const STATE = {
  currentUser: null,
  profile: null,
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
  const duration = 450;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const next = Math.round(target * progress);

    el.textContent = next.toLocaleString("pt-BR") + suffix;

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function getDateValue(item = {}) {
  const possible =
    item.dataColeta ||
    item.coletaData ||
    item.createdAt ||
    item.createdAtISO ||
    item.date ||
    item.data ||
    null;

  if (!possible) return null;

  if (typeof possible?.toDate === "function") {
    return possible.toDate();
  }

  if (possible instanceof Date) {
    return possible;
  }

  const parsed = new Date(possible);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function formatDateLabel(item = {}) {
  const date = getDateValue(item);

  if (!date) return "-";

  return date.toLocaleDateString("pt-BR");
}

function getParticipantCode(item = {}) {
  return String(
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.code ||
    item.payloadSnapshot?.participantCode ||
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
    getParticipantCode(item) ||
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
    item.localType ||
    item.codeLocalType ||
    item.payloadSnapshot?.flowType ||
    "recebimento"
  );
}

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "recebimento") return "Recebimento";
  if (normalized === "final_turno") return "Final do turno";

  return value || "Recebimento";
}

function getPesoRecebido(coleta = {}) {
  return (
    toNumber(coleta.pesoRecebido) ||
    toNumber(coleta.totalKg) ||
    toNumber(coleta.pesoTotal) ||
    toNumber(coleta.peso) ||
    toNumber(coleta.kg) ||
    0
  );
}

function getRejeito(coleta = {}) {
  return (
    toNumber(coleta.rejeito) ||
    toNumber(coleta.totalRejeito) ||
    0
  );
}

function getNaoComercializado(coleta = {}) {
  return (
    toNumber(coleta.naoComercializado) ||
    toNumber(coleta.totalNaoComercializado) ||
    0
  );
}

function getQualidade(coleta = {}) {
  return (
    toNumber(coleta.qualidade) ||
    toNumber(coleta.notaQualidade) ||
    0
  );
}

/* =========================================================
   STATUS
========================================================= */

function getColetaStatusLabel(item = {}) {
  const raw =
    item.status ||
    item.situacao ||
    item.decision ||
    "Realizada";

  const normalized = normalizeText(raw);

  if (normalized === "approved") return "Realizada";
  if (normalized === "active") return "Realizada";
  if (normalized === "pending") return "Pendente";
  if (normalized === "rejected") return "Rejeitada";

  return raw || "Realizada";
}

function statusBadge(status) {
  const label = String(status || "Realizada");
  const normalized = normalizeText(label);

  let className = "status-badge";

  if (normalized.includes("pend")) className += " pendente";
  if (normalized.includes("reje")) className += " rejeitado";
  if (normalized.includes("real")) className += " realizada";

  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

/* =========================================================
   AUTH
========================================================= */

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

/* =========================================================
   SIDEBAR
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

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) {
      closeSidebar();
    }
  });
}

/* =========================================================
   LOGOUT
========================================================= */

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

/* =========================================================
   HEADER
========================================================= */

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

/* =========================================================
   KPIS
========================================================= */

function updateKpis() {

  const participants = STATE.participants.length;

  const coletas = STATE.coletas.length;

  const pesoRecebido = STATE.coletas.reduce(
    (acc, item) => acc + getPesoRecebido(item),
    0
  );

  const rejeito = STATE.coletas.reduce(
    (acc, item) => acc + getRejeito(item),
    0
  );

  const naoComercializado = STATE.coletas.reduce(
    (acc, item) => acc + getNaoComercializado(item),
    0
  );

  const qualidade =
    STATE.coletas.length > 0
      ? (
          STATE.coletas.reduce(
            (acc, item) => acc + getQualidade(item),
            0
          ) / STATE.coletas.length
        ).toFixed(1)
      : "0";

  animateNumber(els.indicatorParticipants, participants);
  animateNumber(els.indicatorColetas, coletas);
  animateNumber(els.indicatorActions, STATE.approvalRequests.length);

  if (els.indicatorPesoRecebido) {
    els.indicatorPesoRecebido.textContent = formatKg(pesoRecebido);
  }

  if (els.indicatorRejeito) {
    els.indicatorRejeito.textContent = formatKg(rejeito);
  }

  if (els.indicatorNaoComercializado) {
    els.indicatorNaoComercializado.textContent = formatKg(naoComercializado);
  }

  if (els.indicatorQualidadeMedia) {
    els.indicatorQualidadeMedia.textContent = qualidade;
  }

  renderRecentColetas();

  updateCharts({
    participants,
    coletas,
    pesoRecebido,
    rejeito,
    naoComercializado
  });
}

/* =========================================================
   RECENTES
========================================================= */

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
        <td colspan="7">
          Nenhuma coleta cadastrada.
        </td>
      </tr>
    `;

    return;
  }

  els.recentColetasTableBody.innerHTML = recent
    .map((item) => {

      return `
        <tr>

          <td>
            ${escapeHtml(formatDateLabel(item))}
          </td>

          <td>
            ${escapeHtml(getParticipantName(item))}
          </td>

          <td>
            ${escapeHtml(getParticipantCode(item))}
          </td>

          <td>
            ${escapeHtml(
              formatFluxoLabel(getTipoRecebimento(item))
            )}
          </td>

          <td>
            ${statusBadge(getColetaStatusLabel(item))}
          </td>

          <td>
            <div class="details-metrics">

              <span>
                <strong>Peso:</strong>
                ${escapeHtml(formatKg(getPesoRecebido(item)))}
              </span>

              <span>
                <strong>Rejeito:</strong>
                ${escapeHtml(formatKg(getRejeito(item)))}
              </span>

              <span>
                <strong>Não comercializado:</strong>
                ${escapeHtml(formatKg(getNaoComercializado(item)))}
              </span>

            </div>
          </td>

          <td>
            <button
              class="table-action-link"
              type="button"
              data-view-coleta="${item.id}"
            >
              Ver coleta
            </button>
          </td>

        </tr>
      `;
    })
    .join("");
}

/* =========================================================
   MODAL
========================================================= */

function renderMaterialsList(item = {}) {

  const materials =
    item.materials ||
    item.materiais ||
    item.payloadSnapshot?.materials ||
    item.payloadSnapshot?.materiais ||
    {};

  const entries = Object.entries(materials);

  if (!entries.length) {
    return `
      <div class="empty-materials">
        Nenhum material informado.
      </div>
    `;
  }

  return entries
    .map(([name, value]) => {

      return `
        <div class="material-line">

          <span>
            ${escapeHtml(name)}
          </span>

          <strong>
            ${escapeHtml(formatKg(value))}
          </strong>

        </div>
      `;
    })
    .join("");
}

function openColetaModal(item) {

  const old =
    document.getElementById("coletaDetailsModal");

  if (old) {
    old.remove();
  }

  const modal = document.createElement("div");

  modal.id = "coletaDetailsModal";

  modal.className = "coleta-modal-overlay";

  modal.innerHTML = `
    <div class="coleta-modal">

      <button
        class="coleta-modal-close"
        id="closeColetaModal"
      >
        ×
      </button>

      <div class="coleta-modal-head">
        <h2>Detalhes da coleta</h2>
      </div>

      <div class="coleta-modal-grid">

        <div class="coleta-info-card">
          <strong>Data:</strong>
          ${escapeHtml(formatDateLabel(item))}
        </div>

        <div class="coleta-info-card">
          <strong>Participante:</strong>
          ${escapeHtml(getParticipantName(item))}
        </div>

        <div class="coleta-info-card">
          <strong>Código:</strong>
          ${escapeHtml(getParticipantCode(item))}
        </div>

        <div class="coleta-info-card">
          <strong>Tipo:</strong>
          ${escapeHtml(
            formatFluxoLabel(
              getTipoRecebimento(item)
            )
          )}
        </div>

        <div class="coleta-info-card">
          <strong>Peso:</strong>
          ${escapeHtml(
            formatKg(getPesoRecebido(item))
          )}
        </div>

        <div class="coleta-info-card">
          <strong>Rejeito:</strong>
          ${escapeHtml(
            formatKg(getRejeito(item))
          )}
        </div>

        <div class="coleta-info-card">
          <strong>Não comercializado:</strong>
          ${escapeHtml(
            formatKg(getNaoComercializado(item))
          )}
        </div>

      </div>

      <div class="coleta-materials-box">

        <h3>Materiais</h3>

        <div class="coleta-materials-list">
          ${renderMaterialsList(item)}
        </div>

      </div>

    </div>
  `;

  document.body.appendChild(modal);

  modal.addEventListener("click", (event) => {

    if (
      event.target.id === "closeColetaModal" ||
      event.target === modal
    ) {
      modal.remove();
    }
  });
}

function setupRecentColetasActions() {

  document.addEventListener("click", (event) => {

    const button =
      event.target.closest("[data-view-coleta]");

    if (!button) return;

    const coletaId =
      button.dataset.viewColeta;

    const coleta = STATE.coletas.find(
      (item) =>
        String(item.id) === String(coletaId)
    );

    if (!coleta) return;

    openColetaModal(coleta);
  });
}

/* =========================================================
   CHARTS
========================================================= */

function buildMonthlyColetasSeries(items = []) {

  const map = new Map();

  items.forEach((item) => {

    const date = getDateValue(item);

    if (!date) return;

    const key =
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

    const label =
      date.toLocaleDateString("pt-BR", {
        month: "short"
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

  return Array.from(map.values()).slice(-8);
}

function updateCharts(data) {

  const monthly =
    buildMonthlyColetasSeries(STATE.coletas);

  if (els.chartColetasMensais) {

    const max =
      Math.max(...monthly.map((item) => item.total), 1);

    els.chartColetasMensais.innerHTML =
      monthly
        .map((item) => {

          const height =
            Math.max(
              10,
              Math.round((item.total / max) * 100)
            );

          return `
            <div class="powerbi-bar-item">

              <span class="powerbi-bar-value">
                ${item.total}
              </span>

              <div
                class="powerbi-bar"
                style="height:${height}%"
              ></div>

              <span class="powerbi-bar-label">
                ${escapeHtml(item.label)}
              </span>

            </div>
          `;
        })
        .join("");
  }

  if (els.chartParticipantesPerfil) {

    const total =
      Math.max(data.participants, 1);

    const familias =
      Math.round((data.participants / total) * 100);

    const condominios = 25;
    const outros = 15;

    els.chartParticipantesPerfil.style.background =
      `
      conic-gradient(
        #81B92A 0 ${familias}%,
        #53ACDE ${familias}% ${familias + condominios}%,
        #EF6B22 ${familias + condominios}% 100%
      )
    `;
  }
}

/* =========================================================
   DATA
========================================================= */

function listenDashboardData() {

  clearUnsubscribers();

  listenCollection("participants", (items) => {

    STATE.participants = items;

    updateKpis();
  });

  listenCollection("coletas", (items) => {

    STATE.coletas = items;

    console.log(
      "[Dashboard] Coletas:",
      STATE.coletas.length
    );

    updateKpis();
  });

  listenCollection("approvalRequests", (items) => {

    STATE.approvalRequests = items;

    updateKpis();
  });
}

/* =========================================================
   BOOT
========================================================= */

function boot() {

  setupSidebar();
  setupLogout();
  setupRecentColetasActions();

  onAuthStateChanged(auth, async (user) => {

    try {

      if (!user) {
        window.location.href = "login.html";
        return;
      }

      STATE.currentUser = user;

      const profile =
        await getUserProfile(user.uid);

      STATE.profile = profile;

      fillHeader(profile);

      listenDashboardData();

    } catch (error) {

      console.error(
        "Erro ao carregar painel:",
        error
      );

      alert(
        "Não foi possível carregar o painel."
      );
    }
  });
}

boot();