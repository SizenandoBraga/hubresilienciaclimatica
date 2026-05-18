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
  where,
  orderBy,
  onSnapshot,
  getDocs,
  setDoc,
  serverTimestamp
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
  territoryId: canonicalTerritoryId(
    bodyConfig.territoryId || "vila-pinto"
  ),

  territoryLabel:
    bodyConfig.territoryLabel ||
    "Centro de Triagem Vila Pinto",

  cooperativeName:
    bodyConfig.cooperativeName ||
    "Vila Pinto",

  coletasUrl:
    bodyConfig.coletasUrl ||
    "cadastro-coletas-vila-pinto.html"
};

const AUTO_SYNC_INTERVAL_MS =
  12 * 60 * 60 * 1000;

/* =========================================================
   ELEMENTOS
========================================================= */

const els = {

  sidebar:
    document.getElementById("sidebar"),

  menuBtn:
    document.getElementById("menuBtn"),

  mobileOverlay:
    document.getElementById("mobileOverlay"),

  logoutLink:
    document.getElementById("logoutLink"),

  userNameTop:
    document.getElementById("userNameTop"),

  accessBanner:
    document.getElementById("accessBanner"),

  sidebarHelpText:
    document.getElementById("sidebarHelpText"),

  syncCoopDashboardBtn:
    document.getElementById("syncCoopDashboardBtn"),

  syncCoopDashboardStatus:
    document.getElementById("syncCoopDashboardStatus"),

  indicatorParticipants:
    document.getElementById("indicatorParticipants"),

  indicatorColetas:
    document.getElementById("indicatorColetas"),

  indicatorDocs:
    document.getElementById("indicatorDocs"),

  indicatorActions:
    document.getElementById("indicatorActions"),

  participantsTotalCount:
    document.getElementById("participantsTotalCount"),

  participantsPeopleCount:
    document.getElementById("participantsPeopleCount"),

  participantsCondoCount:
    document.getElementById("participantsCondoCount"),

  noticesList:
    document.getElementById("noticesList"),

  territoryCommunications:
    document.getElementById("territoryCommunications"),

  chartColetasMensais:
    document.getElementById("chartColetasMensais"),

  chartParticipantesPerfil:
    document.getElementById("chartParticipantesPerfil"),

  recentColetasTableBody:
    document.getElementById("recentColetasTableBody"),

  indicatorPesoRecebido:
    document.getElementById("indicatorPesoRecebido"),

  indicatorRejeito:
    document.getElementById("indicatorRejeito"),

  indicatorNaoComercializado:
    document.getElementById("indicatorNaoComercializado"),

  indicatorQualidadeMedia:
    document.getElementById("indicatorQualidadeMedia"),

  exportParticipantsPdfBtn:
    document.getElementById("exportParticipantsPdfBtn")
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
  documents: [],
  approvalRequests: [],
  users: [],

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

function setText(el, value) {
  if (!el) return;
  el.textContent = value;
}

function animateNumber(el, value, suffix = "") {

  if (!el) return;

  const target = Number(value || 0);

  const current =
    Number(
      String(el.textContent || "0")
        .replace(/[^\d]/g, "")
    ) || 0;

  const duration = 500;
  const start = performance.now();

  function frame(now) {

    const progress =
      Math.min((now - start) / duration, 1);

    const next =
      Math.round(
        current +
        (target - current) * progress
      );

    el.textContent =
      next.toLocaleString("pt-BR") + suffix;

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}

function isApprovedParticipant(item) {

  return (
    item.approvalStatus === "approved" ||
    item.status === "active" ||
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
    "rejeitada",
    "rejeitado",
    "rejected",
    "pendente",
    "pending",
    "draft",
    "rascunho"
  ].includes(status);
}

function participantType(item) {

  return normalizeText(
    item.participantType ||
    item.tipoParticipante ||
    item.tipo
  );
}

function isAdminUser(role) {
  return role === "admin";
}

function isGovernancaUser(role) {

  return (
    role === "governanca" ||
    role === "gestor"
  );
}

/* =========================================================
   TERRITÓRIO
========================================================= */

function getPossibleTerritoryValues(profile) {

  const canonical =
    canonicalTerritoryId(
      profile?.territoryId ||
      PAGE_TERRITORY.territoryId
    );

  if (canonical === "vila-pinto") {

    return [
      "vila-pinto",
      "crgr_vila_pinto",
      "crgr-vila-pinto"
    ];
  }

  if (canonical === "cooadesc") {

    return [
      "cooadesc",
      "coadesc",
      "crgr-cooadesc",
      "crgr-coadesc"
    ];
  }

  return [canonical];
}

function itemBelongsToTerritory(item, profile) {

  if (isGovernancaUser(profile.role)) {
    return true;
  }

  const possible =
    getPossibleTerritoryValues(profile)
      .map(canonicalTerritoryId);

  const fields = [

    item.territoryId,
    item.territory,
    item.territorio,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeName,
    item.cooperativa,
    item.localCrgr

  ]
  .filter(Boolean)
  .map(canonicalTerritoryId);

  return fields.some(field =>
    possible.includes(field)
  );
}

/* =========================================================
   PESOS
========================================================= */

function toNumber(value) {

  if (typeof value === "number") {
    return value;
  }

  if (!value) return 0;

  const parsed = Number(
    String(value)
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function getPesoRecebido(coleta = {}) {

  return Math.round(

    toNumber(coleta.pesoRecebido) ||
    toNumber(coleta.totalKg) ||
    toNumber(coleta.peso) ||
    toNumber(coleta.kg) ||
    0
  );
}

function getRejeito(coleta = {}) {

  return Math.round(

    toNumber(coleta.rejeito) ||
    toNumber(coleta.pesoRejeito) ||
    toNumber(coleta.totalRejeito) ||
    0
  );
}

function getNaoComercializado(coleta = {}) {

  return Math.round(

    toNumber(coleta.naoComercializado) ||
    toNumber(coleta.totalNaoComercializado) ||
    toNumber(coleta.naoVenda) ||
    0
  );
}

function getQualidade(coleta = {}) {

  return Number(

    toNumber(coleta.qualidade) ||
    toNumber(coleta.notaQualidade) ||
    0
  );
}

/* =========================================================
   AUTH
========================================================= */

async function getUserProfile(uid) {

  const snap =
    await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    throw new Error(
      "Usuário não encontrado."
    );
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}

function validateProfile(profile) {

  if (!profile) {
    throw new Error(
      "Perfil inválido."
    );
  }

  if (profile.status !== "active") {
    throw new Error(
      "Usuário sem acesso."
    );
  }
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

  els.menuBtn?.addEventListener(
    "click",
    openSidebar
  );

  els.mobileOverlay?.addEventListener(
    "click",
    closeSidebar
  );

  window.addEventListener("resize", () => {

    if (window.innerWidth > 1180) {
      closeSidebar();
    }
  });
}

function setupLogout() {

  els.logoutLink?.addEventListener(
    "click",
    async (event) => {

      event.preventDefault();

      try {

        await signOut(auth);

      } catch (error) {

        console.error(error);

      } finally {

        window.location.href = "index.html";
      }
    }
  );
}

function fillHeader(profile) {

  const isAdmin =
    isAdminUser(profile.role);

  const name =
    profile.displayName ||
    profile.name ||
    profile.nome ||
    (isAdmin
      ? "Administrador VP"
      : "Usuário");

  if (els.userNameTop) {
    els.userNameTop.textContent = name;
  }

  if (els.accessBanner) {

    els.accessBanner.className =
      "access-banner show cooperativa";

    els.accessBanner.innerHTML =
      `
      <strong>
        Painel operacional ativo.
      </strong>

      Indicadores da cooperativa
      ${PAGE_TERRITORY.cooperativeName}
      sincronizados em tempo real.
      `;
  }
}

/* =========================================================
   LISTENERS
========================================================= */

function clearUnsubscribers() {

  STATE.unsubscribers.forEach(unsub => {

    try {
      unsub();
    } catch (_) {}
  });

  STATE.unsubscribers = [];
}

function listenCollection(
  collectionName,
  profile,
  callback
) {

  const possibleValues =
    getPossibleTerritoryValues(profile);

  try {

    const q = query(
      collection(db, collectionName)
    );

    const unsubscribe = onSnapshot(
      q,

      snapshot => {

        let docs = snapshot.docs.map(docItem => {

          const data = {
            id: docItem.id,
            ...docItem.data()
          };

          return data;
        });

        docs = docs.filter(item =>
          itemBelongsToTerritory(
            item,
            profile
          )
        );

        callback(docs);
      },

      error => {

        console.error(
          collectionName,
          error
        );

        callback([]);
      }
    );

    STATE.unsubscribers.push(
      unsubscribe
    );

  } catch (error) {

    console.error(error);
  }
}

/* =========================================================
   KPIs
========================================================= */

function computeDashboardData() {

  const approvedParticipants =
    STATE.participants.filter(
      isApprovedParticipant
    );

  const coletasRealizadas =
    STATE.coletas.filter(
      isColetaRealizada
    );

  const peopleCount =
    approvedParticipants.filter(item =>

      [
        "morador",
        "familia",
        "participante",
        "usuario"
      ].includes(
        participantType(item)
      )

    ).length;

  const condoCount =
    approvedParticipants.filter(item =>

      participantType(item) ===
      "condominio"

    ).length;

  const totalPesoRecebido =
    coletasRealizadas.reduce(
      (acc, item) => {

        return (
          acc +
          getPesoRecebido(item)
        );
      },
      0
    );

  const totalRejeito =
    coletasRealizadas.reduce(
      (acc, item) => {

        return (
          acc +
          getRejeito(item)
        );
      },
      0
    );

  const totalNaoComercializado =
    coletasRealizadas.reduce(
      (acc, item) => {

        return (
          acc +
          getNaoComercializado(item)
        );
      },
      0
    );

  const qualidadeMedia =

    coletasRealizadas.length > 0

      ? (
          coletasRealizadas.reduce(
            (acc, item) => {

              return (
                acc +
                getQualidade(item)
              );
            },
            0
          ) /
          coletasRealizadas.length
        ).toFixed(1)

      : 0;

  return {

    participants:
      approvedParticipants.length,

    people:
      peopleCount,

    condos:
      condoCount,

    coletas:
      coletasRealizadas.length,

    docs:
      STATE.documents.length,

    actions:
      STATE.approvalRequests.length,

    pesoRecebido:
      totalPesoRecebido,

    rejeito:
      totalRejeito,

    naoComercializado:
      totalNaoComercializado,

    qualidadeMedia
  };
}

function updateKpis() {

  const data =
    computeDashboardData();

  animateNumber(
    els.indicatorParticipants,
    data.participants
  );

  animateNumber(
    els.indicatorColetas,
    data.coletas
  );

  animateNumber(
    els.indicatorDocs,
    data.docs
  );

  animateNumber(
    els.indicatorActions,
    data.actions
  );

  animateNumber(
    els.participantsTotalCount,
    data.participants
  );

  animateNumber(
    els.participantsPeopleCount,
    data.people
  );

  animateNumber(
    els.participantsCondoCount,
    data.condos
  );

  animateNumber(
    els.indicatorPesoRecebido,
    data.pesoRecebido,
    " kg"
  );

  animateNumber(
    els.indicatorRejeito,
    data.rejeito,
    " kg"
  );

  animateNumber(
    els.indicatorNaoComercializado,
    data.naoComercializado,
    " kg"
  );

  setText(
    els.indicatorQualidadeMedia,
    data.qualidadeMedia
  );

  renderRecentColetas();
  updateCharts(data);
}

/* =========================================================
   TABELA
========================================================= */

function statusBadge(status) {

  const normalized =
    normalizeText(status);

  let className =
    "status-badge";

  if (
    normalized.includes("pend")
  ) {
    className += " pendente";
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("reje")
  ) {
    className += " rejeitado";
  }

  return `
    <span class="${className}">
      ${status || "Realizada"}
    </span>
  `;
}

function renderRecentColetas() {

  if (!els.recentColetasTableBody) {
    return;
  }

  const recent =

    [...STATE.coletas]
      .sort((a, b) => {

        return new Date(
          b.createdAtISO || 0
        ) - new Date(
          a.createdAtISO || 0
        );
      })
      .slice(0, 8);

  if (!recent.length) {

    els.recentColetasTableBody.innerHTML =
      `
      <tr>
        <td colspan="9">
          Nenhuma coleta cadastrada.
        </td>
      </tr>
      `;

    return;
  }

  els.recentColetasTableBody.innerHTML =
    recent.map(item => {

      const date =
        item.createdAtISO
          ? new Date(
              item.createdAtISO
            ).toLocaleDateString(
              "pt-BR"
            )
          : "--";

      return `
      <tr>

        <td>${date}</td>

        <td>
          ${
            item.participantName ||
            item.nome ||
            "-"
          }
        </td>

        <td>
          ${
            item.participantCode ||
            "-"
          }
        </td>

        <td>
          ${
            item.localType ||
            item.codeLocalType ||
            "-"
          }
        </td>

        <td>
          ${statusBadge(
            item.status ||
            item.decision ||
            "Realizada"
          )}
        </td>

        <td>
          ${getPesoRecebido(item)} kg
        </td>

        <td>
          ${getRejeito(item)} kg
        </td>

        <td>
          ${getNaoComercializado(item)} kg
        </td>

        <td>
          <a
            class="table-action-link"
            href="${PAGE_TERRITORY.coletasUrl}"
          >
            Abrir
          </a>
        </td>

      </tr>
      `;
    }).join("");
}

/* =========================================================
   CHARTS
========================================================= */

function updateCharts(data) {

  const bars =
    els.chartColetasMensais
      ?.querySelectorAll(
        ".fake-bars span"
      );

  if (bars?.length) {

    const values = [

      data.coletas * 0.42,
      data.coletas * 0.58,
      data.coletas * 0.34,
      data.coletas * 0.72,
      data.coletas * 0.62,
      data.coletas * 0.86
    ];

    const max =
      Math.max(...values, 1);

    bars.forEach((bar, index) => {

      const height =
        Math.max(
          18,
          Math.round(
            (
              values[index] / max
            ) * 92
          )
        );

      bar.style.height =
        `${height}%`;
    });
  }

  const donut =
    els.chartParticipantesPerfil
      ?.querySelector(
        ".fake-donut"
      );

  if (donut) {

    const total =
      Math.max(
        data.participants,
        1
      );

    const peoplePercent =
      Math.round(
        (
          data.people / total
        ) * 100
      );

    const condoPercent =
      Math.round(
        (
          data.condos / total
        ) * 100
      );

    donut.style.background =
      `
      conic-gradient(
        #81B92A
        0 ${peoplePercent}%,

        #53ACDE
        ${peoplePercent}%
        ${
          peoplePercent +
          condoPercent
        }%,

        #EF6B22
        ${
          peoplePercent +
          condoPercent
        }%
        100%
      )
      `;
  }
}

/* =========================================================
   DASHBOARD
========================================================= */

function listenDashboardData(profile) {

  clearUnsubscribers();

  listenCollection(

    "participants",

    profile,

    items => {

      STATE.participants =
        items.filter(item =>

          item.approvalStatus !==
          "rejected"

        );

      updateKpis();
    }
  );

  listenCollection(

    "coletas",

    profile,

    items => {

      STATE.coletas =
        items.filter(
          isColetaRealizada
        );

      updateKpis();
    }
  );

  listenCollection(

    "documentos",

    profile,

    items => {

      STATE.documents = items;
      updateKpis();
    }
  );

  listenCollection(

    "approvalRequests",

    profile,

    items => {

      STATE.approvalRequests =
        items.filter(item =>

          item.status ===
          "pending"

        );

      updateKpis();
    }
  );
}

/* =========================================================
   EXPORT PDF
========================================================= */

function setupExportButton() {

  els.exportParticipantsPdfBtn
    ?.addEventListener(
      "click",
      () => {

        window.print();
      }
    );
}

/* =========================================================
   BOOT
========================================================= */

function boot() {

  setupSidebar();
  setupLogout();
  setupExportButton();

  onAuthStateChanged(
    auth,

    async user => {

      try {

        if (!user) {

          window.location.href =
            "login.html";

          return;
        }

        STATE.currentUser = user;

        const profile =
          await getUserProfile(
            user.uid
          );

        validateProfile(profile);

        STATE.profile = profile;

        fillHeader(profile);

        listenDashboardData(
          profile
        );

        document.body.classList.add(
          "dashboard-loaded"
        );

      } catch (error) {

        console.error(error);

        alert(
          error.message ||
          "Erro ao carregar painel."
        );

        window.location.href =
          "login.html";
      }
    }
  );
}

boot();