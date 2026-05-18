import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const MATERIAL_META = [
  {
    key: "plasticoKg",
    label: "Plástico",
    price: 1.92,
    icon: "plastic-bottle",
    color: "#2E7D32",
    logo: "img/logos/plastico.svg"
  },
  {
    key: "vidroKg",
    label: "Vidro",
    price: 0.08,
    icon: "glass-bottle",
    color: "#0288D1",
    logo: "img/logos/vidro.svg"
  },
  {
    key: "aluminioMetalKg",
    label: "Metal / Alumínio",
    price: 2.9,
    icon: "metal-can",
    color: "#757575",
    logo: "img/logos/metal.svg"
  },
  {
    key: "sacariaKg",
    label: "Sacaria",
    price: 0.12,
    icon: "bag-waste",
    color: "#8D6E63",
    logo: "img/logos/sacaria.svg"
  },
  {
    key: "papelMistoKg",
    label: "Papel misto",
    price: 0.66,
    icon: "paper-sheet",
    color: "#1565C0",
    logo: "img/logos/papel.svg"
  },
  {
    key: "papelaoKg",
    label: "Papelão",
    price: 0.52,
    icon: "cardboard-box",
    color: "#A65A2A",
    logo: "img/logos/papelao.svg"
  },
  {
    key: "isoporKg",
    label: "Isopor",
    price: 0.4,
    icon: "foam-cube",
    color: "#00ACC1",
    logo: "img/logos/isopor.svg"
  },
  {
    key: "oleoKg",
    label: "Óleo de cozinha",
    price: 1.5,
    icon: "oil-drop",
    color: "#C79200",
    logo: "img/logos/oleo.svg",
    isSpecial: true
  }
];

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
  "padre-cacique": {
    lat: -30.140122365657504,
    lng: -51.1268772051727
  }
};

const MATERIAL_ALIASES = {
  plasticoKg: [
    "plasticoKg",
    "plastico",
    "pesoPlasticoKg",
    "plasticoPesoKg"
  ],
  vidroKg: [
    "vidroKg",
    "vidro",
    "pesoVidroKg",
    "vidroPesoKg"
  ],
  aluminioMetalKg: [
    "aluminioMetalKg",
    "metalKg",
    "aluminioKg",
    "metalAluminioKg",
    "pesoMetalKg",
    "pesoAluminioKg"
  ],
  sacariaKg: [
    "sacariaKg",
    "sacaria",
    "pesoSacariaKg"
  ],
  papelMistoKg: [
    "papelMistoKg",
    "papelKg",
    "papelMisto",
    "pesoPapelMistoKg",
    "pesoPapelKg"
  ],
  papelaoKg: [
    "papelaoKg",
    "papelao",
    "papelãoKg",
    "pesoPapelaoKg"
  ],
  isoporKg: [
    "isoporKg",
    "isopor",
    "pesoIsoporKg"
  ],
  oleoKg: [
    "oleoKg",
    "oleo",
    "óleoKg",
    "oleoCozinhaKg",
    "oleoDeCozinhaKg",
    "litrosOleo",
    "oleoLitros"
  ]
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

  labelParticipantName: document.getElementById("labelParticipantName"),
  labelParticipantCode: document.getElementById("labelParticipantCode"),
  labelCollectionDate: document.getElementById("labelCollectionDate"),
  labelCollectionFlow: document.getElementById("labelCollectionFlow"),
  collectionLabelQr: document.getElementById("collectionLabelQr"),
  btnGenerateCollectionLabel: document.getElementById("btnGenerateCollectionLabel"),
  btnPrintCollectionLabel: document.getElementById("btnPrintCollectionLabel"),

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
let destinationMarker = null;

let routeFullLayer = null;
let routeMarkersLayer = null;
let routeRequestSeq = 0;

let selectedPointKey = null;
let activeUnsubscribe = null;
let activeParticipantsUnsubscribe = null;

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

  if (
    v === "cooadesc" ||
    v === "coadesc" ||
    v === "crgr-cooadesc" ||
    v === "crgr-coadesc"
  ) {
    return ["cooadesc", "coadesc", "crgr-cooadesc", "crgr-coadesc"];
  }

  if (v === "padre-cacique" || v === "crgr-padre-cacique") {
    return ["padre-cacique", "crgr-padre-cacique"];
  }

  return v ? [v] : [];
}

function sameTerritoryValue(a, b) {
  const aNorm = normalizeTerritory(a);
  const aliases = getTerritoryAliases(b);
  return aliases.includes(aNorm);
}

function resolvePageTerritory(profile) {
  const bodyTerritory = normalizeTerritory(document.body?.dataset?.territoryId || "");
  const urlTerritory = normalizeTerritory(new URLSearchParams(window.location.search).get("territory") || "");
  const userTerritory = normalizeTerritory(profile?.territoryId || "");

  return bodyTerritory || urlTerritory || userTerritory || "";
}

function getCooperativaHomeUrl(territoryId) {
  const aliases = getTerritoryAliases(territoryId);

  if (aliases.includes("cooadesc") || aliases.includes("coadesc")) {
    return "cooperativa-cooadesc.html";
  }

  if (aliases.includes("padre-cacique")) {
    return "cooperativa-padre-cacique.html";
  }

  return "cooperativa-vila-pinto.html";
}

function updateDashboardLinks() {
  const backToCoopBtn = document.getElementById("backToCoopBtn");
  if (backToCoopBtn) {
    backToCoopBtn.href = getCooperativaHomeUrl(pageTerritoryId);
  }
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
    const d = typeof value === "string" ? new Date(value) : value;

    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(d);
  } catch {
    return "—";
  }
}

function formatKg(value) {
  const n = Number(value || 0);

  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} kg`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatMoneyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function toNumberBR(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const cleaned = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(/kg|l|litros?|r\$/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function firstNumber(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") {
      const n = toNumberBR(value);
      if (Number.isFinite(n)) return n;
    }
  }

  return 0;
}

function firstFinite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createdAtToISO(item) {
  if (item.createdAt?.toDate) return item.createdAt.toDate().toISOString();
  if (item.updatedAt?.toDate) return item.updatedAt.toDate().toISOString();
  if (item.createdAtISO) return String(item.createdAtISO);
  return "";
}

function inferDateISO(item) {
  if (item.opDate) return String(item.opDate).slice(0, 10);
  if (item.dataColeta) return String(item.dataColeta).slice(0, 10);
  if (item.coletaData) return String(item.coletaData).slice(0, 10);
  if (item.payloadSnapshot?.dataColeta) return String(item.payloadSnapshot.dataColeta).slice(0, 10);

  const iso = createdAtToISO(item);
  return iso ? iso.slice(0, 10) : "";
}

function inferDateTimeISO(item) {
  return createdAtToISO(item) || item.opDate || item.dataColeta || "";
}

function inferFluxo(item) {
  const raw =
    item.flowType ||
    item.fluxo ||
    item.tipoColeta ||
    item.tipoRecebimento ||
    item.recebimento?.flowType ||
    item.finalTurno?.flowType ||
    item.payloadSnapshot?.flowType ||
    "";

  const normalized = normalizeText(raw).replaceAll("-", "_");

  if (normalized.includes("final")) return "final_turno";
  if (normalized.includes("receb")) return "recebimento";

  return normalized || "recebimento";
}

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "final_turno") return "Final do turno";
  if (normalized === "recebimento") return "Recebimento";

  return value || "Recebimento";
}

function isFinalTurno(item) {
  return inferFluxo(item) === "final_turno";
}

function inferEntrega(item) {
  return (
    item.deliveryType ||
    item.entrega ||
    item.tipoEntrega ||
    item.recebimento?.deliveryType ||
    item.finalTurno?.deliveryType ||
    item.payloadSnapshot?.deliveryType ||
    "—"
  );
}

function inferTerritorio(item) {
  return item.territoryLabel || coopProfile?.territoryLabel || pageTerritoryId || "Território";
}

function inferPesoResiduoSecoBruto(item) {
  return firstNumber(
    item.recebimento?.pesoResiduoSecoKg,
    item.finalTurno?.pesoResiduoSecoKg,
    item.pesoResiduoSecoKg,
    item.recebimento?.residuoSecoKg,
    item.finalTurno?.residuoSecoKg,
    item.residuoSecoKg,
    item.pesoRecebido,
    item.totalKg,
    item.pesoTotal,
    item.payloadSnapshot?.pesoRecebido,
    item.payloadSnapshot?.pesoResiduoSecoKg
  );
}

function inferPesoRejeitoInformado(item) {
  return firstNumber(
    item.recebimento?.pesoRejeitoKg,
    item.finalTurno?.pesoRejeitoKg,
    item.recebimento?.rejeitoKg,
    item.finalTurno?.rejeitoKg,
    item.pesoRejeitoKg,
    item.rejeitoKg,
    item.rejeito,
    item.totalRejeito,
    item.naoReciclavelKg,
    item.pesoNaoReciclavelKg,
    item.payloadSnapshot?.rejeito,
    item.payloadSnapshot?.pesoRejeitoKg
  );
}

function inferNaoComercializado(item) {
  return firstNumber(
    item.recebimento?.pesoNaoComercializadoKg,
    item.finalTurno?.pesoNaoComercializadoKg,
    item.recebimento?.naoComercializadoKg,
    item.finalTurno?.naoComercializadoKg,
    item.pesoNaoComercializadoKg,
    item.naoComercializadoKg,
    item.naoComercializado,
    item.totalNaoComercializado,
    item.payloadSnapshot?.naoComercializado,
    item.payloadSnapshot?.totalNaoComercializado
  );
}

function inferResiduoSeco(item) {
  const bruto = inferPesoResiduoSecoBruto(item);
  const rejeito = inferPesoRejeitoInformado(item);
  const naoComercializado = inferNaoComercializado(item);

  if (bruto > 0) {
    return Math.max(0, bruto - rejeito - naoComercializado);
  }

  return inferTotalMateriaisRegistro(item);
}

function inferRejeitoNaoReciclavel(item) {
  return Math.max(0, inferPesoRejeitoInformado(item) - inferNaoComercializado(item));
}

function inferRejeito(item) {
  return inferPesoRejeitoInformado(item);
}

function inferTotalRejeitoRegistro(item) {
  return inferPesoRejeitoInformado(item) + inferNaoComercializado(item);
}

function inferObservacao(item) {
  return item.observacao || item.recebimento?.observacao || item.finalTurno?.observacao || "";
}

function getQualidade(item) {
  const value =
    item.recebimento?.qualidadeNota ??
    item.finalTurno?.qualidadeNota ??
    item.qualidadeNota ??
    item.qualidade ??
    item.notaQualidade ??
    item.payloadSnapshot?.qualidadeNota ??
    "";

  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function getStatus(item) {
  return String(item.status || "ativo").toLowerCase();
}

function getMaterialValue(item, key) {
  const aliases = MATERIAL_ALIASES[key] || [key];

  const fontes = [
    item.materiais,
    item.materials,
    item.recebimento?.materiais,
    item.finalTurno?.materiais,
    item.payloadSnapshot?.materiais,
    item.payloadSnapshot?.materials,
    item.recebimento,
    item.finalTurno,
    item.payloadSnapshot,
    item
  ].filter(Boolean);

  for (const fonte of fontes) {
    for (const alias of aliases) {
      if (fonte[alias] !== undefined && fonte[alias] !== null && fonte[alias] !== "") {
        return toNumberBR(fonte[alias]);
      }
    }
  }

  return 0;
}

function inferTotalMateriaisRegistro(item) {
  return MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
}

function inferTotalReciclavelRegistro(item) {
  const liquido = inferResiduoSeco(item);
  return liquido || inferTotalMateriaisRegistro(item);
}

function sortColetasLocally(items) {
  return [...items].sort((a, b) => {
    const aDate = String(inferDateTimeISO(a) || "");
    const bDate = String(inferDateTimeISO(b) || "");
    return bDate.localeCompare(aDate);
  });
}
/* =========================
   EXPORT BASE
========================= */
function getExportBaseItems() {
  return Array.isArray(tableFilteredColetas) && tableFilteredColetas.length
    ? tableFilteredColetas
    : filteredColetas;
}

function getExportRows(items) {
  return items.map((item) => {
    const participant = resolveParticipant(item);

    const row = {
      data: formatDateBR(inferDateISO(item)),
      participante: participant.name || "—",
      codigo: participant.code || "—",
      fluxo: formatFluxoLabel(inferFluxo(item)),
      entrega: inferEntrega(item),
      territorio: inferTerritorio(item),
      tipoCadastro: participant.type || "—",
      status: resolveHumanStatus(item),
      reciclavelKg: Number(inferTotalReciclavelRegistro(item) || 0),
      rejeitoKg: Number(inferTotalRejeitoRegistro(item) || 0),
      naoReciclavelKg: Number(inferRejeitoNaoReciclavel(item) || 0),
      naoComercializadoKg: Number(inferNaoComercializado(item) || 0),
      qualidade: getQualidade(item) || "—",
      observacao: inferObservacao(item) || ""
    };

    MATERIAL_META.forEach((mat) => {
      row[mat.key] = Number(getMaterialValue(item, mat.key) || 0);
    });

    return row;
  });
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);

    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Falha ao carregar ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;

    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };

    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));

    document.head.appendChild(script);
  });
}

async function ensureXLSX() {
  if (window.XLSX) return window.XLSX;

  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");

  return window.XLSX;
}

async function ensureJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

  return window.jspdf?.jsPDF;
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

function extractLatLngFromSource(source) {
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
    source.geo?.latitude
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
    source.geo?.lon
  );

  return {
    lat,
    lng
  };
}

function buildAddressFromParticipant(data = {}) {
  const nested = data.address || {};

  return (
    data.enderecoCompleto ||
    [
      nested.street,
      nested.number,
      nested.neighborhood,
      nested.city,
      nested.state
    ].filter(Boolean).join(", ") ||
    [
      data.rua,
      data.numero,
      data.bairro,
      data.cidade,
      data.uf
    ].filter(Boolean).join(", ")
  );
}

function getColetaPhotoUrls(item = {}) {
  const rawCandidates = [
    item.photoUrl,
    item.photoURL,
    item.imageUrl,
    item.imageURL,
    item.fotoUrl,
    item.fotoURL,
    item.downloadURL,

    item.recebimento?.photoUrl,
    item.recebimento?.photoURL,
    item.recebimento?.imageUrl,
    item.recebimento?.imageURL,
    item.recebimento?.fotoUrl,
    item.recebimento?.downloadURL,

    item.finalTurno?.photoUrl,
    item.finalTurno?.photoURL,
    item.finalTurno?.imageUrl,
    item.finalTurno?.imageURL,
    item.finalTurno?.fotoUrl,
    item.finalTurno?.downloadURL
  ];

  const arrayCandidates = [
    item.photos,
    item.images,
    item.fotos,
    item.attachments,
    item.recebimento?.photos,
    item.recebimento?.images,
    item.recebimento?.fotos,
    item.finalTurno?.photos,
    item.finalTurno?.images,
    item.finalTurno?.fotos
  ].filter(Array.isArray);

  const urls = [];

  rawCandidates.forEach((value) => {
    if (typeof value === "string" && value.trim()) {
      urls.push(value.trim());
    }
  });

  arrayCandidates.forEach((arr) => {
    arr.forEach((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        urls.push(entry.trim());
        return;
      }

      if (entry && typeof entry === "object") {
        const possible = entry.url || entry.downloadURL || entry.photoUrl || entry.imageUrl;

        if (typeof possible === "string" && possible.trim()) {
          urls.push(possible.trim());
        }
      }
    });
  });

  return [...new Set(urls)];
}

function inferCreatorLabel(item = {}) {
  return item.createdByName || item.createdByPublicCode || item.createdBy || "—";
}

function inferParticipantExtraInfo(item = {}) {
  return (
    item.participantType ||
    item.recebimento?.participantType ||
    item.finalTurno?.participantType ||
    item.localType ||
    "—"
  );
}

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
      >×</button>

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

/* =========================
   PERFIL / PARTICIPANTES
========================= */

function matchesProfileTerritory(item, profile) {
  if (!profile?.territoryId) return false;

  const role = normalizeText(profile.role);

  if (role === "admin" || role === "governanca" || role === "gestor") {
    return true;
  }

  const itemTerr = normalizeTerritory(item.territoryId || item.territory || "");

  return sameTerritoryValue(itemTerr, profile.territoryId);
}

function resolveParticipant(item) {
  const participantId = item.participantId || null;

  const participantCode =
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.payloadSnapshot?.participantCode ||
    null;

  const familyCode =
    item.familyCode ||
    item.recebimento?.familyCode ||
    item.finalTurno?.familyCode ||
    item.payloadSnapshot?.familyCode ||
    null;

  const directName =
    item.participantName ||
    item.nomeParticipante ||
    item.name ||
    item.nome ||
    item.payloadSnapshot?.participantName ||
    null;

  const fromId = participantId ? participantsMap.get(String(participantId)) : null;
  const fromParticipantCode = participantCode ? participantsMap.get(String(participantCode)) : null;
  const fromFamilyCode = familyCode ? participantsMap.get(String(familyCode)) : null;

  const matched = fromId || fromParticipantCode || fromFamilyCode || null;

  const fallbackCode =
    participantCode ||
    familyCode ||
    (isFinalTurno(item) ? "F000" : "—");

  let address = "";

  if (matched) {
    address =
      matched.enderecoCompleto ||
      [
        matched.rua || "",
        matched.numero || "",
        matched.bairro || "",
        matched.cidade || ""
      ].filter(Boolean).join(" ");
  }

  const coords = extractLatLngFromSource(matched || {});

  return {
    id: participantId || matched?.id || "",
    code: matched?.participantCode || fallbackCode,
    name:
      directName ||
      matched?.name ||
      (fallbackCode !== "—" ? `Participante ${fallbackCode}` : "Sem participante vinculado"),
    type: matched?.participantType || matched?.type || "",
    status: matched?.status || "—",
    address,
    localColeta: matched?.localColeta || item.localColeta || "",
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

  const found = participantsMap.get(normalized);

  if (!found) {
    els.quickParticipantPreview.classList.add("hidden");
    return;
  }

  els.quickParticipantPreview.classList.remove("hidden");

  if (els.quickParticipantName) {
    els.quickParticipantName.textContent = found.name || "—";
  }

  if (els.quickParticipantCode) {
    els.quickParticipantCode.textContent = found.participantCode || normalized;
  }

  if (els.quickParticipantType) {
    els.quickParticipantType.textContent = found.participantType || "—";
  }

  if (els.quickParticipantStatus) {
    els.quickParticipantStatus.textContent = found.status || "—";
  }

  if (els.quickParticipantAddress) {
    els.quickParticipantAddress.textContent =
      found.enderecoCompleto ||
      [
        found.rua || "",
        found.numero || "",
        found.bairro || "",
        found.cidade || ""
      ].filter(Boolean).join(" ") ||
      "—";
  }
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

function validateProfile(profile) {
  const role = normalizeText(profile.role);

  if (!["cooperativa", "operador", "usuario", "admin", "governanca", "gestor"].includes(role)) {
    throw new Error("Acesso permitido somente para perfis autorizados.");
  }

  const isActiveUser =
    profile.status === "active" ||
    profile.status === "aprovado" ||
    profile.active === true;

  if (!isActiveUser) {
    throw new Error("Usuário sem acesso ativo.");
  }

  if (!["admin", "governanca", "gestor"].includes(role) && !profile.territoryId) {
    throw new Error("Usuário sem território vinculado.");
  }
}

function fillUser(profile) {
  if (els.userDisplayName) {
    els.userDisplayName.textContent = profile.displayName || profile.name || "Usuário";
  }

  if (els.userRole) {
    els.userRole.textContent = profile.role || "cooperativa";
  }

  if (els.userTerritory) {
    els.userTerritory.textContent = profile.territoryLabel || profile.territoryId || "—";
  }
}

/* =========================
   BOTÃO ATUALIZAR DADOS PÚBLICOS
========================= */

function ensureRefreshButton() {
  let btn = document.getElementById("btnRefreshPublicStats");

  if (btn) return btn;

  const topActions = document.querySelector(".top-actions");

  if (!topActions) return null;

  btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btnRefreshPublicStats";
  btn.className = "mini-btn";
  btn.textContent = "Atualizar dados públicos";

  topActions.appendChild(btn);

  btn.addEventListener("click", publishPublicStats);

  return btn;
}

async function publishPublicStats() {
  try {
    const btn = ensureRefreshButton();

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Atualizando...";
    }

    const ativos = allColetas.filter((item) => getStatus(item) !== "cancelado");
    const participantSet = new Set();

    ativos.forEach((item) => {
      const p = resolveParticipant(item);

      if (p.code && p.code !== "—") {
        participantSet.add(p.code);
      }
    });

    const totalReciclavelKg = ativos.reduce((acc, item) => {
      return acc + inferTotalReciclavelRegistro(item);
    }, 0);

    const pontosSet = new Set();

    participantsMap.forEach((p) => {
      if (
        p &&
        sameTerritoryValue(p.territoryId || pageTerritoryId, pageTerritoryId) &&
        (p.lat || p.lng || p.enderecoCompleto || p.localColeta)
      ) {
        pontosSet.add(p.code || p.id || p.name);
      }
    });

    const payload = {
      territoryId: pageTerritoryId,
      territoryLabel: coopProfile?.territoryLabel || pageTerritoryId,
      cooperativaMembersCount: 0,
      participantsCount: participantSet.size,
      totalPublicoPessoas: participantSet.size,
      coletasCount: ativos.length,
      residuosCount: Number((totalReciclavelKg / 1000).toFixed(1)),
      pontosCount: pontosSet.size,
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "dashboard_public_by_cooperativa", pageTerritoryId), payload, { merge: true });
    await setDoc(doc(db, "publicDashboard", pageTerritoryId), payload, { merge: true });

    alert("Dados públicos atualizados com sucesso.");
  } catch (error) {
    console.error("Erro ao atualizar dados públicos:", error);
    alert("Não foi possível atualizar os dados públicos.");
  } finally {
    const btn = document.getElementById("btnRefreshPublicStats");

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Atualizar dados públicos";
    }
  }
}

/* =========================
   FIRESTORE
========================= */

function buildTerritoryQuery(colName) {
  const aliases = getTerritoryAliases(pageTerritoryId);

  if (!aliases.length) {
    return query(collection(db, colName));
  }

  return query(collection(db, colName), where("territoryId", "in", aliases));
}

function loadParticipantsMap() {
  if (activeParticipantsUnsubscribe) {
    activeParticipantsUnsubscribe();
    activeParticipantsUnsubscribe = null;
  }

  activeParticipantsUnsubscribe = onSnapshot(
    buildTerritoryQuery("participants"),
    (snap) => {
      participantsMap.clear();

      snap.forEach((d) => {
        const data = d.data();
        const coords = extractLatLngFromSource(data);

        const payload = {
          id: d.id,
          name: data.name || data.participantName || "Sem nome",
          participantCode: data.participantCode || data.familyCode || data.codigo || d.id,
          participantType: data.participantType || data.type || "",
          status: data.status || "",
          enderecoCompleto: buildAddressFromParticipant(data),
          rua: data.rua || data.address?.street || "",
          numero: data.numero || data.address?.number || "",
          bairro: data.bairro || data.address?.neighborhood || "",
          cidade: data.cidade || data.address?.city || "",
          localColeta: data.localColeta || data.address?.localColeta || "",
          lat: coords.lat,
          lng: coords.lng,
          coords: data.coords || null,
          territoryId: data.territoryId || ""
        };

        participantsMap.set(d.id, payload);

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

function subscribeToQuery(qRef) {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  activeUnsubscribe = onSnapshot(
    qRef,
    (snapshot) => {
      let loaded = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      loaded = sortColetasLocally(loaded);
      allColetas = loaded;

      if (els.dbStatus) {
        els.dbStatus.textContent = "conectado";
      }

      populateFilters(allColetas);
      populateTableFilters(allColetas);
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

function listenColetas() {
  if (els.dbStatus) {
    els.dbStatus.textContent = "conectando…";
  }

  subscribeToQuery(buildTerritoryQuery("coletas"));
}

/* =========================
   FILTROS GERAIS
========================= */

function populateFilters(items) {
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = inferEntrega(item);

    if (entrega && entrega !== "—") {
      entregas.add(entrega);
    }
  });

  const currentEntrega = els.fEntrega?.value || "__all__";

  if (els.fEntrega) {
    els.fEntrega.innerHTML =
      `<option value="__all__">Todos</option>` +
      Array.from(entregas)
        .sort()
        .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
        .join("");

    els.fEntrega.value = Array.from(entregas).includes(currentEntrega)
      ? currentEntrega
      : "__all__";
  }
}

function getSearchTarget(item, participant, searchType) {
  const familyCode =
    item.familyCode ||
    item.recebimento?.familyCode ||
    item.finalTurno?.familyCode ||
    "";

  const targets = {
    participant: `${participant.name} ${item.participantName || ""}`,
    code: `${participant.code} ${item.participantCode || ""} ${familyCode}`,
    creator: `${item.createdByName || ""} ${item.createdByPublicCode || ""} ${item.createdBy || ""}`,
    obs: `${inferObservacao(item)}`,
    delivery: `${inferEntrega(item)}`,
    flow: `${inferFluxo(item)} ${formatFluxoLabel(inferFluxo(item))}`
  };

  if (searchType === "all") {
    return [
      participant.name,
      participant.code,
      familyCode,
      item.createdByName,
      inferEntrega(item),
      inferFluxo(item),
      formatFluxoLabel(inferFluxo(item)),
      inferObservacao(item)
    ].join(" ");
  }

  return targets[searchType] || "";
}

function setDefaultDateRange(items) {
  if (!els.fIni || !els.fFim) return;
  if (els.fIni.value || els.fFim.value || !items.length) return;

  const dates = items.map((item) => inferDateISO(item)).filter(Boolean).sort();

  if (!dates.length) return;

  els.fIni.value = dates[0];
  els.fFim.value = dates[dates.length - 1];
}

function updateTopInfo() {
  if (els.txtRegistrosTopo) {
    els.txtRegistrosTopo.textContent = String(filteredColetas.length);
  }

  const ini = els.fIni?.value || "";
  const fim = els.fFim?.value || "";

  if (els.txtPeriodo) {
    if (ini && fim) {
      els.txtPeriodo.textContent = `${formatDateBR(ini)} → ${formatDateBR(fim)}`;
    } else if (ini) {
      els.txtPeriodo.textContent = `${formatDateBR(ini)} → hoje`;
    } else if (fim) {
      els.txtPeriodo.textContent = `até ${formatDateBR(fim)}`;
    } else {
      const dates = filteredColetas.map((item) => inferDateISO(item)).filter(Boolean).sort();

      els.txtPeriodo.textContent = dates.length
        ? `${formatDateBR(dates[0])} → ${formatDateBR(dates[dates.length - 1])}`
        : "—";
    }
  }
}

function applyFilters() {
  const participantCode = String(els.fParticipantCode?.value || "").trim();
  const fluxo = els.fFluxo?.value || "__all__";
  const entrega = els.fEntrega?.value || "__all__";
  const ini = els.fIni?.value || "";
  const fim = els.fFim?.value || "";
  const busca = normalizeText(els.fBusca?.value || "");
  const searchType = els.fSearchType?.value || "all";

  showQuickParticipantPreviewByCode(participantCode);

  filteredColetas = allColetas.filter((item) => {
    const participant = resolveParticipant(item);
    const searchTarget = normalizeText(getSearchTarget(item, participant, searchType));
    const itemDate = inferDateISO(item);

    if (participantCode) {
      const codeHaystack = [
        participant.code,
        item.participantCode || "",
        item.codigoParticipante || "",
        item.codigo || "",
        item.familyCode || "",
        item.recebimento?.familyCode || "",
        item.finalTurno?.familyCode || ""
      ].map(String).join(" ");

      if (!normalizeText(codeHaystack).includes(normalizeText(participantCode))) {
        return false;
      }
    }

    if (fluxo !== "__all__" && inferFluxo(item) !== fluxo) return false;
    if (entrega !== "__all__" && inferEntrega(item) !== entrega) return false;
    if (ini && itemDate && itemDate < ini) return false;
    if (fim && itemDate && itemDate > fim) return false;
    if (busca && !searchTarget.includes(busca)) return false;

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
  if (els.fSearchType) els.fSearchType.value = "all";

  if (els.quickParticipantPreview) {
    els.quickParticipantPreview.classList.add("hidden");
  }

  applyFilters();
}

/* =========================
   KPIs E MATERIAIS
========================= */

function renderKpis(items) {
  const ativos = items.filter((item) => getStatus(item) !== "cancelado");
  const participantIds = new Set();

  let residuoSeco = 0;
  let rejeitoTotal = 0;
  let finalTurno = 0;

  ativos.forEach((item) => {
    const p = resolveParticipant(item);

    if (p.code && p.code !== "—") {
      participantIds.add(p.code);
    }

    residuoSeco += inferTotalReciclavelRegistro(item);
    rejeitoTotal += inferTotalRejeitoRegistro(item);

    if (isFinalTurno(item)) {
      finalTurno += 1;
    }
  });

  if (els.k_totalColetas) els.k_totalColetas.textContent = String(ativos.length);
  if (els.k_participantes) els.k_participantes.textContent = String(participantIds.size);
  if (els.k_residuoSeco) els.k_residuoSeco.textContent = formatNumber(residuoSeco);
  if (els.k_rejeito) els.k_rejeito.textContent = formatNumber(rejeitoTotal);
  if (els.k_finalTurno) els.k_finalTurno.textContent = String(finalTurno);
}

function sumMaterials(items) {
  const totals = {};

  MATERIAL_META.forEach((mat) => {
    totals[mat.key] = 0;
  });

  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      MATERIAL_META.forEach((mat) => {
        totals[mat.key] += getMaterialValue(item, mat.key);
      });
    });

  return totals;
}

function computeExpandedMetrics(items) {
  const ativos = items.filter((item) => getStatus(item) !== "cancelado");
  const materialTotals = sumMaterials(ativos);

  let reciclavelKg = 0;
  let rejeitoNaoReciclavelKg = 0;
  let naoComercializadoKg = 0;

  const uniqueDays = new Set();
  const participantSet = new Set();
  const condominioSet = new Set();
  const comercioSet = new Set();

  let entregaVoluntaria = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);
    const type = normalizeText(participant.type);

    reciclavelKg += inferTotalReciclavelRegistro(item);
    rejeitoNaoReciclavelKg += inferRejeitoNaoReciclavel(item);
    naoComercializadoKg += inferNaoComercializado(item);

    const d = inferDateISO(item);

    if (d) {
      uniqueDays.add(d);
    }

    if (participant.code && participant.code !== "—") {
      participantSet.add(participant.code);
    }

    if (type === "condominio") {
      condominioSet.add(participant.code || participant.name);
    }

    if (type === "comercio") {
      comercioSet.add(participant.code || participant.name);
    }

    if (normalizeText(inferEntrega(item)).includes("volunt")) {
      entregaVoluntaria += 1;
    }
  });

  const rejeitoTotalKg = rejeitoNaoReciclavelKg + naoComercializadoKg;
  const totalGeral = reciclavelKg + rejeitoTotalKg;

  const reciclavelPct = totalGeral ? (reciclavelKg / totalGeral) * 100 : 0;
  const rejeitoPct = totalGeral ? (rejeitoTotalKg / totalGeral) * 100 : 0;

  let receitaTotal = 0;

  MATERIAL_META.forEach((mat) => {
    receitaTotal += (materialTotals[mat.key] || 0) * mat.price;
  });

  return {
    materialTotals,
    reciclavelKg,
    rejeitoKg: rejeitoTotalKg,
    rejeitoNaoReciclavelKg,
    naoComercializadoKg,
    reciclavelPct,
    rejeitoPct,
    receitaTotal,
    totalDiasProjeto: uniqueDays.size,
    operacoesRealizadas: ativos.length,
    participantesProjeto: participantSet.size,
    condominiosParticipantes: condominioSet.size,
    comercioParticipantes: comercioSet.size,
    entregaVoluntaria
  };
}

function materialSvgIcon(iconId, label = "Material") {
  const safeLabel = escapeHtml(label);

  const icons = {
    "plastic-bottle": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M26 5h12v8l-3 4v5h-6v-5l-3-4V5Z" fill="rgba(255,255,255,.92)"/>
        <path d="M22 22h20c4 0 7 3 7 7v24c0 4-3 7-7 7H22c-4 0-7-3-7-7V29c0-4 3-7 7-7Z" fill="rgba(255,255,255,.82)"/>
        <path d="M21 34h22v15H21V34Z" fill="currentColor" opacity=".95"/>
      </svg>
    `,
    "glass-bottle": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M26 5h12v13l5 8v25c0 6-5 9-11 9s-11-3-11-9V26l5-8V5Z" fill="rgba(255,255,255,.86)"/>
        <path d="M25 30h14v22c0 3-3 5-7 5s-7-2-7-5V30Z" fill="currentColor" opacity=".92"/>
      </svg>
    `,
    "metal-can": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <ellipse cx="32" cy="13" rx="17" ry="7" fill="rgba(255,255,255,.9)"/>
        <path d="M15 13v38c0 4 8 8 17 8s17-4 17-8V13" fill="rgba(255,255,255,.72)"/>
        <path d="M15 27c0 4 8 7 17 7s17-3 17-7M15 42c0 4 8 7 17 7s17-3 17-7" fill="none" stroke="currentColor" stroke-width="4" opacity=".95"/>
      </svg>
    `,
    "bag-waste": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M23 17c2-8 16-8 18 0" fill="none" stroke="rgba(255,255,255,.94)" stroke-width="5" stroke-linecap="round"/>
        <path d="M17 22h30l5 31c1 4-2 7-7 7H19c-5 0-8-3-7-7l5-31Z" fill="rgba(255,255,255,.82)"/>
      </svg>
    `,
    "paper-sheet": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M16 6h24l10 10v42H16V6Z" fill="rgba(255,255,255,.88)"/>
        <path d="M40 6v14h14" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
      </svg>
    `,
    "cardboard-box": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M10 22 32 10l22 12-22 12L10 22Z" fill="rgba(255,255,255,.9)"/>
        <path d="M10 22v25l22 12V34L10 22Z" fill="rgba(255,255,255,.76)"/>
        <path d="M54 22v25L32 59V34l22-12Z" fill="rgba(255,255,255,.62)"/>
      </svg>
    `,
    "foam-cube": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M13 21 32 10l19 11-19 11-19-11Z" fill="rgba(255,255,255,.9)"/>
        <path d="M13 21v22l19 11V32L13 21Z" fill="rgba(255,255,255,.72)"/>
        <path d="M51 21v22L32 54V32l19-11Z" fill="rgba(255,255,255,.62)"/>
      </svg>
    `,
    "oil-drop": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M32 5s18 22 18 36c0 11-8 19-18 19s-18-8-18-19C14 27 32 5 32 5Z" fill="rgba(255,255,255,.86)"/>
        <path d="M32 16s9 13 9 23c0 5-4 9-9 9s-9-4-9-9c0-10 9-23 9-23Z" fill="currentColor" opacity=".92"/>
      </svg>
    `
  };

  return icons[iconId] || icons["plastic-bottle"];
}

function materialLogoMarkup(material) {
  if (!material?.logo) return "";

  return `
    <div class="mat-logo">
      <img
        src="${escapeHtml(material.logo)}"
        alt="Logo ${escapeHtml(material.label)}"
        loading="lazy"
        onerror="this.closest('.mat-logo').style.display='none'"
      />
    </div>
  `;
}

function renderExpandedPanel(items) {
  const m = computeExpandedMetrics(items);
  const allDates = items.map((item) => inferDateISO(item)).filter(Boolean).sort();
  const projectStart = allDates.length ? formatDateBR(allDates[0]) : "—";

  if (els.k_totalDiasProjeto) els.k_totalDiasProjeto.textContent = String(m.totalDiasProjeto);
  if (els.k_inicioProjeto) els.k_inicioProjeto.textContent = `Início: ${projectStart}`;
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

  const rejeitoBase = m.rejeitoKg;
  const pctNaoReciclavel = rejeitoBase ? (m.rejeitoNaoReciclavelKg / rejeitoBase) * 100 : 0;
  const pctNaoComercializado = rejeitoBase ? (m.naoComercializadoKg / rejeitoBase) * 100 : 0;

  if (els.k_rejeitoNaoReciclavelPct) els.k_rejeitoNaoReciclavelPct.textContent = `${formatNumber(pctNaoReciclavel)}%`;
  if (els.k_rejeitoNaoReciclavelKg) els.k_rejeitoNaoReciclavelKg.textContent = formatKg(m.rejeitoNaoReciclavelKg);
  if (els.k_naoComercializadoPct) els.k_naoComercializadoPct.textContent = `${formatNumber(pctNaoComercializado)}%`;
  if (els.k_naoComercializadoKg) els.k_naoComercializadoKg.textContent = formatKg(m.naoComercializadoKg);

  if (els.materialCards) {
    const totalMateriais = Object.values(m.materialTotals).reduce((acc, v) => acc + v, 0);

    els.materialCards.innerHTML = MATERIAL_META.map((mat) => {
      const kg = m.materialTotals[mat.key] || 0;
      const pct = totalMateriais ? (kg / totalMateriais) * 100 : 0;
      const receita = kg * mat.price;

      return `
        <article class="material-card professional-card ${mat.isSpecial ? "special-flow-card" : ""}" style="--material-color:${mat.color}">
          <div class="material-top">
            <div class="icon-group">
              <div class="mat-icon professional-icon">
                ${materialSvgIcon(mat.icon, mat.label)}
              </div>
              ${materialLogoMarkup(mat)}
            </div>
            <div class="mat-pct">${mat.isSpecial ? "Fluxo especial" : `${formatNumber(pct)}%`}</div>
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
}