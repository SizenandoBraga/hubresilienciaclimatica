import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const MATERIAL_META = [
  { key: "plasticoKg", label: "Plástico", price: 1.92, color: "#2E7D32", icon: "plastico" },
  { key: "vidroKg", label: "Vidro", price: 0.08, color: "#0288D1", icon: "vidro" },
  { key: "aluminioMetalKg", label: "Metal / Alumínio", price: 2.9, color: "#757575", icon: "metal" },
  { key: "sacariaKg", label: "Sacaria", price: 0.12, color: "#8D6E63", icon: "sacaria" },
  { key: "papelMistoKg", label: "Papel misto", price: 0.66, color: "#1565C0", icon: "papel" },
  { key: "papelaoKg", label: "Papelão", price: 0.52, color: "#A65A2A", icon: "papelao" },
  { key: "isoporKg", label: "Isopor", price: 0.4, color: "#00ACC1", icon: "isopor" },
  { key: "oleoKg", label: "Óleo de cozinha", price: 1.5, color: "#C79200", icon: "oleo", isSpecial: true }
];

const MATERIAL_ALIASES = {
  plasticoKg: ["plasticoKg", "plastico", "pesoPlasticoKg", "plasticoPesoKg"],
  vidroKg: ["vidroKg", "vidro", "pesoVidroKg", "vidroPesoKg"],
  aluminioMetalKg: ["aluminioMetalKg", "metalKg", "aluminioKg", "metalAluminioKg", "pesoMetalKg", "pesoAluminioKg"],
  sacariaKg: ["sacariaKg", "sacaria", "pesoSacariaKg"],
  papelMistoKg: ["papelMistoKg", "papelKg", "papelMisto", "pesoPapelMistoKg", "pesoPapelKg"],
  papelaoKg: ["papelaoKg", "papelao", "papelãoKg", "pesoPapelaoKg"],
  isoporKg: ["isoporKg", "isopor", "pesoIsoporKg"],
  oleoKg: ["oleoKg", "oleo", "óleoKg", "oleoCozinhaKg", "oleoDeCozinhaKg", "litrosOleo", "oleoLitros"]
};

const CHART_COLORS = {
  blue: "#53ACDE",
  green: "#81B92A",
  orange: "#EF6B22",
  dark: "#3C3A39"
};

const COOP_BASES = {
  "vila-pinto": {
    lat: -30.048729170292532,
    lng: -51.15652604283108
  },
  cooadesc: {
    lat: -30.003,
    lng: -51.206
  },
  "padre-cacique": {
    lat: -30.140122365657504,
    lng: -51.1268772051727
  }
};

/* =========================
   ELEMENTOS
========================= */

const els = {
  fParticipantCode: document.getElementById("fParticipantCode"),
  fFluxo: document.getElementById("fFluxo"),
  fEntrega: document.getElementById("fEntrega"),
  fIni: document.getElementById("fIni"),
  fFim: document.getElementById("fFim"),
  fBusca: document.getElementById("fBusca"),
  fSearchType: document.getElementById("fSearchType"),

  quickParticipantPreview: document.getElementById("quickParticipantPreview"),
  quickParticipantName: document.getElementById("quickParticipantName"),
  quickParticipantCode: document.getElementById("quickParticipantCode"),
  quickParticipantType: document.getElementById("quickParticipantType"),
  quickParticipantStatus: document.getElementById("quickParticipantStatus"),
  quickParticipantAddress: document.getElementById("quickParticipantAddress"),

  chartMainType: document.getElementById("chartMainType"),
  chartFlowType: document.getElementById("chartFlowType"),
  chartDeliveryType: document.getElementById("chartDeliveryType"),
  chartTerritoryType: document.getElementById("chartTerritoryType"),

  btnAplicar: document.getElementById("btnAplicar"),
  btnLimpar: document.getElementById("btnLimpar"),
  btnPrint: document.getElementById("btnPrint"),
  btnExportPDF: document.getElementById("btnExportPDF"),
  btnExportExcel: document.getElementById("btnExportExcel"),

  txtPeriodo: document.getElementById("txtPeriodo"),
  txtRegistrosTopo: document.getElementById("txtRegistrosTopo"),

  userDisplayName: document.getElementById("userDisplayName"),
  userRole: document.getElementById("userRole"),
  userTerritory: document.getElementById("userTerritory"),
  dbStatus: document.getElementById("dbStatus"),

  k_totalColetas: document.getElementById("k_totalColetas"),
  k_participantes: document.getElementById("k_participantes"),
  k_residuoSeco: document.getElementById("k_residuoSeco"),
  k_rejeito: document.getElementById("k_rejeito"),
  k_finalTurno: document.getElementById("k_finalTurno"),

  k_totalDiasProjeto: document.getElementById("k_totalDiasProjeto"),
  k_inicioProjeto: document.getElementById("k_inicioProjeto"),
  k_operacoesRealizadas: document.getElementById("k_operacoesRealizadas"),
  k_participantesProjeto: document.getElementById("k_participantesProjeto"),
  k_condominiosParticipantes: document.getElementById("k_condominiosParticipantes"),
  k_entregaVoluntaria: document.getElementById("k_entregaVoluntaria"),
  k_comercioParticipantes: document.getElementById("k_comercioParticipantes"),
  k_totalReciclavelKg: document.getElementById("k_totalReciclavelKg"),
  k_totalReciclavelPct: document.getElementById("k_totalReciclavelPct"),
  k_receitaTotal: document.getElementById("k_receitaTotal"),
  k_totalRejeitoKg: document.getElementById("k_totalRejeitoKg"),
  k_totalRejeitoPct: document.getElementById("k_totalRejeitoPct"),
  k_rejeitoNaoReciclavelPct: document.getElementById("k_rejeitoNaoReciclavelPct"),
  k_rejeitoNaoReciclavelKg: document.getElementById("k_rejeitoNaoReciclavelKg"),
  k_naoComercializadoPct: document.getElementById("k_naoComercializadoPct"),
  k_naoComercializadoKg: document.getElementById("k_naoComercializadoKg"),

  materialCards: document.getElementById("materialCards"),
  collectionPointsGrid: document.getElementById("collectionPointsGrid"),
  tableColetasBody: document.getElementById("tableColetasBody"),

  tableVisibleCount: document.getElementById("tableVisibleCount"),
  tableFilteredCount: document.getElementById("tableFilteredCount"),
  tableLastUpdate: document.getElementById("tableLastUpdate"),

  tSearch: document.getElementById("tSearch"),
  tFluxo: document.getElementById("tFluxo"),
  tEntrega: document.getElementById("tEntrega"),
  tStatus: document.getElementById("tStatus"),
  tTipoCadastro: document.getElementById("tTipoCadastro"),
  btnApplyTableFilters: document.getElementById("btnApplyTableFilters"),
  btnClearTableFilters: document.getElementById("btnClearTableFilters"),

  photoModal: document.getElementById("photoModal"),
  photoModalImg: document.getElementById("photoModalImg"),

  routeOriginLabel: document.getElementById("routeOriginLabel"),
  routeDestLabel: document.getElementById("routeDestLabel"),
  routeDistanceLabel: document.getElementById("routeDistanceLabel"),
  routeTimeLabel: document.getElementById("routeTimeLabel"),

  editModal: document.getElementById("editModal"),
  editParticipantName: document.getElementById("editParticipantName"),
  editFluxo: document.getElementById("editFluxo"),
  editEntrega: document.getElementById("editEntrega"),
  editPesoBase: document.getElementById("editPesoBase"),
  editQualidade: document.getElementById("editQualidade"),
  editRejeito: document.getElementById("editRejeito"),
  editNaoComercializado: document.getElementById("editNaoComercializado"),
  editPlasticoKg: document.getElementById("editPlasticoKg"),
  editVidroKg: document.getElementById("editVidroKg"),
  editAluminioMetalKg: document.getElementById("editAluminioMetalKg"),
  editSacariaKg: document.getElementById("editSacariaKg"),
  editPapelMistoKg: document.getElementById("editPapelMistoKg"),
  editPapelaoKg: document.getElementById("editPapelaoKg"),
  editIsoporKg: document.getElementById("editIsoporKg"),
  editOleoKg: document.getElementById("editOleoKg"),
  editObs: document.getElementById("editObs"),
  btnSaveEdit: document.getElementById("btnSaveEdit")
};

/* =========================
   STATE
========================= */

let coopProfile = null;
let pageTerritoryId = "";

let allColetas = [];
let filteredColetas = [];
let tableFilteredColetas = [];
let participantsMap = new Map();

let activeEditId = null;

let mainChart = null;
let secA = null;
let secB = null;
let secC = null;
let weightTimelineChart = null;

let routeMap = null;
let routeControl = null;
let routeMarkersLayer = null;

let activeUnsubscribe = null;
let activeParticipantsUnsubscribe = null;

/* Paginação da Seção 6 */
let tablePage = 0;
const tablePageSize = 10;

/* =========================
   UTILS
========================= */

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeTerritory(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

function getTerritoryAliases(value) {
  const v = normalizeTerritory(value);

  if (v === "vila-pinto" || v === "crgr-vila-pinto") {
    return ["vila-pinto", "crgr-vila-pinto"];
  }

  if (["cooadesc", "coadesc", "crgr-cooadesc", "crgr-coadesc"].includes(v)) {
    return ["cooadesc", "coadesc", "crgr-cooadesc", "crgr-coadesc"];
  }

  if (v === "padre-cacique" || v === "crgr-padre-cacique") {
    return ["padre-cacique", "crgr-padre-cacique"];
  }

  return v ? [v] : [];
}

function sameTerritoryValue(a, b) {
  return getTerritoryAliases(b).includes(normalizeTerritory(a));
}

function resolvePageTerritory(profile) {
  const bodyTerritory = normalizeTerritory(document.body?.dataset?.territoryId || "");
  const urlTerritory = normalizeTerritory(new URLSearchParams(window.location.search).get("territory") || "");
  const userTerritory = normalizeTerritory(profile?.territoryId || "");

  return bodyTerritory || urlTerritory || userTerritory || "vila-pinto";
}

function itemBelongsToPageTerritory(item = {}) {
  const aliases = getTerritoryAliases(pageTerritoryId);

  if (!aliases.length) return true;

  const code = String(
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.familyCode ||
    item.code ||
    item.payloadSnapshot?.participantCode ||
    item.payloadSnapshot?.codigoParticipante ||
    item.payloadSnapshot?.familyCode ||
    ""
  ).trim().toUpperCase();

  const territoryFields = [
    item.territoryId,
    item.territory,
    item.territorio,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeName,
    item.cooperativa,
    item.localCrgr,
    item.crgr,
    item.payloadSnapshot?.territoryId,
    item.payloadSnapshot?.territory,
    item.payloadSnapshot?.territorio,
    item.payloadSnapshot?.cooperativeId,
    item.payloadSnapshot?.cooperativaId,
    item.payloadSnapshot?.cooperativa,
    item.payloadSnapshot?.localCrgr,
    item.payloadSnapshot?.crgr
  ].filter(Boolean);

  if (territoryFields.some((value) => aliases.includes(normalizeTerritory(value)))) {
    return true;
  }

  if (aliases.includes("vila-pinto")) {
    return code.startsWith("VPD") || code.startsWith("C") || code.startsWith("F");
  }

  if (aliases.includes("cooadesc") || aliases.includes("coadesc")) {
    return code.startsWith("COA") || code.startsWith("COO");
  }

  if (aliases.includes("padre-cacique")) {
    return code.startsWith("PC") || code.startsWith("PCA") || code.startsWith("PDC");
  }

  return false;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateBR(value) {
  if (!value) return "—";

  try {
    const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
    return new Intl.DateTimeFormat("pt-BR").format(date);
  } catch {
    return "—";
  }
}

function formatDateTimeBR(value) {
  if (!value) return "—";

  try {
    const date = typeof value === "string" ? new Date(value) : value;

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  } catch {
    return "—";
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatKg(value) {
  return `${formatNumber(value)} kg`;
}

function formatMoneyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}
function toNumber(value) {

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const parsed = Number(
    String(value)
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function sumAliases(obj, aliases = []) {

  return aliases.reduce(
    (acc, key) =>
      acc + toNumber(obj?.[key]),
    0
  );
}

function inferDateISO(item = {}) {

  const candidates = [
    item.dataColeta,
    item.date,
    item.data,
    item.createdAtISO,
    item.createdAt?.toDate?.()?.toISOString?.(),
    item.payloadSnapshot?.dataColeta,
    item.payloadSnapshot?.date
  ];

  for (const candidate of candidates) {

    if (!candidate) continue;

    const parsed =
      candidate instanceof Date
        ? candidate
        : new Date(candidate);

    if (!Number.isNaN(parsed.getTime())) {

      return parsed
        .toISOString()
        .slice(0, 10);
    }
  }

  return "";
}

function inferDateObject(item = {}) {

  const iso =
    inferDateISO(item);

  return iso
    ? new Date(`${iso}T12:00:00`)
    : null;
}

function inferFluxo(item = {}) {

  const raw = normalizeText(
    item.flowType ||
    item.fluxo ||
    item.tipoFluxo ||
    item.payloadSnapshot?.flowType
  );

  if (
    raw.includes("final") ||
    raw.includes("turno")
  ) {
    return "final_turno";
  }

  return "recebimento";
}

function inferEntrega(item = {}) {

  return normalizeText(
    item.deliveryType ||
    item.entrega ||
    item.tipoEntrega ||
    item.payloadSnapshot?.deliveryType ||
    "normal"
  );
}

function inferObservacao(item = {}) {

  return (
    item.observacao ||
    item.obs ||
    item.notes ||
    item.payloadSnapshot?.observacao ||
    ""
  );
}

function getStatus(item = {}) {

  return (
    item.status ||
    item.situacao ||
    item.state ||
    "ativo"
  );
}

function resolveHumanStatus(item = {}) {

  const raw =
    normalizeText(getStatus(item));

  if (
    raw.includes("cancel")
  ) {
    return "Cancelado";
  }

  if (
    raw.includes("edit")
  ) {
    return "Editado";
  }

  return "Ativo";
}

function isActiveCollection(item = {}) {

  const status =
    normalizeText(
      getStatus(item)
    );

  return !(
    status.includes("cancel")
  );
}

function resolveParticipant(item = {}) {

  const code = String(
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.familyCode ||
    item.payloadSnapshot?.participantCode ||
    ""
  ).trim();

  const participant =
    participantsMap.get(code);

  return {
    code,
    name:
      participant?.name ||
      item.participantName ||
      item.nomeParticipante ||
      item.payloadSnapshot?.participantName ||
      "Participante",

    type:
      participant?.type ||
      item.participantType ||
      "participante",

    address:
      participant?.address ||
      item.enderecoCompleto ||
      item.payloadSnapshot?.enderecoCompleto ||
      "",

    lat:
      participant?.lat ||
      item.lat ||
      item.payloadSnapshot?.lat ||
      null,

    lng:
      participant?.lng ||
      item.lng ||
      item.payloadSnapshot?.lng ||
      null
  };
}

function inferMaterialValue(
  item,
  key
) {

  const aliases =
    MATERIAL_ALIASES[key] || [];

  let total = 0;

  aliases.forEach((alias) => {

    total +=
      toNumber(item?.[alias]);

    total +=
      toNumber(
        item?.payloadSnapshot?.[alias]
      );

    total +=
      toNumber(
        item?.materials?.[alias]
      );

    total +=
      toNumber(
        item?.payloadSnapshot?.materials?.[alias]
      );
  });

  return total;
}

function inferTotalReciclavelRegistro(
  item
) {

  return MATERIAL_META.reduce(
    (acc, material) => {

      if (
        material.key === "oleoKg"
      ) {
        return acc;
      }

      return (
        acc +
        inferMaterialValue(
          item,
          material.key
        )
      );
    },
    0
  );
}

function inferTotalRejeitoRegistro(
  item
) {

  return (
    toNumber(item.rejeitoKg) +
    toNumber(item.rejeito) +
    toNumber(item.payloadSnapshot?.rejeitoKg)
  );
}

function inferNaoComercializado(
  item
) {

  return (
    toNumber(item.naoComercializadoKg) +
    toNumber(item.naoComercializado) +
    toNumber(
      item.payloadSnapshot?.naoComercializadoKg
    )
  );
}

function inferQualidade(item) {

  return (
    toNumber(item.qualidade) ||
    toNumber(item.qualidadeMedia) ||
    toNumber(
      item.payloadSnapshot?.qualidade
    ) ||
    0
  );
}

/* =========================
   STATUS BADGE
========================= */

function statusBadge(item) {

  const status =
    resolveHumanStatus(item);

  const cls =
    normalizeText(status);

  return `
    <span class="
      status-badge
      ${cls}
    ">
      ${escapeHtml(status)}
    </span>
  `;
}

/* =========================
   SVG MATERIAIS
========================= */

function getMaterialSVG(icon) {

  const icons = {

    plastico: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M8 3H16L18 8V21H6V8L8 3Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M9 8H15" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    vidro: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 2H15V6L17 10V21H7V10L9 6V2Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    metal: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 7L12 3L20 7V17L12 21L4 17V7Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    papel: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M7 3H14L18 7V21H7V3Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M14 3V7H18" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    papelao: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    sacaria: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M9 3H15L13 6H11L9 3Z" stroke="currentColor" stroke-width="1.8"/>
        <path d="M7 6H17L19 11L16 21H8L5 11L7 6Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    isopor: `
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    oleo: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3C12 3 7 9 7 13A5 5 0 0 0 17 13C17 9 12 3 12 3Z" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `
  };

  return icons[icon] || icons.plastico;
}

/* =========================
   FILTROS
========================= */

function getFilters() {

  return {
    participant:
      normalizeText(
        els.fParticipantCode?.value
      ),

    fluxo:
      els.fFluxo?.value ||
      "__all__",

    entrega:
      els.fEntrega?.value ||
      "__all__",

    ini:
      els.fIni?.value || "",

    fim:
      els.fFim?.value || "",

    busca:
      normalizeText(
        els.fBusca?.value
      )
  };
}

function getTableFilters() {

  return {
    search:
      normalizeText(
        els.tSearch?.value
      ),

    fluxo:
      els.tFluxo?.value ||
      "__all__",

    entrega:
      els.tEntrega?.value ||
      "__all__",

    status:
      els.tStatus?.value ||
      "__all__",

    tipoCadastro:
      els.tTipoCadastro?.value ||
      "__all__"
  };
}
/* =========================
   FIREBASE / PERFIL
========================= */

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    return {
      id: uid,
      name: auth.currentUser?.email || "Usuário",
      role: "admin",
      status: "active",
      territoryId: document.body?.dataset?.territoryId || "vila-pinto"
    };
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}

function validateProfile(profile) {
  const active =
    profile.status === "active" ||
    profile.status === "aprovado" ||
    profile.active === true ||
    !profile.status;

  if (!active) {
    throw new Error("Usuário sem acesso ativo.");
  }
}

function fillUser(profile) {
  if (els.userDisplayName) {
    els.userDisplayName.textContent =
      profile.displayName ||
      profile.name ||
      profile.nome ||
      "Usuário";
  }

  if (els.userRole) {
    els.userRole.textContent =
      profile.role || "cooperativa";
  }

  if (els.userTerritory) {
    els.userTerritory.textContent =
      profile.territoryLabel ||
      profile.territoryId ||
      pageTerritoryId ||
      "—";
  }
}

function loadParticipantsMap() {
  if (activeParticipantsUnsubscribe) {
    activeParticipantsUnsubscribe();
    activeParticipantsUnsubscribe = null;
  }

  activeParticipantsUnsubscribe = onSnapshot(
    collection(db, "participants"),
    (snapshot) => {
      participantsMap.clear();

      snapshot.forEach((docItem) => {
        const data = docItem.data();

        if (!itemBelongsToPageTerritory(data)) return;

        const code = String(
          data.participantCode ||
          data.familyCode ||
          data.codigo ||
          docItem.id
        ).trim();

        const payload = {
          id: docItem.id,
          code,
          name:
            data.name ||
            data.nome ||
            data.participantName ||
            "Sem nome",
          type:
            data.participantType ||
            data.type ||
            data.localType ||
            "participante",
          status:
            data.status ||
            data.decision ||
            "—",
          address:
            data.enderecoCompleto ||
            data.address?.full ||
            [
              data.rua,
              data.numero,
              data.bairro,
              data.cidade,
              data.uf
            ].filter(Boolean).join(", "),
          lat:
            data.lat ||
            data.latitude ||
            data.coords?.lat ||
            null,
          lng:
            data.lng ||
            data.longitude ||
            data.coords?.lng ||
            null,
          territoryId:
            data.territoryId || ""
        };

        participantsMap.set(docItem.id, payload);

        if (code) {
          participantsMap.set(code, payload);
        }

        if (data.participantCode) {
          participantsMap.set(String(data.participantCode), payload);
        }

        if (data.familyCode) {
          participantsMap.set(String(data.familyCode), payload);
        }

        if (data.codigo) {
          participantsMap.set(String(data.codigo), payload);
        }
      });

      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar participantes:", error);
    }
  );
}

function listenColetas() {
  if (els.dbStatus) {
    els.dbStatus.textContent = "conectando…";
  }

  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  activeUnsubscribe = onSnapshot(
    collection(db, "coletas"),
    (snapshot) => {
      let loaded = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));

      const totalOriginal = loaded.length;

      loaded = loaded
        .filter(itemBelongsToPageTerritory)
        .sort((a, b) => {
          const dateA = inferDateObject(a)?.getTime() || 0;
          const dateB = inferDateObject(b)?.getTime() || 0;
          return dateB - dateA;
        });

      allColetas = loaded;

      if (els.dbStatus) {
        els.dbStatus.textContent =
          `conectado • ${loaded.length}/${totalOriginal} coletas`;
      }

      populateFilters(allColetas);
      setDefaultDateRange(allColetas);
      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar coletas:", error);

      if (els.dbStatus) {
        els.dbStatus.textContent = "erro";
      }

      alert("Não foi possível carregar os registros das coletas.");
    }
  );
}

/* =========================
   FILTROS PRINCIPAIS
========================= */

function populateFilters(items = []) {
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "__all__") {
      entregas.add(entrega);
    }
  });

  const buildOptions = (current, placeholder) => {
    const options =
      `<option value="__all__">${placeholder}</option>` +
      Array.from(entregas)
        .sort()
        .map((item) => {
          return `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
        })
        .join("");

    return {
      options,
      value: entregas.has(current) ? current : "__all__"
    };
  };

  if (els.fEntrega) {
    const current = els.fEntrega.value || "__all__";
    const result = buildOptions(current, "Todos");
    els.fEntrega.innerHTML = result.options;
    els.fEntrega.value = result.value;
  }

  if (els.tEntrega) {
    const current = els.tEntrega.value || "__all__";
    const result = buildOptions(current, "Todas");
    els.tEntrega.innerHTML = result.options;
    els.tEntrega.value = result.value;
  }
}

function setDefaultDateRange(items = []) {
  if (!els.fIni || !els.fFim) return;
  if (els.fIni.value || els.fFim.value) return;

  const dates = items
    .map(inferDateISO)
    .filter(Boolean)
    .sort();

  if (!dates.length) return;

  els.fIni.value = dates[0];
  els.fFim.value = dates[dates.length - 1];
}

function showQuickParticipantPreviewByCode(code) {
  if (!els.quickParticipantPreview) return;

  const normalized = String(code || "").trim();

  if (!normalized) {
    els.quickParticipantPreview.classList.add("hidden");
    return;
  }

  const participant = participantsMap.get(normalized);

  if (!participant) {
    els.quickParticipantPreview.classList.add("hidden");
    return;
  }

  els.quickParticipantPreview.classList.remove("hidden");

  if (els.quickParticipantName) {
    els.quickParticipantName.textContent = participant.name || "—";
  }

  if (els.quickParticipantCode) {
    els.quickParticipantCode.textContent = participant.code || normalized;
  }

  if (els.quickParticipantType) {
    els.quickParticipantType.textContent = participant.type || "—";
  }

  if (els.quickParticipantStatus) {
    els.quickParticipantStatus.textContent = participant.status || "—";
  }

  if (els.quickParticipantAddress) {
    els.quickParticipantAddress.textContent = participant.address || "—";
  }
}

function applyFilters() {
  const filters = getFilters();

  showQuickParticipantPreviewByCode(filters.participant);

  filteredColetas = allColetas.filter((item) => {
    const participant = resolveParticipant(item);
    const date = inferDateISO(item);
    const fluxo = inferFluxo(item);
    const entrega = inferEntrega(item);

    if (filters.participant) {
      const haystack = normalizeText([
        participant.code,
        participant.name,
        item.participantCode,
        item.codigoParticipante,
        item.familyCode
      ].join(" "));

      if (!haystack.includes(filters.participant)) {
        return false;
      }
    }

    if (filters.fluxo !== "__all__" && fluxo !== filters.fluxo) {
      return false;
    }

    if (filters.entrega !== "__all__" && entrega !== filters.entrega) {
      return false;
    }

    if (filters.ini && date && date < filters.ini) {
      return false;
    }

    if (filters.fim && date && date > filters.fim) {
      return false;
    }

    if (filters.busca) {
      const haystack = normalizeText([
        participant.name,
        participant.code,
        participant.address,
        fluxo,
        entrega,
        getStatus(item),
        inferObservacao(item),
        JSON.stringify(item)
      ].join(" "));

      if (!haystack.includes(filters.busca)) {
        return false;
      }
    }

    return true;
  });

  updateTopInfo();
  renderKpis(filteredColetas);
  renderExpandedPanel(filteredColetas);
  renderWeightTimeline(filteredColetas);
  renderCharts(filteredColetas);
  renderCollectionPoints(filteredColetas);
  applyTableFilters();
}

function clearFilters() {
  if (els.fParticipantCode) els.fParticipantCode.value = "";
  if (els.fFluxo) els.fFluxo.value = "__all__";
  if (els.fEntrega) els.fEntrega.value = "__all__";
  if (els.fIni) els.fIni.value = "";
  if (els.fFim) els.fFim.value = "";
  if (els.fBusca) els.fBusca.value = "";

  if (els.quickParticipantPreview) {
    els.quickParticipantPreview.classList.add("hidden");
  }

  applyFilters();
}

function updateTopInfo() {
  if (els.txtRegistrosTopo) {
    els.txtRegistrosTopo.textContent = String(filteredColetas.length);
  }

  if (!els.txtPeriodo) return;

  const dates = filteredColetas
    .map(inferDateISO)
    .filter(Boolean)
    .sort();

  if (!dates.length) {
    els.txtPeriodo.textContent = "—";
    return;
  }

  els.txtPeriodo.textContent =
    `${formatDateBR(dates[0])} → ${formatDateBR(dates[dates.length - 1])}`;
}

/* =========================
   KPIs / CARDS
========================= */

function renderKpis(items = []) {
  const ativos = items.filter(isActiveCollection);
  const participantes = new Set();

  let reciclavel = 0;
  let rejeito = 0;
  let finalTurno = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);

    if (participant.code) {
      participantes.add(participant.code);
    }

    reciclavel += inferTotalReciclavelRegistro(item);
    rejeito += inferTotalRejeitoRegistro(item);

    if (inferFluxo(item) === "final_turno") {
      finalTurno += 1;
    }
  });

  if (els.k_totalColetas) els.k_totalColetas.textContent = String(ativos.length);
  if (els.k_participantes) els.k_participantes.textContent = String(participantes.size);
  if (els.k_residuoSeco) els.k_residuoSeco.textContent = formatNumber(reciclavel);
  if (els.k_rejeito) els.k_rejeito.textContent = formatNumber(rejeito);
  if (els.k_finalTurno) els.k_finalTurno.textContent = String(finalTurno);
}

function computeExpandedMetrics(items = []) {
  const ativos = items.filter(isActiveCollection);
  const materialTotals = {};

  MATERIAL_META.forEach((mat) => {
    materialTotals[mat.key] = 0;
  });

  const dias = new Set();
  const participantes = new Set();
  const condominios = new Set();
  const comercios = new Set();

  let reciclavelKg = 0;
  let rejeitoKg = 0;
  let naoComercializadoKg = 0;
  let entregaVoluntaria = 0;
  let receitaTotal = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);
    const date = inferDateISO(item);
    const tipo = normalizeText(participant.type);

    if (date) dias.add(date);
    if (participant.code) participantes.add(participant.code);

    if (tipo.includes("condominio") || tipo.includes("condomínio")) {
      condominios.add(participant.code || participant.name);
    }

    if (tipo.includes("comercio") || tipo.includes("comércio")) {
      comercios.add(participant.code || participant.name);
    }

    if (inferEntrega(item).includes("volunt")) {
      entregaVoluntaria += 1;
    }

    MATERIAL_META.forEach((mat) => {
      const kg = inferMaterialValue(item, mat.key);
      materialTotals[mat.key] += kg;
      receitaTotal += kg * mat.price;
    });

    reciclavelKg += inferTotalReciclavelRegistro(item);
    rejeitoKg += inferTotalRejeitoRegistro(item);
    naoComercializadoKg += inferNaoComercializado(item);
  });

  const totalGeral = reciclavelKg + rejeitoKg;
  const reciclavelPct = totalGeral ? (reciclavelKg / totalGeral) * 100 : 0;
  const rejeitoPct = totalGeral ? (rejeitoKg / totalGeral) * 100 : 0;
  const naoComercializadoPct = rejeitoKg ? (naoComercializadoKg / rejeitoKg) * 100 : 0;
  const rejeitoNaoReciclavelKg = Math.max(0, rejeitoKg - naoComercializadoKg);
  const rejeitoNaoReciclavelPct = rejeitoKg ? (rejeitoNaoReciclavelKg / rejeitoKg) * 100 : 0;

  return {
    materialTotals,
    reciclavelKg,
    rejeitoKg,
    naoComercializadoKg,
    naoComercializadoPct,
    rejeitoNaoReciclavelKg,
    rejeitoNaoReciclavelPct,
    reciclavelPct,
    rejeitoPct,
    receitaTotal,
    totalDiasProjeto: dias.size,
    operacoesRealizadas: ativos.length,
    participantesProjeto: participantes.size,
    condominiosParticipantes: condominios.size,
    comercioParticipantes: comercios.size,
    entregaVoluntaria
  };
}

function renderExpandedPanel(items = []) {
  const m = computeExpandedMetrics(items);
  const dates = items.map(inferDateISO).filter(Boolean).sort();

  if (els.k_totalDiasProjeto) els.k_totalDiasProjeto.textContent = String(m.totalDiasProjeto);
  if (els.k_inicioProjeto) els.k_inicioProjeto.textContent = `Início: ${dates[0] ? formatDateBR(dates[0]) : "—"}`;
  if (els.k_operacoesRealizadas) els.k_operacoesRealizadas.textContent = String(m.operacoesRealizadas);
  if (els.k_participantesProjeto) els.k_participantesProjeto.textContent = String(m.participantesProjeto);
  if (els.k_condominiosParticipantes) els.k_condominiosParticipantes.textContent = String(m.condominiosParticipantes);
  if (els.k_entregaVoluntaria) els.k_entregaVoluntaria.textContent = String(m.entregaVoluntaria);
  if (els.k_comercioParticipantes) els.k_comercioParticipantes.textContent = String(m.comercioParticipantes);

  if (els.k_totalReciclavelKg) els.k_totalReciclavelKg.textContent = formatNumber(m.reciclavelKg);
  if (els.k_totalReciclavelPct) els.k_totalReciclavelPct.textContent = `${formatNumber(m.reciclavelPct)}%`;
  if (els.k_receitaTotal) els.k_receitaTotal.textContent = formatMoneyBR(m.receitaTotal);
  if (els.k_totalRejeitoKg) els.k_totalRejeitoKg.textContent = formatNumber(m.rejeitoKg);
  if (els.k_totalRejeitoPct) els.k_totalRejeitoPct.textContent = `${formatNumber(m.rejeitoPct)}%`;

  if (els.k_rejeitoNaoReciclavelPct) els.k_rejeitoNaoReciclavelPct.textContent = `${formatNumber(m.rejeitoNaoReciclavelPct)}%`;
  if (els.k_rejeitoNaoReciclavelKg) els.k_rejeitoNaoReciclavelKg.textContent = formatKg(m.rejeitoNaoReciclavelKg);
  if (els.k_naoComercializadoPct) els.k_naoComercializadoPct.textContent = `${formatNumber(m.naoComercializadoPct)}%`;
  if (els.k_naoComercializadoKg) els.k_naoComercializadoKg.textContent = formatKg(m.naoComercializadoKg);

  if (!els.materialCards) return;

  const totalMateriais = Object.values(m.materialTotals).reduce((acc, value) => acc + value, 0);

  els.materialCards.innerHTML = MATERIAL_META.map((mat) => {
    const kg = m.materialTotals[mat.key] || 0;
    const pct = totalMateriais ? (kg / totalMateriais) * 100 : 0;
    const receita = kg * mat.price;

    return `
      <article class="material-card professional-card ${mat.isSpecial ? "special-flow-card" : ""}" style="--material-color:${mat.color}">
        <div class="material-top">
          <div class="icon-group">
            <div class="mat-icon professional-icon">
              ${getMaterialSVG(mat.icon)}
            </div>
          </div>

          <div class="mat-pct">
            ${mat.isSpecial ? "Fluxo especial" : `${formatNumber(pct)}%`}
          </div>
        </div>

        <div class="mat-name">${escapeHtml(mat.label)}</div>
        <div class="mat-kg">${formatNumber(kg)} kg</div>

        <div class="material-progress" aria-hidden="true">
          <span style="width:${mat.isSpecial ? 100 : Math.min(pct, 100)}%"></span>
        </div>

        <div class="mat-sub">Receita estimada ≈ ${formatMoneyBR(receita)}</div>
      </article>
    `;
  }).join("");
}
/* =========================
   GRÁFICOS
========================= */

function getChartOptions(type = "bar") {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 16
        }
      }
    }
  };

  if (type === "doughnut" || type === "pie") {
    return base;
  }

  return {
    ...base,
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: "#64748B",
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(148,163,184,.15)"
        },
        ticks: {
          color: "#64748B"
        }
      }
    }
  };
}

function buildWeightDailySeries(items = []) {
  const grouped = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const date = inferDateISO(item);
    if (!date) return;

    const fluxo = inferFluxo(item);
    const key = `${date}_${fluxo}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        date,
        fluxo,
        reciclavel: 0,
        rejeito: 0,
        quantidade: 0
      });
    }

    const current = grouped.get(key);

    current.reciclavel += inferTotalReciclavelRegistro(item);
    current.rejeito += inferTotalRejeitoRegistro(item);
    current.quantidade += 1;
  });

  const ordered = Array.from(grouped.values()).sort((a, b) => {
    return `${a.date}_${a.fluxo}`.localeCompare(`${b.date}_${b.fluxo}`);
  });

  return {
    labels: ordered.map((item) => {
      const fluxoLabel =
        item.fluxo === "final_turno"
          ? "Final turno"
          : "Recebimento";

      return `${formatDateBR(item.date)} • ${fluxoLabel}`;
    }),
    reciclavel: ordered.map((item) => Number(item.reciclavel.toFixed(2))),
    rejeito: ordered.map((item) => Number(item.rejeito.toFixed(2))),
    quantidade: ordered.map((item) => item.quantidade)
  };
}

function renderWeightTimeline(items = []) {
  const canvas = document.getElementById("weightTimelineChart");

  if (!canvas || typeof Chart === "undefined") return;

  const daily = buildWeightDailySeries(items);

  if (weightTimelineChart) {
    weightTimelineChart.destroy();
  }

  weightTimelineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: daily.labels,
      datasets: [
        {
          label: "Peso do rejeito",
          data: daily.rejeito,
          backgroundColor: "rgba(239,107,34,.78)",
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: "Peso do reciclável",
          data: daily.reciclavel,
          backgroundColor: "rgba(129,185,42,.82)",
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      ...getChartOptions("bar"),
      plugins: {
        ...getChartOptions("bar").plugins,
        tooltip: {
          callbacks: {
            afterBody(context) {
              const idx = context[0].dataIndex;
              return `Coletas realizadas: ${daily.quantidade[idx]}`;
            }
          }
        }
      }
    }
  });
}

function buildDailySeries(items = []) {
  const grouped = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const date = inferDateISO(item);
    if (!date) return;

    grouped.set(date, (grouped.get(date) || 0) + 1);
  });

  const orderedDates = Array.from(grouped.keys()).sort();

  return {
    labels: orderedDates.map(formatDateBR),
    values: orderedDates.map((date) => grouped.get(date))
  };
}

function buildFlowSeries(items = []) {
  const map = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const label =
      inferFluxo(item) === "final_turno"
        ? "Final do turno"
        : "Recebimento";

    map.set(label, (map.get(label) || 0) + 1);
  });

  return {
    labels: Array.from(map.keys()),
    values: Array.from(map.values())
  };
}

function buildMaterialSeries(items = []) {
  const totals = {};

  MATERIAL_META.forEach((mat) => {
    totals[mat.key] = 0;
  });

  items.filter(isActiveCollection).forEach((item) => {
    MATERIAL_META.forEach((mat) => {
      totals[mat.key] += inferMaterialValue(item, mat.key);
    });
  });

  const ordered = MATERIAL_META.map((mat) => ({
    label: mat.label,
    value: totals[mat.key] || 0
  })).filter((item) => item.value > 0);

  return {
    labels: ordered.map((item) => item.label),
    values: ordered.map((item) => item.value)
  };
}

function buildCollectionPointsSeries(items = []) {
  const map = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const participant = resolveParticipant(item);
    const key = participant.code || participant.name || "Sem código";

    map.set(key, (map.get(key) || 0) + 1);
  });

  const ordered = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return {
    labels: ordered.map(([label]) => label),
    values: ordered.map(([, value]) => value)
  };
}

function renderCharts(items = []) {
  if (typeof Chart === "undefined") return;

  const ctxMain = document.getElementById("mainChart");
  const ctxA = document.getElementById("secA");
  const ctxB = document.getElementById("secB");
  const ctxC = document.getElementById("secC");

  [mainChart, secA, secB, secC].forEach((chart) => {
    if (chart) chart.destroy();
  });

  const daily = buildDailySeries(items);
  const flow = buildFlowSeries(items);
  const material = buildMaterialSeries(items);
  const points = buildCollectionPointsSeries(items);

  const mainType = els.chartMainType?.value || "bar";
  const flowType = els.chartFlowType?.value || "doughnut";
  const materialType = els.chartDeliveryType?.value || "bar";
  const pointsType = els.chartTerritoryType?.value || "bar";

  if (ctxMain) {
    mainChart = new Chart(ctxMain, {
      type: mainType,
      data: {
        labels: daily.labels,
        datasets: [
          {
            label: "Quantidade de coletas",
            data: daily.values,
            borderColor: CHART_COLORS.blue,
            backgroundColor: "rgba(83,172,222,.28)",
            borderRadius: 8,
            fill: mainType === "line",
            tension: 0.35,
            pointRadius: mainType === "line" ? 4 : 0
          }
        ]
      },
      options: getChartOptions(mainType)
    });
  }

  if (ctxA) {
    secA = new Chart(ctxA, {
      type: flowType,
      data: {
        labels: flow.labels,
        datasets: [
          {
            label: "Tipos de coleta",
            data: flow.values,
            backgroundColor: [
              "rgba(83,172,222,.82)",
              "rgba(129,185,42,.82)"
            ]
          }
        ]
      },
      options: getChartOptions(flowType)
    });
  }

  if (ctxB) {
    secB = new Chart(ctxB, {
      type: materialType,
      data: {
        labels: material.labels,
        datasets: [
          {
            label: "Materiais coletados",
            data: material.values,
            backgroundColor: "rgba(129,185,42,.72)",
            borderRadius: 8
          }
        ]
      },
      options: getChartOptions(materialType)
    });
  }

  if (ctxC) {
    secC = new Chart(ctxC, {
      type: pointsType,
      data: {
        labels: points.labels,
        datasets: [
          {
            label: "Pontos de coleta",
            data: points.values,
            backgroundColor: "rgba(83,172,222,.30)",
            borderRadius: 8
          }
        ]
      },
      options: {
        ...getChartOptions(pointsType),
        indexAxis: pointsType === "bar" ? "y" : "x"
      }
    });
  }
}

/* =========================
   TABELA PAGINADA
========================= */

function getCurrentPageSlice(items = []) {
  const start = tablePage * tablePageSize;
  const end = start + tablePageSize;

  return items.slice(start, end);
}

function updateTablePagination(total = 0) {
  const indicator = document.getElementById("tablePageIndicator");
  const btnPrev = document.getElementById("btnPrevColetas");
  const btnNext = document.getElementById("btnNextColetas");

  const start = total === 0 ? 0 : tablePage * tablePageSize + 1;
  const end = Math.min((tablePage + 1) * tablePageSize, total);

  if (indicator) {
    indicator.textContent =
      total > 0
        ? `Mostrando ${start}-${end} de ${total}`
        : "Nenhuma coleta";
  }

  if (btnPrev) {
    btnPrev.disabled = tablePage === 0;
  }

  if (btnNext) {
    btnNext.disabled = end >= total;
  }
}

function setupTablePagination() {
  const btnPrev = document.getElementById("btnPrevColetas");
  const btnNext = document.getElementById("btnNextColetas");

  btnPrev?.addEventListener("click", () => {
    if (tablePage <= 0) return;

    tablePage--;
    renderTable(tableFilteredColetas);
  });

  btnNext?.addEventListener("click", () => {
    const totalPages = Math.ceil(tableFilteredColetas.length / tablePageSize);

    if (tablePage >= totalPages - 1) return;

    tablePage++;
    renderTable(tableFilteredColetas);
  });
}

function applyTableFilters() {
  const filters = getTableFilters();

  tablePage = 0;

  tableFilteredColetas = filteredColetas.filter((item) => {
    const participant = resolveParticipant(item);
    const fluxo = inferFluxo(item);
    const entrega = inferEntrega(item);
    const status = normalizeText(getStatus(item));
    const tipo = normalizeText(participant.type);

    if (filters.fluxo !== "__all__" && fluxo !== filters.fluxo) return false;
    if (filters.entrega !== "__all__" && entrega !== filters.entrega) return false;

    if (filters.status !== "__all__") {
      if (filters.status === "ativo" && !isActiveCollection(item)) return false;
      if (filters.status !== "ativo" && !status.includes(filters.status)) return false;
    }

    if (filters.tipoCadastro !== "__all__") {
      if (
        filters.tipoCadastro === "condominio" &&
        !tipo.includes("condominio") &&
        !tipo.includes("condomínio")
      ) return false;

      if (
        filters.tipoCadastro === "comercio" &&
        !tipo.includes("comercio") &&
        !tipo.includes("comércio")
      ) return false;

      if (
        filters.tipoCadastro === "participante" &&
        (
          tipo.includes("condominio") ||
          tipo.includes("condomínio") ||
          tipo.includes("comercio") ||
          tipo.includes("comércio")
        )
      ) return false;
    }

    if (filters.search) {
      const haystack = normalizeText([
        participant.name,
        participant.code,
        participant.address,
        fluxo,
        entrega,
        resolveHumanStatus(item),
        inferObservacao(item),
        JSON.stringify(item)
      ].join(" "));

      if (!haystack.includes(filters.search)) return false;
    }

    return true;
  });

  renderTable(tableFilteredColetas);
}

function clearTableFilters() {
  if (els.tSearch) els.tSearch.value = "";
  if (els.tFluxo) els.tFluxo.value = "__all__";
  if (els.tEntrega) els.tEntrega.value = "__all__";
  if (els.tStatus) els.tStatus.value = "__all__";
  if (els.tTipoCadastro) els.tTipoCadastro.value = "__all__";

  tablePage = 0;
  tableFilteredColetas = [...filteredColetas];

  renderTable(tableFilteredColetas);
}

function renderTable(items = []) {
  if (!els.tableColetasBody) return;

  const total = items.length;
  const pageItems = getCurrentPageSlice(items);

  if (!pageItems.length) {
    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum registro encontrado.</td>
      </tr>
    `;
  } else {
    els.tableColetasBody.innerHTML = pageItems.map((item) => {
      const participant = resolveParticipant(item);

      return `
        <tr>
          <td>${escapeHtml(formatDateBR(inferDateISO(item)))}</td>
          <td>${escapeHtml(participant.name)}</td>
          <td>${escapeHtml(participant.code)}</td>
          <td>${escapeHtml(formatFluxoLabel(inferFluxo(item)))}</td>
          <td>${statusBadge(item)}</td>
          <td>
            <div class="details-metrics">
              <span><strong>Reciclável:</strong> ${escapeHtml(formatKg(inferTotalReciclavelRegistro(item)))}</span>
              <span><strong>Rejeito:</strong> ${escapeHtml(formatKg(inferTotalRejeitoRegistro(item)))}</span>
              <span><strong>Não comercializado:</strong> ${escapeHtml(formatKg(inferNaoComercializado(item)))}</span>
            </div>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="table-action-link" data-view="${escapeHtml(item.id)}">Ver coleta</button>
              <button type="button" class="action-btn edit" data-edit="${escapeHtml(item.id)}">Editar</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (els.tableVisibleCount) {
    els.tableVisibleCount.textContent = String(pageItems.length);
  }

  if (els.tableFilteredCount) {
    els.tableFilteredCount.textContent = String(total);
  }

  if (els.tableLastUpdate) {
    els.tableLastUpdate.textContent = formatDateTimeBR(new Date());
  }

  updateTablePagination(total);
}

/* =========================
   MODAL DETALHES
========================= */

function ensureCollectionDetailsModal() {
  let modal = document.getElementById("collectionDetailsModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "collectionDetailsModal";
  modal.className = "modal modal-scrollable";
  modal.setAttribute("aria-hidden", "true");

  modal.innerHTML = `
    <div class="modal-backdrop" data-close="collectionDetailsModal"></div>

    <div class="modal-card modal-card-collection-details">
      <button class="modal-close" type="button" data-close="collectionDetailsModal" aria-label="Fechar">×</button>

      <div class="modal-head">
        <h3>Detalhes da coleta</h3>
        <p>Visualização completa do registro salvo.</p>
      </div>

      <div class="modal-body modal-body-scroll" id="collectionDetailsContent"></div>
    </div>
  `;

  document.body.appendChild(modal);

  return modal;
}

function openCollectionDetails(id) {
  const item = allColetas.find((coleta) => String(coleta.id) === String(id));

  if (!item) return;

  const participant = resolveParticipant(item);
  const modal = ensureCollectionDetailsModal();
  const content = document.getElementById("collectionDetailsContent");

  const materialRows = MATERIAL_META.map((mat) => {
    const kg = inferMaterialValue(item, mat.key);

    return `
      <div class="coleta-info-card">
        <strong>${escapeHtml(mat.label)}:</strong>
        ${escapeHtml(formatKg(kg))}
      </div>
    `;
  }).join("");

  content.innerHTML = `
    <div class="coleta-modal-grid collection-details-fields">
      <div class="coleta-info-card"><strong>Data:</strong> ${escapeHtml(formatDateBR(inferDateISO(item)))}</div>
      <div class="coleta-info-card"><strong>Fluxo:</strong> ${escapeHtml(formatFluxoLabel(inferFluxo(item)))}</div>
      <div class="coleta-info-card"><strong>Participante:</strong> ${escapeHtml(participant.name)}</div>
      <div class="coleta-info-card"><strong>Código:</strong> ${escapeHtml(participant.code)}</div>
      <div class="coleta-info-card"><strong>Status:</strong> ${escapeHtml(resolveHumanStatus(item))}</div>
      <div class="coleta-info-card"><strong>Qualidade:</strong> ${escapeHtml(String(inferQualidade(item) || "—"))}</div>
      <div class="coleta-info-card"><strong>Peso reciclável:</strong> ${escapeHtml(formatKg(inferTotalReciclavelRegistro(item)))}</div>
      <div class="coleta-info-card"><strong>Rejeito:</strong> ${escapeHtml(formatKg(inferTotalRejeitoRegistro(item)))}</div>
      <div class="coleta-info-card"><strong>Não comercializado:</strong> ${escapeHtml(formatKg(inferNaoComercializado(item)))}</div>
      <div class="coleta-info-card collection-span-full"><strong>Observação:</strong> ${escapeHtml(inferObservacao(item) || "—")}</div>
    </div>

    <h3 style="margin:18px 0 10px;">Materiais informados</h3>

    <div class="coleta-modal-grid collection-details-fields">
      ${materialRows}
    </div>
  `;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

/* =========================
   EDIÇÃO
========================= */

function openEditModal(id) {
  const item = allColetas.find((coleta) => String(coleta.id) === String(id));

  if (!item || !els.editModal) return;

  activeEditId = id;

  const participant = resolveParticipant(item);

  if (els.editParticipantName) els.editParticipantName.textContent = `${participant.name} • ${participant.code}`;
  if (els.editFluxo) els.editFluxo.value = inferFluxo(item);
  if (els.editEntrega) els.editEntrega.value = inferEntrega(item) === "—" ? "" : inferEntrega(item);
  if (els.editPesoBase) els.editPesoBase.value = inferTotalReciclavelRegistro(item) || "";
  if (els.editQualidade) els.editQualidade.value = inferQualidade(item) || "";
  if (els.editRejeito) els.editRejeito.value = inferTotalRejeitoRegistro(item) || "";
  if (els.editNaoComercializado) els.editNaoComercializado.value = inferNaoComercializado(item) || "";

  if (els.editPlasticoKg) els.editPlasticoKg.value = inferMaterialValue(item, "plasticoKg") || "";
  if (els.editVidroKg) els.editVidroKg.value = inferMaterialValue(item, "vidroKg") || "";
  if (els.editAluminioMetalKg) els.editAluminioMetalKg.value = inferMaterialValue(item, "aluminioMetalKg") || "";
  if (els.editSacariaKg) els.editSacariaKg.value = inferMaterialValue(item, "sacariaKg") || "";
  if (els.editPapelMistoKg) els.editPapelMistoKg.value = inferMaterialValue(item, "papelMistoKg") || "";
  if (els.editPapelaoKg) els.editPapelaoKg.value = inferMaterialValue(item, "papelaoKg") || "";
  if (els.editIsoporKg) els.editIsoporKg.value = inferMaterialValue(item, "isoporKg") || "";
  if (els.editOleoKg) els.editOleoKg.value = inferMaterialValue(item, "oleoKg") || "";
  if (els.editObs) els.editObs.value = inferObservacao(item);

  els.editModal.classList.add("show");
  els.editModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

async function saveEdit() {
  if (!activeEditId) return;

  const payload = {
    fluxo: els.editFluxo?.value || "recebimento",
    flowType: els.editFluxo?.value || "recebimento",
    entrega: els.editEntrega?.value || "",
    deliveryType: els.editEntrega?.value || "",
    pesoRecebido: toNumber(els.editPesoBase?.value),
    qualidade: els.editQualidade?.value || "",
    rejeito: toNumber(els.editRejeito?.value),
    rejeitoKg: toNumber(els.editRejeito?.value),
    naoComercializado: toNumber(els.editNaoComercializado?.value),
    naoComercializadoKg: toNumber(els.editNaoComercializado?.value),
    plasticoKg: toNumber(els.editPlasticoKg?.value),
    vidroKg: toNumber(els.editVidroKg?.value),
    aluminioMetalKg: toNumber(els.editAluminioMetalKg?.value),
    sacariaKg: toNumber(els.editSacariaKg?.value),
    papelMistoKg: toNumber(els.editPapelMistoKg?.value),
    papelaoKg: toNumber(els.editPapelaoKg?.value),
    isoporKg: toNumber(els.editIsoporKg?.value),
    oleoKg: toNumber(els.editOleoKg?.value),
    observacao: els.editObs?.value || "",
    status: "editado",
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(db, "coletas", activeEditId), payload);

  closeModal("editModal");
  activeEditId = null;
}

/* =========================
   MAPA
========================= */

function getCoopBase() {
  const aliases = getTerritoryAliases(pageTerritoryId);

  if (aliases.includes("cooadesc")) return COOP_BASES.cooadesc;
  if (aliases.includes("padre-cacique")) return COOP_BASES["padre-cacique"];

  return COOP_BASES["vila-pinto"];
}

function initMap() {
  const mapEl = document.getElementById("collectionRouteMap");

  if (!mapEl || typeof L === "undefined" || routeMap) return;

  const base = getCoopBase();

  routeMap = L.map(mapEl).setView([base.lat, base.lng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(routeMap);

  routeMarkersLayer = L.layerGroup().addTo(routeMap);

  L.marker([base.lat, base.lng])
    .addTo(routeMarkersLayer)
    .bindPopup("Cooperativa");
}

function renderCollectionPoints(items = []) {
  if (!els.collectionPointsGrid) return;

  const pointsMap = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const participant = resolveParticipant(item);

    if (!participant.lat || !participant.lng) return;

    const key = participant.code || participant.name;

    if (!pointsMap.has(key)) {
      pointsMap.set(key, {
        ...participant,
        count: 0
      });
    }

    pointsMap.get(key).count += 1;
  });

  const points = Array.from(pointsMap.values());

  if (!points.length) {
    els.collectionPointsGrid.innerHTML = `
      <div class="empty-materials">
        Nenhum ponto com coordenadas localizado.
      </div>
    `;
  } else {
    els.collectionPointsGrid.innerHTML = points.map((point) => `
      <button type="button" class="point-card" data-route-code="${escapeHtml(point.code)}">
        <span class="point-code">${escapeHtml(point.code)}</span>
        <h4>${escapeHtml(point.name)}</h4>
        <div class="point-address">${escapeHtml(point.address || "Sem endereço informado")}</div>
        <div class="point-meta">
          <span class="point-chip">${point.count} coleta(s)</span>
        </div>
      </button>
    `).join("");
  }

  if (!routeMap || !routeMarkersLayer || typeof L === "undefined") return;

  routeMarkersLayer.clearLayers();

  const base = getCoopBase();

  L.marker([base.lat, base.lng])
    .addTo(routeMarkersLayer)
    .bindPopup("Cooperativa");

  points.forEach((point) => {
    L.marker([point.lat, point.lng])
      .addTo(routeMarkersLayer)
      .bindPopup(`${point.name}<br>${point.code}`);
  });

  if (points.length) {
    const bounds = L.latLngBounds([
      [base.lat, base.lng],
      ...points.map((point) => [point.lat, point.lng])
    ]);

    routeMap.fitBounds(bounds, {
      padding: [30, 30]
    });
  }
}

function renderRouteToPoint(code) {
  const point = Array.from(participantsMap.values()).find((participant) => {
    return String(participant.code) === String(code);
  });

  if (!point || !point.lat || !point.lng || !routeMap || typeof L === "undefined") return;

  const base = getCoopBase();

  if (routeControl && typeof routeMap.removeControl === "function") {
    routeMap.removeControl(routeControl);
    routeControl = null;
  }

  if (els.routeOriginLabel) els.routeOriginLabel.textContent = "Cooperativa";
  if (els.routeDestLabel) els.routeDestLabel.textContent = `${point.name} • ${point.code}`;
  if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = "calculando…";
  if (els.routeTimeLabel) els.routeTimeLabel.textContent = "calculando…";

  if (!L.Routing) {
    if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = "rota indisponível";
    if (els.routeTimeLabel) els.routeTimeLabel.textContent = "rota indisponível";
    return;
  }

  routeControl = L.Routing.control({
    waypoints: [
      L.latLng(base.lat, base.lng),
      L.latLng(point.lat, point.lng)
    ],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false
  }).addTo(routeMap);

  routeControl.on("routesfound", (event) => {
    const route = event.routes?.[0];

    if (!route) return;

    if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = `${formatNumber(route.summary.totalDistance / 1000)} km`;
    if (els.routeTimeLabel) els.routeTimeLabel.textContent = `${formatNumber(route.summary.totalTime / 60)} min`;
  });
}

/* =========================
   EXPORTAÇÃO
========================= */

function getExportBaseItems() {
  return Array.isArray(tableFilteredColetas) && tableFilteredColetas.length
    ? tableFilteredColetas
    : filteredColetas;
}

function getExportRows(items = []) {
  return items.map((item) => {
    const participant = resolveParticipant(item);

    const row = {
      Data: formatDateBR(inferDateISO(item)),
      Participante: participant.name || "—",
      Código: participant.code || "—",
      Fluxo: formatFluxoLabel(inferFluxo(item)),
      Entrega: inferEntrega(item),
      Status: resolveHumanStatus(item),
      "Reciclável kg": Number(inferTotalReciclavelRegistro(item) || 0),
      "Rejeito kg": Number(inferTotalRejeitoRegistro(item) || 0),
      "Não comercializado kg": Number(inferNaoComercializado(item) || 0),
      Qualidade: inferQualidade(item) || "—",
      Observação: inferObservacao(item) || ""
    };

    MATERIAL_META.forEach((mat) => {
      row[mat.label] = Number(inferMaterialValue(item, mat.key) || 0);
    });

    return row;
  });
}

function buildExportFileStamp() {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}_${hh}-${mi}`;
}

async function exportExcel() {
  if (typeof XLSX === "undefined") {
    alert("Biblioteca XLSX não carregada.");
    return;
  }

  const rows = getExportRows(getExportBaseItems());
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Coletas");
  XLSX.writeFile(wb, `dashboard-coletas-${buildExportFileStamp()}.xlsx`);
}

async function exportPDF() {
  if (!window.jspdf?.jsPDF) {
    alert("Biblioteca jsPDF não carregada.");
    return;
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });

  const rows = getExportRows(getExportBaseItems());

  pdf.setFontSize(16);
  pdf.text("Dashboard de Coletas Seletivas", 40, 40);

  pdf.setFontSize(10);
  pdf.text(`Emitido em ${formatDateTimeBR(new Date())}`, 40, 58);

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable({
      startY: 80,
      head: [Object.keys(rows[0] || {})],
      body: rows.map((row) => Object.values(row)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [129, 185, 42] }
    });
  }

  pdf.save(`dashboard-coletas-${buildExportFileStamp()}.pdf`);
}

/* =========================
   MODAIS / EVENTOS
========================= */

function closeModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.remove("show", "open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function bindEvents() {
  els.btnAplicar?.addEventListener("click", applyFilters);
  els.btnLimpar?.addEventListener("click", clearFilters);

  els.fParticipantCode?.addEventListener("input", () => {
    showQuickParticipantPreviewByCode(els.fParticipantCode.value);
  });

  els.fBusca?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyFilters();
  });

  els.btnPrint?.addEventListener("click", () => window.print());
  els.btnExportExcel?.addEventListener("click", exportExcel);
  els.btnExportPDF?.addEventListener("click", exportPDF);

  els.chartMainType?.addEventListener("change", () => renderCharts(filteredColetas));
  els.chartFlowType?.addEventListener("change", () => renderCharts(filteredColetas));
  els.chartDeliveryType?.addEventListener("change", () => renderCharts(filteredColetas));
  els.chartTerritoryType?.addEventListener("change", () => renderCharts(filteredColetas));

  els.btnApplyTableFilters?.addEventListener("click", applyTableFilters);
  els.btnClearTableFilters?.addEventListener("click", clearTableFilters);

  els.tSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyTableFilters();
  });

  els.btnSaveEdit?.addEventListener("click", async () => {
    try {
      await saveEdit();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar edição.");
    }
  });

  document.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-close]");

    if (closeBtn) {
      closeModal(closeBtn.dataset.close);
      return;
    }

    const viewBtn = event.target.closest("[data-view]");

    if (viewBtn) {
      openCollectionDetails(viewBtn.dataset.view);
      return;
    }

    const editBtn = event.target.closest("[data-edit]");

    if (editBtn) {
      openEditModal(editBtn.dataset.edit);
      return;
    }

    const routeBtn = event.target.closest("[data-route-code]");

    if (routeBtn) {
      renderRouteToPoint(routeBtn.dataset.routeCode);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    document.querySelectorAll(".modal.show,.modal.open").forEach((modal) => {
      closeModal(modal.id);
    });
  });
}

/* =========================
   BOOT
========================= */

function boot() {
  bindEvents();
  setupTablePagination();
  initMap();

  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const profile = await getUserProfile(user.uid);

      validateProfile(profile);

      coopProfile = profile;
      pageTerritoryId = resolvePageTerritory(profile);

      fillUser(profile);

      loadParticipantsMap();
      listenColetas();
    } catch (error) {
      console.error("Erro ao iniciar dashboard:", error);

      if (els.dbStatus) {
        els.dbStatus.textContent = "erro";
      }

      alert(error.message || "Não foi possível carregar o dashboard.");
    }
  });
}

boot();