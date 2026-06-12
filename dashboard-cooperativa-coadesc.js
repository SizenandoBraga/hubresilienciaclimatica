import { auth, db } from "./firebase-init-coadesc.js";

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

/* =========================================================
   DASHBOARD COOPERATIVA • NSRU
   JS COMPLETO • FIREBASE + FILTROS + GRÁFICOS + TABELA
   Atualizado com:
   - correção do formatFluxoLabel
   - datas Firebase Timestamp
   - filtro de território mais tolerante
   - materiais SVG
   - tabela paginada de 10 em 10
   - proteção contra erros de renderização
========================================================= */

/* =========================
   CONFIGURAÇÕES
========================= */

const MATERIAL_META = [
  {
    key: "plasticoKg",
    label: "Plástico",
    price: 1.92,
    color: "#2E7D32",
    icon: "plastico"
  },
  {
    key: "vidroKg",
    label: "Vidro",
    price: 0.08,
    color: "#0288D1",
    icon: "vidro"
  },
  {
    key: "aluminioMetalKg",
    label: "Metal / Alumínio",
    price: 2.9,
    color: "#757575",
    icon: "metal"
  },
  {
    key: "sacariaKg",
    label: "Sacaria",
    price: 0.12,
    color: "#8D6E63",
    icon: "sacaria"
  },
  {
    key: "papelMistoKg",
    label: "Papel misto",
    price: 0.66,
    color: "#1565C0",
    icon: "papel"
  },
  {
    key: "papelaoKg",
    label: "Papelão",
    price: 0.52,
    color: "#A65A2A",
    icon: "papelao"
  },
  {
    key: "isoporKg",
    label: "Isopor",
    price: 0.4,
    color: "#00ACC1",
    icon: "isopor"
  },
  {
    key: "oleoKg",
    label: "Óleo de cozinha",
    price: 1.5,
    color: "#C79200",
    icon: "oleo",
    isSpecial: true
  }
];

const MATERIAL_ALIASES = {
  plasticoKg: [
    "plasticoKg",
    "plastico",
    "plástico",
    "pesoPlasticoKg",
    "pesoPlásticoKg",
    "plasticoPesoKg",
    "plastico_total",
    "plasticoTotal"
  ],
  vidroKg: [
    "vidroKg",
    "vidro",
    "pesoVidroKg",
    "vidroPesoKg",
    "vidro_total",
    "vidroTotal"
  ],
  aluminioMetalKg: [
    "aluminioMetalKg",
    "aluminioKg",
    "alumínioKg",
    "metalKg",
    "metal",
    "aluminio",
    "alumínio",
    "metalAluminioKg",
    "metalAlumínioKg",
    "pesoMetalKg",
    "pesoAluminioKg",
    "pesoAlumínioKg"
  ],
  sacariaKg: [
    "sacariaKg",
    "sacaria",
    "pesoSacariaKg"
  ],
  papelMistoKg: [
    "papelMistoKg",
    "papelMisto",
    "papelKg",
    "papel",
    "pesoPapelMistoKg",
    "pesoPapelKg"
  ],
  papelaoKg: [
    "papelaoKg",
    "papelãoKg",
    "papelao",
    "papelão",
    "pesoPapelaoKg",
    "pesoPapelãoKg"
  ],
  isoporKg: [
    "isoporKg",
    "isopor",
    "pesoIsoporKg"
  ],
  oleoKg: [
    "oleoKg",
    "óleoKg",
    "oleo",
    "óleo",
    "oleoCozinhaKg",
    "óleoCozinhaKg",
    "oleoDeCozinhaKg",
    "óleoDeCozinhaKg",
    "litrosOleo",
    "litrosÓleo",
    "oleoLitros",
    "óleoLitros"
  ]
};

const CHART_COLORS = {
  blue: "#53ACDE",
  green: "#81B92A",
  orange: "#EF6B22",
  dark: "#3C3A39",
  muted: "#94A3B8"
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
  coadesc: {
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

  btnPrevColetas: document.getElementById("btnPrevColetas"),
  btnNextColetas: document.getElementById("btnNextColetas"),
  tablePageIndicator: document.getElementById("tablePageIndicator"),

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

let tablePage = 0;
const tablePageSize = 10;

/* =========================
   UTILITÁRIOS GERAIS
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
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
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
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const text = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/kg|kgs|quilo|quilos|litros?|l|r\$/gi, "");

  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;

  const parsed = Number(
    normalized.replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = toNumber(value);

    if (parsed !== 0) {
      return parsed;
    }
  }

  return 0;
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function firstFinite(...values) {
  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return null;
}

function dateToDateObject(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = String(value).trim();

  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const date = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function dateToISO(value) {
  const date = dateToDateObject(value);

  if (!date) return "";

  return date.toISOString().slice(0, 10);
}

function inferDateObject(item = {}) {
  const candidates = [
    item.opDate,
    item.dataOperacao,
    item.operationDate,
    item.dataColeta,
    item.coletaData,
    item.dateColeta,
    item.date,
    item.data,
    item.createdAt,
    item.updatedAt,
    item.createdAtISO,
    item.payloadSnapshot?.opDate,
    item.payloadSnapshot?.dataOperacao,
    item.payloadSnapshot?.operationDate,
    item.payloadSnapshot?.dataColeta,
    item.payloadSnapshot?.coletaData,
    item.payloadSnapshot?.date,
    item.payloadSnapshot?.data,
    item.recebimento?.dataColeta,
    item.finalTurno?.dataColeta
  ];

  for (const candidate of candidates) {
    const date = dateToDateObject(candidate);

    if (date) return date;
  }

  return null;
}

function inferDateISO(item = {}) {
  const date = inferDateObject(item);
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDateBR(value) {
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : dateToDateObject(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTimeBR(value) {
  const date = dateToDateObject(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function setDbStatus(text) {
  if (els.dbStatus) {
    els.dbStatus.textContent = text;
  }
}

/* =========================
   TERRITÓRIO
========================= */

function getTerritoryAliases(value) {
  const v = normalizeTerritory(value);

  if (!v) return [];

  if (
    v === "vila-pinto" ||
    v === "crgr-vila-pinto" ||
    v === "vp"
  ) {
    return [
      "vila-pinto",
      "crgr-vila-pinto",
      "vp",
      "vila pinto"
    ];
  }

  if (
    v === "cooadesc" ||
    v === "coadesc" ||
    v === "crgr-cooadesc" ||
    v === "crgr-coadesc"
  ) {
    return [
      "cooadesc",
      "coadesc",
      "crgr-cooadesc",
      "crgr-coadesc"
    ];
  }

  if (
    v === "padre-cacique" ||
    v === "crgr-padre-cacique" ||
    v === "padre"
  ) {
    return [
      "padre-cacique",
      "crgr-padre-cacique",
      "padre",
      "padre cacique"
    ];
  }

  return [v];
}

function resolvePageTerritory(profile = {}) {
  const bodyTerritory = normalizeTerritory(
    document.body?.dataset?.territoryId || ""
  );

  const urlTerritory = normalizeTerritory(
    new URLSearchParams(window.location.search).get("territory") || ""
  );

  const profileTerritory = normalizeTerritory(
    profile.territoryId ||
    profile.territory ||
    profile.cooperativeId ||
    ""
  );

  return bodyTerritory || urlTerritory || profileTerritory || "vila-pinto";
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
    item.recebimento?.participantCode ||
    item.finalTurno?.participantCode ||
    ""
  ).trim().toUpperCase();

  const territoryFields = [
    item.territoryId,
    item.territory,
    item.territorio,
    item.territoryLabel,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeName,
    item.cooperativa,
    item.localCrgr,
    item.crgr,
    item.payloadSnapshot?.territoryId,
    item.payloadSnapshot?.territory,
    item.payloadSnapshot?.territorio,
    item.payloadSnapshot?.territoryLabel,
    item.payloadSnapshot?.cooperativeId,
    item.payloadSnapshot?.cooperativaId,
    item.payloadSnapshot?.cooperativa,
    item.payloadSnapshot?.localCrgr,
    item.payloadSnapshot?.crgr
  ].filter(Boolean);

  const hasTerritoryMatch = territoryFields.some((field) => {
    const normalized = normalizeTerritory(field);
    return aliases.includes(normalized);
  });

  if (hasTerritoryMatch) return true;

  if (aliases.includes("vila-pinto")) {
    return (
      code.startsWith("VPD") ||
      code.startsWith("VP") ||
      code.startsWith("C") ||
      code.startsWith("F")
    );
  }

  if (aliases.includes("cooadesc") || aliases.includes("coadesc")) {
    return (
      code.startsWith("COA") ||
      code.startsWith("COO") ||
      code.startsWith("CD")
    );
  }

  if (aliases.includes("padre-cacique")) {
    return (
      code.startsWith("PC") ||
      code.startsWith("PCA") ||
      code.startsWith("PDC")
    );
  }

  /*
    Fallback de segurança:
    se o documento não tem território nem código reconhecido,
    não bloqueia a renderização. Isso evita tela vazia por falta
    de padronização nos documentos antigos.
  */
  if (!territoryFields.length && !code) {
    return true;
  }

  return false;
}

/* =========================
   FLUXO / ENTREGA / STATUS
========================= */

function inferFluxo(item = {}) {
  const raw = firstText(
    item.flowType,
    item.fluxo,
    item.tipoFluxo,
    item.tipoColeta,
    item.tipoRecebimento,
    item.receiptType,
    item.payloadSnapshot?.flowType,
    item.payloadSnapshot?.fluxo,
    item.payloadSnapshot?.tipoFluxo,
    item.payloadSnapshot?.tipoColeta,
    item.payloadSnapshot?.tipoRecebimento,
    item.recebimento?.flowType,
    item.recebimento?.fluxo,
    item.finalTurno?.flowType,
    item.finalTurno?.fluxo
  );

  const normalized = normalizeText(raw).replaceAll("-", "_");

  if (
    normalized.includes("final") ||
    normalized.includes("turno") ||
    normalized === "final_turno"
  ) {
    return "final_turno";
  }

  return "recebimento";
}

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "final_turno") return "Final do turno";
  if (normalized === "recebimento") return "Recebimento";

  return value || "Recebimento";
}

function inferEntrega(item = {}) {
  const raw = firstText(
    item.deliveryType,
    item.entrega,
    item.tipoEntrega,
    item.payloadSnapshot?.deliveryType,
    item.payloadSnapshot?.entrega,
    item.payloadSnapshot?.tipoEntrega,
    item.recebimento?.deliveryType,
    item.recebimento?.entrega,
    item.finalTurno?.deliveryType,
    item.finalTurno?.entrega
  );

  return raw || "Normal";
}

function inferEntregaKey(item = {}) {
  return normalizeText(inferEntrega(item));
}

function inferObservacao(item = {}) {
  return firstText(
    item.observacao,
    item.obs,
    item.notes,
    item.anotacao,
    item.payloadSnapshot?.observacao,
    item.payloadSnapshot?.obs,
    item.recebimento?.observacao,
    item.finalTurno?.observacao
  );
}

function getStatus(item = {}) {
  return firstText(
    item.status,
    item.situacao,
    item.state,
    item.coletaStatus,
    item.decision,
    item.approvalStatus,
    "ativo"
  );
}

function resolveHumanStatus(item = {}) {
  const raw = normalizeText(getStatus(item));

  if (raw.includes("cancel")) return "Cancelado";
  if (raw.includes("edit")) return "Editado";
  if (raw.includes("pend")) return "Pendente";
  if (raw.includes("reje") || raw.includes("reject")) return "Rejeitado";

  return "Ativo";
}

function isActiveCollection(item = {}) {
  const status = normalizeText(getStatus(item));

  return ![
    "cancelado",
    "cancelada",
    "rejeitado",
    "rejeitada",
    "rejected",
    "rascunho",
    "draft"
  ].includes(status);
}

function statusBadge(item = {}) {
  const status = resolveHumanStatus(item);
  const cls = normalizeText(status);

  return `
    <span class="status-badge ${cls}">
      ${escapeHtml(status)}
    </span>
  `;
}
/* =========================
   PARTICIPANTES
========================= */

function extractLatLngFromSource(source = {}) {
  if (!source || typeof source !== "object") {
    return {
      lat: null,
      lng: null
    };
  }

  const lat = firstFinite(
    source.lat,
    source.latitude,
    source.coords?.lat,
    source.coords?.latitude,
    source.location?.lat,
    source.location?.latitude,
    source.address?.lat,
    source.address?.latitude,
    source.geo?.lat,
    source.geo?.latitude,
    source.payloadSnapshot?.lat,
    source.payloadSnapshot?.latitude
  );

  const lng = firstFinite(
    source.lng,
    source.longitude,
    source.lon,
    source.coords?.lng,
    source.coords?.longitude,
    source.coords?.lon,
    source.location?.lng,
    source.location?.longitude,
    source.location?.lon,
    source.address?.lng,
    source.address?.longitude,
    source.address?.lon,
    source.geo?.lng,
    source.geo?.longitude,
    source.geo?.lon,
    source.payloadSnapshot?.lng,
    source.payloadSnapshot?.longitude,
    source.payloadSnapshot?.lon
  );

  return {
    lat,
    lng
  };
}

function buildAddressFromParticipant(data = {}) {
  const nested = data.address || {};

  return firstText(
    data.enderecoCompleto,
    data.fullAddress,
    data.addressText,
    nested.full,
    nested.enderecoCompleto,
    [
      nested.street,
      nested.number,
      nested.neighborhood,
      nested.city,
      nested.state
    ].filter(Boolean).join(", "),
    [
      data.rua,
      data.numero,
      data.bairro,
      data.cidade,
      data.uf
    ].filter(Boolean).join(", ")
  );
}

function getParticipantCodeFromItem(item = {}) {
  return firstText(
    item.participantCode,
    item.codigoParticipante,
    item.codigo,
    item.familyCode,
    item.code,
    item.payloadSnapshot?.participantCode,
    item.payloadSnapshot?.codigoParticipante,
    item.payloadSnapshot?.familyCode,
    item.recebimento?.participantCode,
    item.recebimento?.codigoParticipante,
    item.recebimento?.familyCode,
    item.finalTurno?.participantCode,
    item.finalTurno?.codigoParticipante,
    item.finalTurno?.familyCode
  );
}

function resolveParticipant(item = {}) {
  const participantId = firstText(
    item.participantId,
    item.participantUID,
    item.payloadSnapshot?.participantId
  );

  const participantCode = getParticipantCodeFromItem(item);

  const directName = firstText(
    item.participantName,
    item.nomeParticipante,
    item.name,
    item.nome,
    item.payloadSnapshot?.participantName,
    item.payloadSnapshot?.nomeParticipante,
    item.recebimento?.participantName,
    item.finalTurno?.participantName
  );

  const directType = firstText(
    item.participantType,
    item.tipoCadastro,
    item.localType,
    item.codeLocalType,
    item.payloadSnapshot?.participantType,
    item.payloadSnapshot?.tipoCadastro,
    item.payloadSnapshot?.localType,
    item.recebimento?.participantType,
    item.finalTurno?.participantType
  );

  const fromId = participantId
    ? participantsMap.get(String(participantId))
    : null;

  const fromCode = participantCode
    ? participantsMap.get(String(participantCode))
    : null;

  const matched = fromId || fromCode || null;

  const coords = extractLatLngFromSource(matched || item);

  return {
    id: participantId || matched?.id || "",
    code: matched?.code || matched?.participantCode || participantCode || "—",
    name:
      directName ||
      matched?.name ||
      matched?.nome ||
      (
        participantCode
          ? `Participante ${participantCode}`
          : "Sem participante vinculado"
      ),
    type:
      matched?.type ||
      matched?.participantType ||
      directType ||
      "participante",
    status:
      matched?.status ||
      matched?.decision ||
      "—",
    address:
      matched?.address ||
      matched?.enderecoCompleto ||
      firstText(
        item.enderecoCompleto,
        item.payloadSnapshot?.enderecoCompleto,
        item.recebimento?.enderecoCompleto,
        item.finalTurno?.enderecoCompleto
      ),
    localColeta:
      matched?.localColeta ||
      item.localColeta ||
      item.payloadSnapshot?.localColeta ||
      "",
    lat: coords.lat,
    lng: coords.lng
  };
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

/* =========================
   MATERIAIS / PESOS
========================= */

function getMaterialSources(item = {}) {
  return [
    item.materiais,
    item.materials,
    item.material,
    item.recebimento?.materiais,
    item.recebimento?.materials,
    item.finalTurno?.materiais,
    item.finalTurno?.materials,
    item.payloadSnapshot?.materiais,
    item.payloadSnapshot?.materials,
    item.payloadSnapshot?.material,
    item.recebimento,
    item.finalTurno,
    item.payloadSnapshot,
    item
  ].filter(Boolean);
}

function inferMaterialValue(item = {}, key) {
  const aliases = MATERIAL_ALIASES[key] || [key];
  const sources = getMaterialSources(item);

  let total = 0;

  sources.forEach((source) => {
    aliases.forEach((alias) => {
      total += toNumber(source?.[alias]);
    });
  });

  return total;
}

function inferTotalMateriaisRegistro(item = {}) {
  return MATERIAL_META.reduce((acc, material) => {
    return acc + inferMaterialValue(item, material.key);
  }, 0);
}

function inferPesoRecebidoBruto(item = {}) {
  return firstNumber(
    item.pesoRecebido,
    item.peso_recebido,
    item.totalPesoRecebido,
    item.totalRecebido,
    item.pesoResiduoSecoKg,
    item.residuoSecoKg,
    item.totalKg,
    item.pesoTotal,
    item.peso,
    item.kg,
    item.recebimento?.pesoRecebido,
    item.recebimento?.pesoResiduoSecoKg,
    item.recebimento?.residuoSecoKg,
    item.finalTurno?.pesoRecebido,
    item.finalTurno?.pesoResiduoSecoKg,
    item.finalTurno?.residuoSecoKg,
    item.payloadSnapshot?.pesoRecebido,
    item.payloadSnapshot?.pesoResiduoSecoKg,
    item.payloadSnapshot?.residuoSecoKg,
    item.payloadSnapshot?.totalKg
  );
}

function inferRejeitoInformado(item = {}) {
  return firstNumber(
    item.rejeitoKg,
    item.pesoRejeitoKg,
    item.rejeito,
    item.totalRejeito,
    item.naoReciclavelKg,
    item.pesoNaoReciclavelKg,
    item.recebimento?.rejeitoKg,
    item.recebimento?.pesoRejeitoKg,
    item.recebimento?.rejeito,
    item.finalTurno?.rejeitoKg,
    item.finalTurno?.pesoRejeitoKg,
    item.finalTurno?.rejeito,
    item.payloadSnapshot?.rejeitoKg,
    item.payloadSnapshot?.pesoRejeitoKg,
    item.payloadSnapshot?.rejeito,
    item.payloadSnapshot?.totalRejeito
  );
}

function inferNaoComercializado(item = {}) {
  return firstNumber(
    item.naoComercializadoKg,
    item.pesoNaoComercializadoKg,
    item.naoComercializado,
    item.nao_comercializado,
    item.totalNaoComercializado,
    item.materialNaoComercializado,
    item.naoVenda,
    item.semComercializacao,
    item.recebimento?.naoComercializadoKg,
    item.recebimento?.pesoNaoComercializadoKg,
    item.recebimento?.naoComercializado,
    item.finalTurno?.naoComercializadoKg,
    item.finalTurno?.pesoNaoComercializadoKg,
    item.finalTurno?.naoComercializado,
    item.payloadSnapshot?.naoComercializadoKg,
    item.payloadSnapshot?.pesoNaoComercializadoKg,
    item.payloadSnapshot?.naoComercializado,
    item.payloadSnapshot?.totalNaoComercializado
  );
}

function inferTotalReciclavelRegistro(item = {}) {
  const materialTotalSemOleo = MATERIAL_META.reduce((acc, material) => {
    if (material.key === "oleoKg") return acc;
    return acc + inferMaterialValue(item, material.key);
  }, 0);

  if (materialTotalSemOleo > 0) {
    return materialTotalSemOleo;
  }

  const bruto = inferPesoRecebidoBruto(item);
  const rejeito = inferRejeitoInformado(item);
  const naoComercializado = inferNaoComercializado(item);

  if (bruto > 0) {
    return Math.max(0, bruto - rejeito - naoComercializado);
  }

  return 0;
}

function inferTotalRejeitoRegistro(item = {}) {
  return inferRejeitoInformado(item) + inferNaoComercializado(item);
}

function inferRejeitoNaoReciclavel(item = {}) {
  return Math.max(0, inferRejeitoInformado(item) - inferNaoComercializado(item));
}

function inferQualidade(item = {}) {
  const raw = firstText(
    item.qualidade,
    item.qualidadeNota,
    item.qualidadeMedia,
    item.notaQualidade,
    item.qualityScore,
    item.recebimento?.qualidade,
    item.recebimento?.qualidadeNota,
    item.finalTurno?.qualidade,
    item.finalTurno?.qualidadeNota,
    item.payloadSnapshot?.qualidade,
    item.payloadSnapshot?.qualidadeNota,
    item.payloadSnapshot?.qualidadeMedia
  );

  if (raw === "") return 0;

  return toNumber(raw);
}

function getMaterialTotals(items = []) {
  const totals = {};

  MATERIAL_META.forEach((material) => {
    totals[material.key] = 0;
  });

  items.filter(isActiveCollection).forEach((item) => {
    MATERIAL_META.forEach((material) => {
      totals[material.key] += inferMaterialValue(item, material.key);
    });
  });

  return totals;
}

/* =========================
   SVG DOS MATERIAIS
========================= */

function getMaterialSVG(icon) {
  const icons = {
    plastico: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 3H16L18 8V21H6V8L8 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M9 8H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M9 13H15V17H9V13Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      </svg>
    `,

    vidro: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 2H15V6L17 10V21H7V10L9 6V2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M9 11H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `,

    metal: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" stroke-width="1.8"/>
        <path d="M5 6V18C5 19.7 8.1 21 12 21C15.9 21 19 19.7 19 18V6" stroke="currentColor" stroke-width="1.8"/>
        <path d="M5 12C5 13.7 8.1 15 12 15C15.9 15 19 13.7 19 12" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    papel: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 3H14L18 7V21H7V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M14 3V7H18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M9 12H16M9 16H16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `,

    papelao: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 7L12 3L21 7V17L12 21L3 17V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M3 7L12 11L21 7" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M12 11V21" stroke="currentColor" stroke-width="1.8"/>
      </svg>
    `,

    sacaria: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 3H15L13 6H11L9 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M7 6H17L19 11L16 21H8L5 11L7 6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M9 13H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `,

    isopor: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/>
        <circle cx="9" cy="9" r="1" fill="currentColor"/>
        <circle cx="15" cy="9" r="1" fill="currentColor"/>
        <circle cx="12" cy="15" r="1" fill="currentColor"/>
      </svg>
    `,

    oleo: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3C12 3 7 9 7 13A5 5 0 0 0 17 13C17 9 12 3 12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M12 9C12 9 10 12 10 14A2 2 0 0 0 14 14C14 12 12 9 12 9Z" stroke="currentColor" stroke-width="1.5"/>
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
    participant: normalizeText(els.fParticipantCode?.value || ""),
    fluxo: els.fFluxo?.value || "__all__",
    entrega: els.fEntrega?.value || "__all__",
    ini: els.fIni?.value || "",
    fim: els.fFim?.value || "",
    busca: normalizeText(els.fBusca?.value || ""),
    searchType: els.fSearchType?.value || "all"
  };
}

function getTableFilters() {
  return {
    search: normalizeText(els.tSearch?.value || ""),
    fluxo: els.tFluxo?.value || "__all__",
    entrega: els.tEntrega?.value || "__all__",
    status: els.tStatus?.value || "__all__",
    tipoCadastro: els.tTipoCadastro?.value || "__all__"
  };
}

function populateFilters(items = []) {
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = inferEntrega(item);

    if (entrega && entrega !== "Normal") {
      entregas.add(entrega);
    }
  });

  const renderEntregaOptions = (selectEl, placeholder) => {
    if (!selectEl) return;

    const current = selectEl.value || "__all__";

    selectEl.innerHTML = `
      <option value="__all__">${placeholder}</option>
      ${Array.from(entregas)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((entrega) => {
          return `<option value="${escapeHtml(entrega)}">${escapeHtml(entrega)}</option>`;
        })
        .join("")}
    `;

    const hasCurrent = Array.from(entregas).includes(current);
    selectEl.value = hasCurrent ? current : "__all__";
  };

  renderEntregaOptions(els.fEntrega, "Todos");
  renderEntregaOptions(els.tEntrega, "Todas");
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

function getSearchTarget(item, participant, searchType) {
  const base = {
    participant: [
      participant.name,
      item.participantName,
      item.nomeParticipante
    ],
    code: [
      participant.code,
      item.participantCode,
      item.codigoParticipante,
      item.codigo,
      item.familyCode
    ],
    creator: [
      item.createdBy,
      item.createdByName,
      item.createdByPublicCode,
      item.createdByEmail
    ],
    obs: [
      inferObservacao(item)
    ],
    delivery: [
      inferEntrega(item),
      inferEntregaKey(item)
    ],
    flow: [
      inferFluxo(item),
      formatFluxoLabel(inferFluxo(item))
    ],
    all: [
      participant.name,
      participant.code,
      participant.address,
      participant.type,
      inferFluxo(item),
      formatFluxoLabel(inferFluxo(item)),
      inferEntrega(item),
      inferObservacao(item),
      getStatus(item),
      JSON.stringify(item)
    ]
  };

  return normalizeText((base[searchType] || base.all).join(" "));
}

function applyFilters() {
  try {
    const filters = getFilters();

    showQuickParticipantPreviewByCode(filters.participant);

    filteredColetas = allColetas.filter((item) => {
      const participant = resolveParticipant(item);
      const date = inferDateISO(item);
      const fluxo = inferFluxo(item);
      const entrega = inferEntrega(item);

      if (filters.participant) {
        const codeTarget = normalizeText([
          participant.code,
          participant.name,
          item.participantCode,
          item.codigoParticipante,
          item.codigo,
          item.familyCode,
          item.payloadSnapshot?.participantCode,
          item.payloadSnapshot?.familyCode
        ].join(" "));

        if (!codeTarget.includes(filters.participant)) {
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
        const searchTarget = getSearchTarget(item, participant, filters.searchType);

        if (!searchTarget.includes(filters.busca)) {
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
  } catch (error) {
    console.error("Erro ao aplicar filtros:", error);
    setDbStatus("erro nos filtros");
  }
}

function clearFilters() {
  if (els.fParticipantCode) els.fParticipantCode.value = "";
  if (els.fFluxo) els.fFluxo.value = "__all__";
  if (els.fEntrega) els.fEntrega.value = "__all__";
  if (els.fIni) els.fIni.value = "";
  if (els.fFim) els.fFim.value = "";
  if (els.fBusca) els.fBusca.value = "";
  if (els.fSearchType) els.fSearchType.value = "all";

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

  els.txtPeriodo.textContent = `${formatDateBR(dates[0])} → ${formatDateBR(dates[dates.length - 1])}`;
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

function validateProfile(profile = {}) {
  const active =
    profile.status === "active" ||
    profile.status === "aprovado" ||
    profile.active === true ||
    profile.ativo === true ||
    !profile.status;

  if (!active) {
    throw new Error("Usuário sem acesso ativo.");
  }
}

function fillUser(profile = {}) {
  if (els.userDisplayName) {
    els.userDisplayName.textContent = firstText(
      profile.displayName,
      profile.name,
      profile.nome,
      auth.currentUser?.email,
      "Usuário"
    );
  }

  if (els.userRole) {
    els.userRole.textContent = profile.role || "cooperativa";
  }

  if (els.userTerritory) {
    els.userTerritory.textContent = firstText(
      profile.territoryLabel,
      profile.territoryId,
      pageTerritoryId,
      "—"
    );
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

        const code = firstText(
          data.participantCode,
          data.familyCode,
          data.codigo,
          data.code,
          docItem.id
        );

        const coords = extractLatLngFromSource(data);

        const payload = {
          id: docItem.id,
          code,
          participantCode: code,
          name: firstText(
            data.name,
            data.nome,
            data.participantName,
            data.razaoSocial,
            "Sem nome"
          ),
          type: firstText(
            data.participantType,
            data.tipoCadastro,
            data.type,
            data.localType,
            "participante"
          ),
          status: firstText(
            data.status,
            data.decision,
            "—"
          ),
          address: buildAddressFromParticipant(data),
          localColeta: data.localColeta || "",
          lat: coords.lat,
          lng: coords.lng,
          territoryId: data.territoryId || ""
        };

        participantsMap.set(docItem.id, payload);

        [
          code,
          data.participantCode,
          data.familyCode,
          data.codigo,
          data.code
        ].forEach((key) => {
          const normalizedKey = String(key || "").trim();

          if (normalizedKey) {
            participantsMap.set(normalizedKey, payload);
          }
        });
      });

      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar participantes:", error);
      setDbStatus("erro participantes");
    }
  );
}

function listenColetas() {
  setDbStatus("conectando…");

  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  activeUnsubscribe = onSnapshot(
    collection(db, "coletas"),
    (snapshot) => {
      let loaded = snapshot.docs.map((docItem) => {
        return {
          id: docItem.id,
          ...docItem.data()
        };
      });

      const totalOriginal = loaded.length;

      loaded = loaded
        .filter(itemBelongsToPageTerritory)
        .sort((a, b) => {
          const dateA = inferDateObject(a)?.getTime() || 0;
          const dateB = inferDateObject(b)?.getTime() || 0;

          return dateB - dateA;
        });

      allColetas = loaded;

      setDbStatus(`conectado • ${loaded.length}/${totalOriginal} coletas`);

      populateFilters(allColetas);
      setDefaultDateRange(allColetas);
      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar coletas:", error);
      setDbStatus("erro coletas");

      if (els.tableColetasBody) {
        els.tableColetasBody.innerHTML = `
          <tr>
            <td colspan="7">Erro ao carregar coletas do Firebase.</td>
          </tr>
        `;
      }
    }
  );
}
/* =========================
   KPIs / RESUMOS / CARDS
========================= */

function renderKpis(items = []) {
  const ativos = items.filter(isActiveCollection);
  const participantes = new Set();

  let reciclavel = 0;
  let rejeito = 0;
  let finalTurno = 0;
  let qualidadeTotal = 0;
  let qualidadeQtd = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);

    if (participant.code && participant.code !== "—") {
      participantes.add(participant.code);
    }

    reciclavel += inferTotalReciclavelRegistro(item);
    rejeito += inferTotalRejeitoRegistro(item);

    if (inferFluxo(item) === "final_turno") {
      finalTurno += 1;
    }

    const qualidade = inferQualidade(item);

    if (qualidade > 0) {
      qualidadeTotal += qualidade;
      qualidadeQtd += 1;
    }
  });

  if (els.k_totalColetas) els.k_totalColetas.textContent = String(ativos.length);
  if (els.k_participantes) els.k_participantes.textContent = String(participantes.size);
  if (els.k_residuoSeco) els.k_residuoSeco.textContent = formatNumber(reciclavel);
  if (els.k_rejeito) els.k_rejeito.textContent = formatNumber(rejeito);
  if (els.k_finalTurno) els.k_finalTurno.textContent = String(finalTurno);

  const qualidadeMedia = qualidadeQtd ? qualidadeTotal / qualidadeQtd : 0;
  const elQualidadeMedia = document.getElementById("indicatorQualidadeMedia");

  if (elQualidadeMedia) {
    elQualidadeMedia.textContent = qualidadeMedia ? formatNumber(qualidadeMedia) : "0";
  }
}

function computeExpandedMetrics(items = []) {
  const ativos = items.filter(isActiveCollection);
  const materialTotals = getMaterialTotals(ativos);

  const dias = new Set();
  const participantes = new Set();
  const condominios = new Set();
  const comercios = new Set();

  let reciclavelKg = 0;
  let rejeitoKg = 0;
  let rejeitoNaoReciclavelKg = 0;
  let naoComercializadoKg = 0;
  let entregaVoluntaria = 0;
  let receitaTotal = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);
    const date = inferDateISO(item);
    const tipo = normalizeText(participant.type);

    if (date) dias.add(date);

    if (participant.code && participant.code !== "—") {
      participantes.add(participant.code);
    }

    if (tipo.includes("condominio") || tipo.includes("condomínio")) {
      condominios.add(participant.code || participant.name);
    }

    if (tipo.includes("comercio") || tipo.includes("comércio")) {
      comercios.add(participant.code || participant.name);
    }

    if (inferEntregaKey(item).includes("volunt")) {
      entregaVoluntaria += 1;
    }

    reciclavelKg += inferTotalReciclavelRegistro(item);
    rejeitoKg += inferTotalRejeitoRegistro(item);
    rejeitoNaoReciclavelKg += inferRejeitoNaoReciclavel(item);
    naoComercializadoKg += inferNaoComercializado(item);
  });

  MATERIAL_META.forEach((material) => {
    receitaTotal += (materialTotals[material.key] || 0) * material.price;
  });

  const totalGeral = reciclavelKg + rejeitoKg;

  const reciclavelPct = totalGeral
    ? (reciclavelKg / totalGeral) * 100
    : 0;

  const rejeitoPct = totalGeral
    ? (rejeitoKg / totalGeral) * 100
    : 0;

  const rejeitoNaoReciclavelPct = rejeitoKg
    ? (rejeitoNaoReciclavelKg / rejeitoKg) * 100
    : 0;

  const naoComercializadoPct = rejeitoKg
    ? (naoComercializadoKg / rejeitoKg) * 100
    : 0;

  return {
    materialTotals,
    reciclavelKg,
    rejeitoKg,
    rejeitoNaoReciclavelKg,
    naoComercializadoKg,
    reciclavelPct,
    rejeitoPct,
    rejeitoNaoReciclavelPct,
    naoComercializadoPct,
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
  const dates = items
    .map(inferDateISO)
    .filter(Boolean)
    .sort();

  if (els.k_totalDiasProjeto) els.k_totalDiasProjeto.textContent = String(m.totalDiasProjeto);

  if (els.k_inicioProjeto) {
    els.k_inicioProjeto.textContent = `Início: ${dates[0] ? formatDateBR(dates[0]) : "—"}`;
  }

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

  if (els.k_rejeitoNaoReciclavelPct) {
    els.k_rejeitoNaoReciclavelPct.textContent = `${formatNumber(m.rejeitoNaoReciclavelPct)}%`;
  }

  if (els.k_rejeitoNaoReciclavelKg) {
    els.k_rejeitoNaoReciclavelKg.textContent = formatKg(m.rejeitoNaoReciclavelKg);
  }

  if (els.k_naoComercializadoPct) {
    els.k_naoComercializadoPct.textContent = `${formatNumber(m.naoComercializadoPct)}%`;
  }

  if (els.k_naoComercializadoKg) {
    els.k_naoComercializadoKg.textContent = formatKg(m.naoComercializadoKg);
  }

  renderMaterialCards(m);
}

function renderMaterialCards(metrics) {
  if (!els.materialCards) return;

  const totalMateriais = Object.values(metrics.materialTotals)
    .reduce((acc, value) => acc + value, 0);

  els.materialCards.innerHTML = MATERIAL_META.map((material) => {
    const kg = metrics.materialTotals[material.key] || 0;
    const pct = totalMateriais ? (kg / totalMateriais) * 100 : 0;
    const receita = kg * material.price;

    return `
      <article
        class="material-card professional-card ${material.isSpecial ? "special-flow-card" : ""}"
        style="--material-color:${escapeHtml(material.color)}"
      >
        <div class="material-top">
          <div class="icon-group">
            <div class="mat-icon professional-icon">
              ${getMaterialSVG(material.icon)}
            </div>
          </div>

          <div class="mat-pct">
            ${material.isSpecial ? "Fluxo especial" : `${formatNumber(pct)}%`}
          </div>
        </div>

        <div class="mat-name">${escapeHtml(material.label)}</div>

        <div class="mat-kg">
          ${formatNumber(kg)} kg
        </div>

        <div class="material-progress" aria-hidden="true">
          <span style="width:${material.isSpecial ? 100 : Math.min(pct, 100)}%"></span>
        </div>

        <div class="mat-sub">
          Receita estimada ≈ ${formatMoneyBR(receita)}
        </div>
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
      },
      tooltip: {
        callbacks: {
          label(context) {
            const label = context.dataset.label || "";
            const value = context.raw ?? 0;

            return `${label}: ${formatNumber(value)}`;
          }
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

function destroyChart(chart) {
  if (chart && typeof chart.destroy === "function") {
    chart.destroy();
  }
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
        naoComercializado: 0,
        quantidade: 0
      });
    }

    const current = grouped.get(key);

    current.reciclavel += inferTotalReciclavelRegistro(item);
    current.rejeito += inferTotalRejeitoRegistro(item);
    current.naoComercializado += inferNaoComercializado(item);
    current.quantidade += 1;
  });

  const ordered = Array.from(grouped.values())
    .sort((a, b) => `${a.date}_${a.fluxo}`.localeCompare(`${b.date}_${b.fluxo}`));

  return {
    labels: ordered.map((item) => `${formatDateBR(item.date)} • ${formatFluxoLabel(item.fluxo)}`),
    reciclavel: ordered.map((item) => Number(item.reciclavel.toFixed(2))),
    rejeito: ordered.map((item) => Number(item.rejeito.toFixed(2))),
    naoComercializado: ordered.map((item) => Number(item.naoComercializado.toFixed(2))),
    quantidade: ordered.map((item) => item.quantidade)
  };
}

function buildFlowSeries(items = []) {
  const map = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const label = formatFluxoLabel(inferFluxo(item));
    map.set(label, (map.get(label) || 0) + 1);
  });

  return {
    labels: Array.from(map.keys()),
    values: Array.from(map.values())
  };
}

function buildMaterialSeries(items = []) {
  const totals = getMaterialTotals(items);

  const ordered = MATERIAL_META.map((material) => {
    return {
      label: material.label,
      value: totals[material.key] || 0
    };
  }).filter((item) => item.value > 0);

  return {
    labels: ordered.map((item) => item.label),
    values: ordered.map((item) => Number(item.value.toFixed(2)))
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

function renderWeightTimeline(items = []) {
  const canvas = document.getElementById("weightTimelineChart");

  if (!canvas || typeof Chart === "undefined") return;

  const daily = buildWeightDailySeries(items);

  destroyChart(weightTimelineChart);

  weightTimelineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: daily.labels,
      datasets: [
        {
          label: "Peso reciclável",
          data: daily.reciclavel,
          backgroundColor: "rgba(129,185,42,.82)",
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: "Rejeito",
          data: daily.rejeito,
          backgroundColor: "rgba(239,107,34,.78)",
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: "Não comercializado",
          data: daily.naoComercializado,
          backgroundColor: "rgba(83,172,222,.58)",
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
            label(context) {
              return `${context.dataset.label}: ${formatKg(context.raw)}`;
            },
            afterBody(context) {
              const idx = context[0]?.dataIndex || 0;
              return `Coletas realizadas: ${daily.quantidade[idx] || 0}`;
            }
          }
        }
      }
    }
  });
}

function renderCharts(items = []) {
  if (typeof Chart === "undefined") return;

  const ctxMain = document.getElementById("mainChart");
  const ctxA = document.getElementById("secA");
  const ctxB = document.getElementById("secB");
  const ctxC = document.getElementById("secC");

  destroyChart(mainChart);
  destroyChart(secA);
  destroyChart(secB);
  destroyChart(secC);

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
              "rgba(129,185,42,.82)",
              "rgba(239,107,34,.78)"
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
      options: {
        ...getChartOptions(materialType),
        plugins: {
          ...getChartOptions(materialType).plugins,
          tooltip: {
            callbacks: {
              label(context) {
                return `${context.dataset.label}: ${formatKg(context.raw)}`;
              }
            }
          }
        }
      }
    });
  }

  if (ctxC) {
    secC = new Chart(ctxC, {
      type: pointsType,
      data: {
        labels: points.labels,
        datasets: [
          {
            label: "Coletas por participante",
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
   TABELA PAGINADA • SEÇÃO 6
========================= */

function getCurrentPageSlice(items = []) {
  const start = tablePage * tablePageSize;
  const end = start + tablePageSize;

  return items.slice(start, end);
}

function updateTablePagination(total = 0) {
  const start = total === 0 ? 0 : tablePage * tablePageSize + 1;
  const end = Math.min((tablePage + 1) * tablePageSize, total);

  if (els.tablePageIndicator) {
    els.tablePageIndicator.textContent = total
      ? `Mostrando ${start}-${end} de ${total}`
      : "Nenhuma coleta";
  }

  if (els.btnPrevColetas) {
    els.btnPrevColetas.disabled = tablePage === 0;
  }

  if (els.btnNextColetas) {
    els.btnNextColetas.disabled = end >= total;
  }
}

function setupTablePagination() {
  els.btnPrevColetas?.addEventListener("click", () => {
    if (tablePage <= 0) return;

    tablePage--;
    renderTable(tableFilteredColetas);
  });

  els.btnNextColetas?.addEventListener("click", () => {
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

    if (filters.fluxo !== "__all__" && fluxo !== filters.fluxo) {
      return false;
    }

    if (filters.entrega !== "__all__" && entrega !== filters.entrega) {
      return false;
    }

    if (filters.status !== "__all__") {
      if (filters.status === "ativo" && !isActiveCollection(item)) {
        return false;
      }

      if (filters.status !== "ativo" && !status.includes(filters.status)) {
        return false;
      }
    }

    if (filters.tipoCadastro !== "__all__") {
      if (
        filters.tipoCadastro === "condominio" &&
        !tipo.includes("condominio") &&
        !tipo.includes("condomínio")
      ) {
        return false;
      }

      if (
        filters.tipoCadastro === "comercio" &&
        !tipo.includes("comercio") &&
        !tipo.includes("comércio")
      ) {
        return false;
      }

      if (
        filters.tipoCadastro === "participante" &&
        (
          tipo.includes("condominio") ||
          tipo.includes("condomínio") ||
          tipo.includes("comercio") ||
          tipo.includes("comércio")
        )
      ) {
        return false;
      }

      if (
        filters.tipoCadastro === "outro" &&
        (
          tipo.includes("participante") ||
          tipo.includes("condominio") ||
          tipo.includes("condomínio") ||
          tipo.includes("comercio") ||
          tipo.includes("comércio")
        )
      ) {
        return false;
      }
    }

    if (filters.search) {
      const searchTarget = normalizeText([
        participant.name,
        participant.code,
        participant.address,
        participant.type,
        fluxo,
        formatFluxoLabel(fluxo),
        entrega,
        resolveHumanStatus(item),
        inferObservacao(item),
        JSON.stringify(item)
      ].join(" "));

      if (!searchTarget.includes(filters.search)) {
        return false;
      }
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
        <td colspan="7" class="table-empty">
          Nenhum registro encontrado.
        </td>
      </tr>
    `;
  } else {
    els.tableColetasBody.innerHTML = pageItems.map((item) => {

      const participant = resolveParticipant(item);

      const dateLabel = formatDateBR(
        inferDateISO(item)
      );

      const fluxoLabel =
        formatFluxoLabel(
          inferFluxo(item)
        );

      const reciclavel =
        inferTotalReciclavelRegistro(item);

      const rejeito =
        inferTotalRejeitoRegistro(item);

      const naoComercializado =
        inferNaoComercializado(item);

      return `
        <tr class="dashboard-table-row">

          <!-- DATA -->
          <td class="td-date">
            ${escapeHtml(dateLabel)}
          </td>

          <!-- PARTICIPANTE -->
          <td class="td-user">
            <strong>
              ${escapeHtml(participant.name)}
            </strong>

            <span>
              ${escapeHtml(
                participant.type || "Participante"
              )}
            </span>
          </td>

          <!-- CÓDIGO -->
          <td class="td-code">
            ${escapeHtml(participant.code)}
          </td>

          <!-- FLUXO -->
          <td class="td-flow">
            ${escapeHtml(fluxoLabel)}
          </td>

          <!-- STATUS -->
          <td class="td-status">
            ${statusBadge(item)}
          </td>

          <!-- DETALHES -->
          <td class="td-details">
            <div class="table-detail-tags">

              <span class="detail-tag success">
                Reciclável:
                ${escapeHtml(
                  formatKg(reciclavel)
                )}
              </span>

              <span class="detail-tag danger">
                Rejeito:
                ${escapeHtml(
                  formatKg(rejeito)
                )}
              </span>

              <span class="detail-tag warning">
                Não comercializado:
                ${escapeHtml(
                  formatKg(
                    naoComercializado
                  )
                )}
              </span>

            </div>
          </td>

          <!-- AÇÕES -->
          <td class="td-actions">

            <button
              type="button"
              class="table-btn view"
              data-view="${escapeHtml(item.id)}"
            >
              Ver coleta
            </button>

            ${
              item.photoURL ||
              item.imageURL ||
              item.foto ||
              item.imagem
                ? `
                  <button
                    type="button"
                    class="table-btn image"
                    data-image="${escapeHtml(
                      item.photoURL ||
                      item.imageURL ||
                      item.foto ||
                      item.imagem
                    )}"
                  >
                    Imagem
                  </button>
                `
                : ""
            }

            <button
              type="button"
              class="table-btn edit"
              data-edit="${escapeHtml(item.id)}"
            >
              Editar
            </button>

            <button
              type="button"
              class="table-btn cancel"
              data-delete="${escapeHtml(item.id)}"
            >
              Excluir
            </button>

          </td>

        </tr>
      `;
    }).join("");
  }

  /* =========================
     CONTADORES
  ========================= */

  if (els.tableVisibleCount) {
    els.tableVisibleCount.textContent =
      String(pageItems.length);
  }

  if (els.tableFilteredCount) {
    els.tableFilteredCount.textContent =
      String(total);
  }

  if (els.tableLastUpdate) {
    els.tableLastUpdate.textContent =
      formatDateTimeBR(new Date());
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
      <button
        class="modal-close"
        type="button"
        data-close="collectionDetailsModal"
        aria-label="Fechar"
      >
        ×
      </button>

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

function renderMaterialDetails(item = {}) {
  return MATERIAL_META.map((material) => {
    const kg = inferMaterialValue(item, material.key);

    return `
      <div class="coleta-info-card">
        <strong>${escapeHtml(material.label)}:</strong>
        ${escapeHtml(formatKg(kg))}
      </div>
    `;
  }).join("");
}

function openCollectionDetails(id) {
  const item = allColetas.find((coleta) => String(coleta.id) === String(id));

  if (!item) return;

  const participant = resolveParticipant(item);
  const modal = ensureCollectionDetailsModal();
  const content = document.getElementById("collectionDetailsContent");

  const rawDate = inferDateObject(item);

  content.innerHTML = `
    <div class="coleta-modal-grid collection-details-fields">
      <div class="coleta-info-card">
        <strong>Data:</strong>
        ${escapeHtml(formatDateBR(rawDate))}
      </div>

      <div class="coleta-info-card">
        <strong>Fluxo:</strong>
        ${escapeHtml(formatFluxoLabel(inferFluxo(item)))}
      </div>

      <div class="coleta-info-card">
        <strong>Entrega:</strong>
        ${escapeHtml(inferEntrega(item))}
      </div>

      <div class="coleta-info-card">
        <strong>Participante:</strong>
        ${escapeHtml(participant.name)}
      </div>

      <div class="coleta-info-card">
        <strong>Código:</strong>
        ${escapeHtml(participant.code)}
      </div>

      <div class="coleta-info-card">
        <strong>Tipo cadastro:</strong>
        ${escapeHtml(participant.type || "participante")}
      </div>

      <div class="coleta-info-card">
        <strong>Status:</strong>
        ${escapeHtml(resolveHumanStatus(item))}
      </div>

      <div class="coleta-info-card">
        <strong>Qualidade:</strong>
        ${escapeHtml(String(inferQualidade(item) || "—"))}
      </div>

      <div class="coleta-info-card">
        <strong>Peso bruto:</strong>
        ${escapeHtml(formatKg(inferPesoRecebidoBruto(item)))}
      </div>

      <div class="coleta-info-card">
        <strong>Peso reciclável:</strong>
        ${escapeHtml(formatKg(inferTotalReciclavelRegistro(item)))}
      </div>

      <div class="coleta-info-card">
        <strong>Rejeito total:</strong>
        ${escapeHtml(formatKg(inferTotalRejeitoRegistro(item)))}
      </div>

      <div class="coleta-info-card">
        <strong>Não comercializado:</strong>
        ${escapeHtml(formatKg(inferNaoComercializado(item)))}
      </div>

      <div class="coleta-info-card collection-span-full">
        <strong>Endereço/local:</strong>
        ${escapeHtml(participant.address || participant.localColeta || "—")}
      </div>

      <div class="coleta-info-card collection-span-full">
        <strong>Observação:</strong>
        ${escapeHtml(inferObservacao(item) || "—")}
      </div>
    </div>

    <h3 style="margin:18px 0 10px;">Materiais informados</h3>

    <div class="coleta-modal-grid collection-details-fields">
      ${renderMaterialDetails(item)}
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

  if (els.editParticipantName) {
    els.editParticipantName.textContent = `${participant.name} • ${participant.code}`;
  }

  if (els.editFluxo) els.editFluxo.value = inferFluxo(item);
  if (els.editEntrega) els.editEntrega.value = inferEntrega(item) === "Normal" ? "" : inferEntrega(item);
  if (els.editPesoBase) els.editPesoBase.value = inferPesoRecebidoBruto(item) || "";
  if (els.editQualidade) els.editQualidade.value = inferQualidade(item) || "";
  if (els.editRejeito) els.editRejeito.value = inferRejeitoInformado(item) || "";
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

  const fluxo = els.editFluxo?.value || "recebimento";
  const entrega = els.editEntrega?.value || "";

  const payload = {
    fluxo,
    flowType: fluxo,
    entrega,
    deliveryType: entrega,
    pesoRecebido: toNumber(els.editPesoBase?.value),
    pesoResiduoSecoKg: toNumber(els.editPesoBase?.value),
    qualidade: els.editQualidade?.value || "",
    qualidadeNota: els.editQualidade?.value || "",
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

  try {
    await updateDoc(doc(db, "coletas", activeEditId), payload);

    closeModal("editModal");
    activeEditId = null;
  } catch (error) {
    console.error("Erro ao salvar edição:", error);
    alert("Erro ao salvar edição da coleta.");
  }
}

/* =========================
   MAPA
========================= */

function getCoopBase() {
  const aliases = getTerritoryAliases(pageTerritoryId);

  if (aliases.includes("cooadesc")) return COOP_BASES.cooadesc;
  if (aliases.includes("coadesc")) return COOP_BASES.coadesc;
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
    els.collectionPointsGrid.innerHTML = points.map((point) => {
      return `
        <button
          type="button"
          class="point-card"
          data-route-code="${escapeHtml(point.code)}"
        >
          <span class="point-code">${escapeHtml(point.code)}</span>

          <h4>${escapeHtml(point.name)}</h4>

          <div class="point-address">
            ${escapeHtml(point.address || point.localColeta || "Sem endereço informado")}
          </div>

          <div class="point-meta">
            <span class="point-chip">${point.count} coleta(s)</span>
          </div>
        </button>
      `;
    }).join("");
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
      .bindPopup(`${escapeHtml(point.name)}<br>${escapeHtml(point.code)}`);
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

    if (els.routeDistanceLabel) {
      els.routeDistanceLabel.textContent = `${formatNumber(route.summary.totalDistance / 1000)} km`;
    }

    if (els.routeTimeLabel) {
      els.routeTimeLabel.textContent = `${formatNumber(route.summary.totalTime / 60)} min`;
    }
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
      "Peso bruto kg": Number(inferPesoRecebidoBruto(item) || 0),
      "Reciclável kg": Number(inferTotalReciclavelRegistro(item) || 0),
      "Rejeito kg": Number(inferTotalRejeitoRegistro(item) || 0),
      "Não comercializado kg": Number(inferNaoComercializado(item) || 0),
      Qualidade: inferQualidade(item) || "—",
      Observação: inferObservacao(item) || ""
    };

    MATERIAL_META.forEach((material) => {
      row[material.label] = Number(inferMaterialValue(item, material.key) || 0);
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

  const rows = getExportRows(getExportBaseItems());

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4"
  });

  pdf.setFontSize(16);
  pdf.text("Dashboard de Coletas Seletivas", 40, 40);

  pdf.setFontSize(10);
  pdf.text(`Emitido em ${formatDateTimeBR(new Date())}`, 40, 58);

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable({
      startY: 80,
      head: [Object.keys(rows[0] || {})],
      body: rows.map((row) => Object.values(row)),
      styles: {
        fontSize: 8
      },
      headStyles: {
        fillColor: [129, 185, 42]
      }
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

  els.btnSaveEdit?.addEventListener("click", saveEdit);

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
      setDbStatus("erro");

      if (els.tableColetasBody) {
        els.tableColetasBody.innerHTML = `
          <tr>
            <td colspan="7">
              Erro ao iniciar o dashboard. Verifique o console do navegador.
            </td>
          </tr>
        `;
      }

      alert(error.message || "Não foi possível carregar o dashboard.");
    }
  });
}

boot();