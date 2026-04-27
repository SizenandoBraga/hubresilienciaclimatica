import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
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

const MATERIAL_OLEO = {
  key: "oleoKg",
  label: "Óleo de cozinha",
  price: 1.5,
  icon: "oil-drop",
  color: "#C79200",
  logo: "img/logos/oleo.svg",
  isSpecial: true
};

const CHART_COLORS = {
  blue: "#53ACDE",
  green: "#81B92A",
  orange: "#EF6B22"
};

const COOP_BASES = {
  "vila-pinto": { lat: -30.048729170292532, lng: -51.15652604283108 },
  "cooadesc": { lat: -30.003, lng: -51.206 },
  "padre-cacique": { lat: -30.140122365657504, lng: -51.1268772051727 }
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

  /* Campos das frações de resíduos no modal de edição */
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

/* Camadas próprias para a rota geral da coleta */
let routeFullLayer = null;
let routeMarkersLayer = null;
let routeRequestSeq = 0;

let selectedPointKey = null;
let activeUnsubscribe = null;
let activeParticipantsUnsubscribe = null;

/* =========================
   UTILS
========================= */

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function materialSvgIcon(iconId, label = "Material") {
  const safeLabel = escapeHtml(label);

  const icons = {
    "plastic-bottle": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M26 5h12v8l-3 4v5h-6v-5l-3-4V5Z" fill="rgba(255,255,255,.92)"/>
        <path d="M22 22h20c4 0 7 3 7 7v24c0 4-3 7-7 7H22c-4 0-7-3-7-7V29c0-4 3-7 7-7Z" fill="rgba(255,255,255,.82)"/>
        <path d="M21 34h22v15H21V34Z" fill="currentColor" opacity=".95"/>
        <path d="M27 42c3-6 9-6 12-2m-2-5 2 5-5 1" fill="none" stroke="rgba(255,255,255,.95)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "glass-bottle": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M26 5h12v13l5 8v25c0 6-5 9-11 9s-11-3-11-9V26l5-8V5Z" fill="rgba(255,255,255,.86)"/>
        <path d="M25 30h14v22c0 3-3 5-7 5s-7-2-7-5V30Z" fill="currentColor" opacity=".92"/>
        <path d="M28 9h8M27 17h10" stroke="rgba(255,255,255,.95)" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 34v15" stroke="rgba(255,255,255,.92)" stroke-width="3" stroke-linecap="round" opacity=".8"/>
      </svg>
    `,
    "metal-can": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <ellipse cx="32" cy="13" rx="17" ry="7" fill="rgba(255,255,255,.9)"/>
        <path d="M15 13v38c0 4 8 8 17 8s17-4 17-8V13" fill="rgba(255,255,255,.72)"/>
        <path d="M15 27c0 4 8 7 17 7s17-3 17-7M15 42c0 4 8 7 17 7s17-3 17-7" fill="none" stroke="currentColor" stroke-width="4" opacity=".95"/>
        <ellipse cx="32" cy="13" rx="17" ry="7" fill="none" stroke="currentColor" stroke-width="4"/>
      </svg>
    `,
    "bag-waste": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M23 17c2-8 16-8 18 0" fill="none" stroke="rgba(255,255,255,.94)" stroke-width="5" stroke-linecap="round"/>
        <path d="M17 22h30l5 31c1 4-2 7-7 7H19c-5 0-8-3-7-7l5-31Z" fill="rgba(255,255,255,.82)"/>
        <path d="M22 30h20M24 40h16M26 50h12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `,
    "paper-sheet": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M16 6h24l10 10v42H16V6Z" fill="rgba(255,255,255,.88)"/>
        <path d="M40 6v14h14" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
        <path d="M23 28h18M23 38h24M23 48h20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
      </svg>
    `,
    "cardboard-box": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M10 22 32 10l22 12-22 12L10 22Z" fill="rgba(255,255,255,.9)"/>
        <path d="M10 22v25l22 12V34L10 22Z" fill="rgba(255,255,255,.76)"/>
        <path d="M54 22v25L32 59V34l22-12Z" fill="rgba(255,255,255,.62)"/>
        <path d="M10 22 32 34l22-12M32 34v25M21 16l22 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "foam-cube": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M13 21 32 10l19 11-19 11-19-11Z" fill="rgba(255,255,255,.9)"/>
        <path d="M13 21v22l19 11V32L13 21Z" fill="rgba(255,255,255,.72)"/>
        <path d="M51 21v22L32 54V32l19-11Z" fill="rgba(255,255,255,.62)"/>
        <circle cx="23" cy="26" r="2.5" fill="currentColor"/>
        <circle cx="35" cy="21" r="2.5" fill="currentColor"/>
        <circle cx="41" cy="36" r="2.5" fill="currentColor"/>
        <circle cx="26" cy="43" r="2.5" fill="currentColor"/>
        <path d="M32 32v22M13 21l19 11 19-11" fill="none" stroke="currentColor" stroke-width="3" opacity=".75"/>
      </svg>
    `,
    "oil-drop": `
      <svg viewBox="0 0 64 64" role="img" aria-label="${safeLabel}" focusable="false">
        <path d="M32 5s18 22 18 36c0 11-8 19-18 19s-18-8-18-19C14 27 32 5 32 5Z" fill="rgba(255,255,255,.86)"/>
        <path d="M25 43c0 5 4 9 9 9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
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

  if (v === "cooadesc" || v === "crgr-cooadesc") {
    return ["cooadesc", "crgr-cooadesc"];
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
  const role = normalizeText(profile?.role);

  if (role === "admin" || role === "governanca" || role === "gestor") {
    return bodyTerritory || urlTerritory || userTerritory || "";
  }

  return userTerritory || bodyTerritory || urlTerritory || "";
}

function createdAtToISO(item) {
  if (item.createdAt?.toDate) return item.createdAt.toDate().toISOString();
  if (item.updatedAt?.toDate) return item.updatedAt.toDate().toISOString();
  return "";
}

function inferDateISO(item) {
  if (item.opDate) return String(item.opDate).slice(0, 10);
  const iso = createdAtToISO(item);
  return iso ? iso.slice(0, 10) : "";
}

function inferDateTimeISO(item) {
  return createdAtToISO(item) || item.opDate || "";
}

function inferFluxo(item) {
  return String(item.flowType || "").toLowerCase() || "—";
}

function isFinalTurno(item) {
  return inferFluxo(item) === "final_turno";
}

function inferEntrega(item) {
  return item.deliveryType || "—";
}

function inferTerritorio(item) {
  return item.territoryLabel || coopProfile?.territoryLabel || pageTerritoryId || "Território";
}

function inferResiduoSeco(item) {
  return Number(
    item.recebimento?.pesoResiduoSecoKg ??
    item.finalTurno?.pesoResiduoSecoKg ??
    item.pesoResiduoSecoKg ??
    0
  );
}

function inferRejeito(item) {
  return Number(
    item.recebimento?.pesoRejeitoKg ??
    item.finalTurno?.pesoRejeitoKg ??
    item.recebimento?.rejeitoKg ??
    item.finalTurno?.rejeitoKg ??
    item.pesoRejeitoKg ??
    item.rejeitoKg ??
    0
  );
}

function inferNaoComercializado(item) {
  return Number(
    item.recebimento?.pesoNaoComercializadoKg ??
    item.finalTurno?.pesoNaoComercializadoKg ??
    item.pesoNaoComercializadoKg ??
    0
  );
}

function inferObservacao(item) {
  return item.observacao || item.recebimento?.observacao || item.finalTurno?.observacao || "";
}

function getQualidade(item) {
  const value =
    item.recebimento?.qualidadeNota ??
    item.finalTurno?.qualidadeNota ??
    item.qualidadeNota;

  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function getStatus(item) {
  return String(item.status || "ativo").toLowerCase();
}

function getMaterialValue(item, key) {
  const fontes = [
    item.materiais,
    item.recebimento?.materiais,
    item.finalTurno?.materiais,
    item.recebimento,
    item.finalTurno,
    item
  ].filter(Boolean);

  for (const fonte of fontes) {
    if (fonte[key] !== undefined && fonte[key] !== null && fonte[key] !== "") {
      return Number(fonte[key] || 0);
    }
  }

  return 0;
}

function sortColetasLocally(items) {
  return [...items].sort((a, b) => {
    const aDate = String(inferDateTimeISO(a) || "");
    const bDate = String(inferDateTimeISO(b) || "");
    return bDate.localeCompare(aDate);
  });
}

function getExportBaseItems() {
  return Array.isArray(tableFilteredColetas) && tableFilteredColetas.length
    ? tableFilteredColetas
    : filteredColetas;
}

function inferTotalReciclavelRegistro(item) {
  const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
  return isFinalTurno(item)
    ? somaMateriais
    : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item));
}

function getExportRows(items) {
  return items.map((item) => {
    const participant = resolveParticipant(item);

    const row = {
      data: formatDateBR(inferDateISO(item)),
      participante: participant.name || "—",
      codigo: participant.code || "—",
      fluxo: inferFluxo(item),
      entrega: inferEntrega(item),
      territorio: inferTerritorio(item),
      tipoCadastro: participant.type || "—",
      status: resolveHumanStatus(item),
      reciclavelKg: Number(inferTotalReciclavelRegistro(item) || 0),
      rejeitoKg: Number(inferRejeito(item) || 0),
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

function firstFinite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractLatLngFromSource(source) {
  if (!source || typeof source !== "object") return { lat: null, lng: null };

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

  return { lat, lng };
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
    if (typeof value === "string" && value.trim()) urls.push(value.trim());
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
  if (role === "admin" || role === "governanca" || role === "gestor") return true;

  const itemTerr = normalizeTerritory(item.territoryId || item.territory || "");
  return sameTerritoryValue(itemTerr, profile.territoryId);
}

function resolveParticipant(item) {
  const participantId = item.participantId || null;
  const participantCode = item.participantCode || null;
  const familyCode =
    item.familyCode ||
    item.recebimento?.familyCode ||
    item.finalTurno?.familyCode ||
    null;
  const directName = item.participantName || null;

  const fromId = participantId ? participantsMap.get(String(participantId)) : null;
  const fromParticipantCode = participantCode ? participantsMap.get(String(participantCode)) : null;
  const fromFamilyCode = familyCode ? participantsMap.get(String(familyCode)) : null;

  const matched = fromId || fromParticipantCode || fromFamilyCode || null;
  const fallbackCode = participantCode || familyCode || "—";

  let address = "";
  if (matched) {
    address =
      matched.enderecoCompleto ||
      [matched.rua || "", matched.numero || "", matched.bairro || "", matched.cidade || ""]
        .filter(Boolean)
        .join(" ");
  }

  const coords = extractLatLngFromSource(matched || {});

  return {
    id: participantId || matched?.id || "",
    code: matched?.participantCode || fallbackCode,
    name: directName || matched?.name || (fallbackCode !== "—" ? `Participante ${fallbackCode}` : "Sem participante vinculado"),
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
  if (els.quickParticipantName) els.quickParticipantName.textContent = found.name || "—";
  if (els.quickParticipantCode) els.quickParticipantCode.textContent = found.participantCode || normalized;
  if (els.quickParticipantType) els.quickParticipantType.textContent = found.participantType || "—";
  if (els.quickParticipantStatus) els.quickParticipantStatus.textContent = found.status || "—";
  if (els.quickParticipantAddress) {
    els.quickParticipantAddress.textContent =
      found.enderecoCompleto ||
      [found.rua || "", found.numero || "", found.bairro || "", found.cidade || ""]
        .filter(Boolean)
        .join(" ") ||
      "—";
  }
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado.");
  return { id: snap.id, ...snap.data() };
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
  if (els.userDisplayName) els.userDisplayName.textContent = profile.displayName || profile.name || "Usuário";
  if (els.userRole) els.userRole.textContent = profile.role || "cooperativa";
  if (els.userTerritory) els.userTerritory.textContent = profile.territoryLabel || profile.territoryId || "—";
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
      if (p.code && p.code !== "—") participantSet.add(p.code);
    });

    const totalReciclavelKg = ativos.reduce((acc, item) => {
      const somaMateriais = MATERIAL_META.reduce((sum, mat) => sum + getMaterialValue(item, mat.key), 0);
      return acc + (isFinalTurno(item) ? somaMateriais : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item)));
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
        if (data.participantCode) participantsMap.set(String(data.participantCode), payload);
        if (data.familyCode) participantsMap.set(String(data.familyCode), payload);
        if (data.codigo) participantsMap.set(String(data.codigo), payload);
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

      if (els.dbStatus) els.dbStatus.textContent = "conectado";

      populateFilters(allColetas);
      populateTableFilters(allColetas);
      setDefaultDateRange(allColetas);
      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar coletas:", error);
      if (els.dbStatus) els.dbStatus.textContent = "erro";
      alert("Não foi possível carregar os registros das coletas.");
    }
  );
}

function listenColetas() {
  if (els.dbStatus) els.dbStatus.textContent = "conectando…";
  subscribeToQuery(buildTerritoryQuery("coletas"));
}

/* =========================
   FILTROS GERAIS
========================= */

function populateFilters(items) {
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "—") entregas.add(entrega);
  });

  const currentEntrega = els.fEntrega?.value || "__all__";

  if (els.fEntrega) {
    els.fEntrega.innerHTML =
      `<option value="__all__">Todos</option>` +
      Array.from(entregas)
        .sort()
        .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
        .join("");

    els.fEntrega.value = Array.from(entregas).includes(currentEntrega) ? currentEntrega : "__all__";
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
    flow: `${inferFluxo(item)}`
  };

  if (searchType === "all") {
    return [
      participant.name,
      participant.code,
      familyCode,
      item.createdByName,
      inferEntrega(item),
      inferFluxo(item),
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
  if (els.txtRegistrosTopo) els.txtRegistrosTopo.textContent = String(filteredColetas.length);

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
        item.familyCode || "",
        item.recebimento?.familyCode || "",
        item.finalTurno?.familyCode || ""
      ]
        .map(String)
        .join(" ");

      if (!normalizeText(codeHaystack).includes(normalizeText(participantCode))) return false;
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
  if (els.quickParticipantPreview) els.quickParticipantPreview.classList.add("hidden");
  applyFilters();
}

/* =========================
   KPIs E MATERIAIS
========================= */

function renderKpis(items) {
  const ativos = items.filter((item) => getStatus(item) !== "cancelado");
  const participantIds = new Set();

  let residuoSeco = 0;
  let rejeito = 0;
  let finalTurno = 0;

  ativos.forEach((item) => {
    const p = resolveParticipant(item);
    if (p.code && p.code !== "—") participantIds.add(p.code);

    const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);

    residuoSeco += isFinalTurno(item)
      ? somaMateriais
      : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item));

    rejeito += inferRejeito(item);

    if (isFinalTurno(item)) finalTurno += 1;
  });

  if (els.k_totalColetas) els.k_totalColetas.textContent = String(ativos.length);
  if (els.k_participantes) els.k_participantes.textContent = String(participantIds.size);
  if (els.k_residuoSeco) els.k_residuoSeco.textContent = formatNumber(residuoSeco);
  if (els.k_rejeito) els.k_rejeito.textContent = formatNumber(rejeito);
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
  let rejeitoKg = 0;
  let naoComercializadoKg = 0;

  const uniqueDays = new Set();
  const participantSet = new Set();
  const condominioSet = new Set();
  const comercioSet = new Set();

  let entregaVoluntaria = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);
    const type = normalizeText(participant.type);

    const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);

    reciclavelKg += isFinalTurno(item)
      ? somaMateriais
      : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item));

    rejeitoKg += inferRejeito(item);
    naoComercializadoKg += inferNaoComercializado(item);

    const d = inferDateISO(item);
    if (d) uniqueDays.add(d);

    if (participant.code && participant.code !== "—") participantSet.add(participant.code);
    if (type === "condominio") condominioSet.add(participant.code || participant.name);
    if (type === "comercio") comercioSet.add(participant.code || participant.name);
    if (normalizeText(inferEntrega(item)).includes("volunt")) entregaVoluntaria += 1;
  });

  const totalGeral = reciclavelKg + rejeitoKg;
  const reciclavelPct = totalGeral ? (reciclavelKg / totalGeral) * 100 : 0;
  const rejeitoPct = totalGeral ? (rejeitoKg / totalGeral) * 100 : 0;

  let receitaTotal = 0;
  MATERIAL_META.forEach((mat) => {
    receitaTotal += (materialTotals[mat.key] || 0) * mat.price;
  });

  return {
    materialTotals,
    reciclavelKg,
    rejeitoKg,
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

  const rejeitoBase = m.rejeitoKg + m.naoComercializadoKg;
  const pctNaoReciclavel = rejeitoBase ? (m.rejeitoKg / rejeitoBase) * 100 : 0;
  const pctNaoComercializado = rejeitoBase ? (m.naoComercializadoKg / rejeitoBase) * 100 : 0;

  if (els.k_rejeitoNaoReciclavelPct) els.k_rejeitoNaoReciclavelPct.textContent = `${formatNumber(pctNaoReciclavel)}%`;
  if (els.k_rejeitoNaoReciclavelKg) els.k_rejeitoNaoReciclavelKg.textContent = formatKg(m.rejeitoKg);
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
}/* =========================
   GRÁFICOS
========================= */

function getChartOptions(type, horizontal = false) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom"
      }
    }
  };

  if (type === "doughnut" || type === "pie") return base;

  return {
    ...base,
    scales: horizontal
      ? { x: { beginAtZero: true } }
      : { y: { beginAtZero: true } }
  };
}

function renderWeightTimeline(items) {
  const canvas = document.getElementById("weightTimelineChart");
  if (!canvas || typeof Chart === "undefined") return;

  const valid = [...items]
    .filter((item) => getStatus(item) !== "cancelado")
    .sort((a, b) => String(inferDateTimeISO(a)).localeCompare(String(inferDateTimeISO(b))))
    .slice(-40);

  const labels = valid.map((item) => String(inferDateISO(item)).slice(5, 10));
  const reciclavel = valid.map((item) => {
    const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
    return isFinalTurno(item) ? somaMateriais : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item));
  });
  const rejeito = valid.map((item) => inferRejeito(item));

  if (weightTimelineChart) weightTimelineChart.destroy();

  weightTimelineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Peso do rejeito", data: rejeito, backgroundColor: "rgba(239,107,34,.75)" },
        { label: "Peso do reciclável", data: reciclavel, backgroundColor: "rgba(129,185,42,.75)" }
      ]
    },
    options: getChartOptions("bar")
  });
}

function buildDailySeries(items) {
  const map = new Map();
  items.filter((i) => getStatus(i) !== "cancelado").forEach((item) => {
    const d = inferDateISO(item);
    if (d) map.set(d, (map.get(d) || 0) + 1);
  });
  const labels = Array.from(map.keys()).sort();
  return { labels, values: labels.map((l) => map.get(l)) };
}

function buildFlowSeries(items) {
  const map = { recebimento: 0, final_turno: 0 };
  items.filter((i) => getStatus(i) !== "cancelado").forEach((item) => {
    const fluxo = inferFluxo(item);
    if (map[fluxo] !== undefined) map[fluxo] += 1;
  });
  return {
    labels: ["recebimento", "final_turno"],
    values: [map.recebimento, map.final_turno]
  };
}

function buildMaterialSeries(items) {
  const totals = sumMaterials(items);
  const filtered = MATERIAL_META.filter((mat) => (totals[mat.key] || 0) > 0);
  return {
    labels: filtered.map((m) => m.label),
    values: filtered.map((m) => totals[m.key] || 0)
  };
}

function buildCollectionPointsSeries(items) {
  const map = new Map();
  items.filter((i) => getStatus(i) !== "cancelado").forEach((item) => {
    const participant = resolveParticipant(item);
    const key = participant.localColeta || participant.address || inferEntrega(item) || "Ponto não informado";
    map.set(key, (map.get(key) || 0) + 1);
  });
  const labels = Array.from(map.keys());
  return { labels, values: labels.map((l) => map.get(l)) };
}

function renderCharts(items) {
  const ctxMain = document.getElementById("mainChart");
  const ctxA = document.getElementById("secA");
  const ctxB = document.getElementById("secB");
  const ctxC = document.getElementById("secC");

  if (typeof Chart === "undefined") return;
  if (!ctxMain && !ctxA && !ctxB && !ctxC) return;

  [mainChart, secA, secB, secC].forEach((chart) => {
    if (chart) chart.destroy();
  });

  const daily = buildDailySeries(items);
  const flow = buildFlowSeries(items);
  const material = buildMaterialSeries(items);
  const points = buildCollectionPointsSeries(items);

  const mainType = els.chartMainType?.value || "line";
  const flowType = els.chartFlowType?.value || "doughnut";
  const materialType = els.chartDeliveryType?.value || "bar";
  const pointsType = els.chartTerritoryType?.value || "bar";

  if (ctxMain) {
    mainChart = new Chart(ctxMain, {
      type: mainType,
      data: {
        labels: daily.labels,
        datasets: [{
          label: "Quantidade de coletas",
          data: daily.values,
          borderColor: CHART_COLORS.blue,
          backgroundColor: "rgba(83,172,222,.20)",
          fill: mainType === "line",
          tension: 0.35,
          pointRadius: mainType === "line" ? 4 : 0
        }]
      },
      options: getChartOptions(mainType)
    });
  }

  if (ctxA) {
    secA = new Chart(ctxA, {
      type: flowType,
      data: {
        labels: flow.labels,
        datasets: [{
          label: "Tipos de coletas",
          data: flow.values,
          backgroundColor: ["rgba(83,172,222,.78)", "rgba(129,185,42,.78)"],
          borderColor: [CHART_COLORS.blue, CHART_COLORS.green],
          borderWidth: flowType === "bar" ? 1.5 : 0
        }]
      },
      options: getChartOptions(flowType)
    });
  }

  if (ctxB) {
    secB = new Chart(ctxB, {
      type: materialType,
      data: {
        labels: material.labels,
        datasets: [{
          label: "Coletas por materiais",
          data: material.values,
          backgroundColor: material.labels.map(() => "rgba(129,185,42,.40)"),
          borderColor: material.labels.map(() => CHART_COLORS.green),
          borderWidth: materialType === "line" ? 3 : 1.5,
          fill: materialType === "line"
        }]
      },
      options: getChartOptions(materialType)
    });
  }

  if (ctxC) {
    secC = new Chart(ctxC, {
      type: pointsType,
      data: {
        labels: points.labels,
        datasets: [{
          label: "Pontos de coleta",
          data: points.values,
          backgroundColor: points.labels.map(() => "rgba(83,172,222,.28)"),
          borderColor: points.labels.map(() => CHART_COLORS.blue),
          borderWidth: pointsType === "line" ? 3 : 1.5,
          fill: pointsType === "line"
        }]
      },
      options: {
        ...getChartOptions(pointsType, pointsType === "bar"),
        indexAxis: pointsType === "bar" ? "y" : "x"
      }
    });
  }
}

/* =========================
   MAPA E ROTA
========================= */

function getCoopBaseLatLng() {
  const aliases = getTerritoryAliases(pageTerritoryId);
  const territoryKey = aliases[0] || "vila-pinto";
  return COOP_BASES[territoryKey] || COOP_BASES["vila-pinto"];
}

function initCollectionRouteMap() {
  const mapEl = document.getElementById("collectionRouteMap");
  if (!mapEl || typeof L === "undefined") return;

  if (routeMap) {
    routeMap.invalidateSize();
    return;
  }

  const base = getCoopBaseLatLng();

  routeMap = L.map("collectionRouteMap", { zoomControl: true }).setView([base.lat, base.lng], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(routeMap);

  L.marker([base.lat, base.lng]).addTo(routeMap).bindPopup("Cooperativa");
}

function setRouteSummary(origin, dest, summary = null) {
  if (els.routeOriginLabel) els.routeOriginLabel.textContent = origin || "—";
  if (els.routeDestLabel) els.routeDestLabel.textContent = dest || "—";

  if (!summary) {
    if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = "—";
    if (els.routeTimeLabel) els.routeTimeLabel.textContent = "—";
    return;
  }

  const km = (summary.totalDistance || 0) / 1000;
  const min = Math.round((summary.totalTime || 0) / 60);

  if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  if (els.routeTimeLabel) els.routeTimeLabel.textContent = `${min} min`;
}

function clearRouteControl() {
  if (routeControl && routeMap) {
    routeMap.removeControl(routeControl);
    routeControl = null;
  }
  if (destinationMarker && routeMap) {
    routeMap.removeLayer(destinationMarker);
    destinationMarker = null;
  }
}


function isValidLatLngPoint(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/* Remove duplicados e limita pontos para evitar erro/travamento no OSRM público */
function sanitizeRoutePoints(points, limit = 24) {
  const seen = new Set();
  const valid = [];

  points.forEach((point) => {
    if (!isValidLatLngPoint(point)) return;

    const lat = Number(point.lat);
    const lng = Number(point.lng);
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

    if (seen.has(key)) return;
    seen.add(key);

    valid.push({
      ...point,
      lat,
      lng
    });
  });

  return valid.slice(0, limit);
}

function distanceApproxKm(a, b) {
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  const r = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);

  const h =
    s1 * s1 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      s2 * s2;

  return 2 * r * Math.asin(Math.sqrt(h));
}

/* Ordenação simples por vizinho mais próximo para deixar a rota mais prática */
function orderPointsNearestNeighbor(origin, points) {
  const remaining = [...points];
  const ordered = [];
  let current = origin;

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((point, index) => {
      const d = distanceApproxKm(current, point);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });

    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

function clearFullCollectionRoute() {
  if (routeFullLayer && routeMap) {
    routeMap.removeLayer(routeFullLayer);
    routeFullLayer = null;
  }

  if (routeMarkersLayer && routeMap) {
    routeMap.removeLayer(routeMarkersLayer);
    routeMarkersLayer = null;
  }
}

/*
  Rota geral da coleta:
  - origem: cooperativa
  - destino: pontos filtrados da tabela/dashboard
  - formato OSRM: longitude,latitude
*/
async function drawFullCollectionRoute(points) {
  if (!routeMap || typeof L === "undefined") return;

  const requestId = ++routeRequestSeq;
  const base = getCoopBaseLatLng();
  const origin = {
    lat: Number(base.lat),
    lng: Number(base.lng),
    name: "Cooperativa",
    code: "Origem"
  };

  const validPoints = sanitizeRoutePoints(points, 24);
  clearRouteControl();
  clearFullCollectionRoute();

  routeMarkersLayer = L.layerGroup().addTo(routeMap);

  L.marker([origin.lat, origin.lng])
    .addTo(routeMarkersLayer)
    .bindPopup("<strong>Cooperativa</strong><br>Origem da rota");

  validPoints.forEach((point, index) => {
    L.marker([point.lat, point.lng])
      .addTo(routeMarkersLayer)
      .bindPopup(`
        <strong>${escapeHtml(point.name || "Ponto de coleta")}</strong><br>
        Código: ${escapeHtml(point.code || "—")}<br>
        Ordem sugerida: ${index + 1}
      `);
  });

  if (!validPoints.length) {
    setRouteSummary("Cooperativa", "Nenhum ponto com coordenadas", null);
    routeMap.setView([origin.lat, origin.lng], 12);
    return;
  }

  const ordered = orderPointsNearestNeighbor(origin, validPoints);
  const osrmPoints = [origin, ...ordered];

  const coords = osrmPoints
    .map((point) => `${Number(point.lng)},${Number(point.lat)}`)
    .join(";");

  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    setRouteSummary("Cooperativa", `${ordered.length} ponto(s) de coleta`, null);

    const response = await fetch(url);

    if (requestId !== routeRequestSeq) return;

    if (!response.ok) {
      throw new Error(`Falha ao calcular rota real. Status ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route?.geometry) {
      throw new Error("OSRM não retornou geometria da rota.");
    }

    routeFullLayer = L.geoJSON(route.geometry, {
      style: {
        color: "#53ACDE",
        opacity: 0.92,
        weight: 6
      }
    }).addTo(routeMap);

    const km = (route.distance || 0) / 1000;
    const min = Math.round((route.duration || 0) / 60);

    if (els.routeOriginLabel) els.routeOriginLabel.textContent = "Cooperativa";
    if (els.routeDestLabel) els.routeDestLabel.textContent = `${ordered.length} ponto(s) de coleta`;
    if (els.routeDistanceLabel) {
      els.routeDistanceLabel.textContent = `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
    }
    if (els.routeTimeLabel) {
      els.routeTimeLabel.textContent = `${min} min`;
    }

    const bounds = routeFullLayer.getBounds();
    if (bounds.isValid()) {
      routeMap.fitBounds(bounds, { padding: [28, 28] });
    }
  } catch (error) {
    console.error("Erro ao calcular rota da coleta:", error);

    const bounds = L.latLngBounds([
      [origin.lat, origin.lng],
      ...validPoints.map((point) => [point.lat, point.lng])
    ]);

    if (bounds.isValid()) {
      routeMap.fitBounds(bounds, { padding: [28, 28] });
    }

    if (els.routeOriginLabel) els.routeOriginLabel.textContent = "Cooperativa";
    if (els.routeDestLabel) els.routeDestLabel.textContent = `${validPoints.length} ponto(s) sem rota real`;
    if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = "rota indisponível";
    if (els.routeTimeLabel) els.routeTimeLabel.textContent = "—";
  }
}


function drawRouteToPoint(point) {
  if (!routeMap || !point?.lat || !point?.lng || typeof L === "undefined" || !L.Routing) return;

  const base = getCoopBaseLatLng();
  clearFullCollectionRoute();
  clearRouteControl();

  destinationMarker = L.marker([point.lat, point.lng]).addTo(routeMap).bindPopup(point.name || "Destino");

  routeControl = L.Routing.control({
    waypoints: [L.latLng(base.lat, base.lng), L.latLng(point.lat, point.lng)],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    lineOptions: {
      styles: [{ color: "#53ACDE", opacity: 0.9, weight: 6 }]
    },
    createMarker: () => null
  }).addTo(routeMap);

  routeControl.on("routesfound", (e) => {
    const route = e.routes?.[0];
    setRouteSummary("Cooperativa", point.name || "Ponto de coleta", route?.summary || null);
  });

  setRouteSummary("Cooperativa", point.name || "Ponto de coleta", null);
}

function getParticipantPointDataFromMapItems(items) {
  const map = new Map();

  items.forEach((item) => {
    const participant = resolveParticipant(item);
    if (!participant.name || participant.name === "Sem participante vinculado") return;
    if (!participant.lat || !participant.lng) return;

    const key = participant.code || participant.name;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: participant.name,
        code: participant.code,
        address: participant.address || "Endereço não informado",
        localColeta: participant.localColeta || inferEntrega(item) || "Coleta",
        territory: inferTerritorio(item),
        lat: participant.lat,
        lng: participant.lng
      });
    }
  });

  return Array.from(map.values());
}

function renderCollectionPoints(items) {
  initCollectionRouteMap();
  if (!els.collectionPointsGrid) return;

  const points = getParticipantPointDataFromMapItems(items);

  if (!points.length) {
    els.collectionPointsGrid.innerHTML = `
      <div class="point-card">
        <h4>Pontos de coleta</h4>
        <div class="point-address">Nenhum ponto de coleta com coordenadas cadastrado para os filtros atuais.</div>
      </div>
    `;
    setRouteSummary("—", "—", null);
    clearRouteControl();
    clearFullCollectionRoute();
    return;
  }

  els.collectionPointsGrid.innerHTML = points.map((point) => `
    <article class="point-card ${selectedPointKey === point.key ? "active" : ""}" data-route-point="${escapeHtml(point.key)}">
      <div class="point-code">${escapeHtml(point.code || "sem código")}</div>
      <h4>${escapeHtml(point.name)}</h4>
      <div class="point-address">${escapeHtml(point.address || "Endereço não informado")}</div>
      <div class="point-meta">
        <span class="point-chip">📍 ${escapeHtml(point.localColeta || "Coleta")}</span>
        <span class="point-chip">🗺️ ${escapeHtml(point.territory || "Território")}</span>
      </div>
    </article>
  `).join("");

  if (!selectedPointKey) selectedPointKey = points[0].key;

  /* Desenha a rota geral da coleta usando todos os pontos filtrados com coordenadas */
  drawFullCollectionRoute(points);
}

/* =========================
   TABELA
========================= */

function renderStatusBadge(item) {
  const status = getStatus(item);

  if (status === "cancelado") {
    return `<span class="status-badge status-cancelado">Cancelado</span>`;
  }
  if (item.updatedAt) {
    return `<span class="status-badge status-editado">Editado</span>`;
  }
  return `<span class="status-badge status-ok">Ativo</span>`;
}

function resolveHumanStatus(item) {
  const status = getStatus(item);
  if (status === "cancelado") return "cancelado";
  if (item.updatedAt) return "editado";
  return "ativo";
}

function getParticipantTypeForTable(item) {
  const participant = resolveParticipant(item);
  const type = normalizeText(participant.type);
  if (type === "participante" || type === "condominio" || type === "comercio") return type;
  return "outro";
}

function populateTableFilters(items) {
  if (!els.tEntrega) return;
  const entregas = new Set();
  items.forEach((item) => {
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "—") entregas.add(entrega);
  });

  const current = els.tEntrega.value || "__all__";
  els.tEntrega.innerHTML =
    `<option value="__all__">Todas</option>` +
    Array.from(entregas)
      .sort()
      .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
      .join("");

  els.tEntrega.value = Array.from(entregas).includes(current) ? current : "__all__";
}

function updateTableSummary() {
  if (els.tableVisibleCount) els.tableVisibleCount.textContent = String(tableFilteredColetas.length);
  if (els.tableFilteredCount) els.tableFilteredCount.textContent = String(filteredColetas.length);
  if (els.tableLastUpdate) {
    const latest = tableFilteredColetas[0] ? inferDateTimeISO(tableFilteredColetas[0]) : "";
    els.tableLastUpdate.textContent = latest ? formatDateTimeBR(latest) : "—";
  }
}

function openCollectionDetailsModal(itemId) {
  const item = allColetas.find((x) => x.id === itemId);
  if (!item) return;

  const modal = ensureCollectionDetailsModal();
  const content = document.getElementById("collectionDetailsContent");
  if (!content) return;

  const participant = resolveParticipant(item);
  const photos = getColetaPhotoUrls(item);

  const materialsHtml = MATERIAL_META
    .map((mat) => {
      const value = getMaterialValue(item, mat.key);
      if (!value) return "";
      return `<div><strong>${escapeHtml(mat.label)}:</strong> ${formatKg(value)}</div>`;
    })
    .filter(Boolean)
    .join("");

  const rawPayload = escapeHtml(JSON.stringify(item, null, 2));

  content.innerHTML = `
    <div class="collection-details-grid">
      <div class="collection-details-fields">
        <div class="read-box"><strong>Data:</strong> ${escapeHtml(formatDateBR(inferDateISO(item)))}</div>
        <div class="read-box"><strong>Fluxo:</strong> ${escapeHtml(inferFluxo(item))}</div>
        <div class="read-box"><strong>Participante:</strong> ${escapeHtml(participant.name)}</div>
        <div class="read-box"><strong>Código:</strong> ${escapeHtml(participant.code)}</div>
        <div class="read-box"><strong>Entrega:</strong> ${escapeHtml(inferEntrega(item))}</div>
        <div class="read-box"><strong>Status:</strong> ${escapeHtml(resolveHumanStatus(item))}</div>
        <div class="read-box"><strong>Tipo cadastro:</strong> ${escapeHtml(inferParticipantExtraInfo(item))}</div>
        <div class="read-box"><strong>Criado por:</strong> ${escapeHtml(inferCreatorLabel(item))}</div>

        <div class="read-box collection-span-full">
          <strong>Endereço:</strong> ${escapeHtml(participant.address || "—")}
        </div>

        <div class="read-box"><strong>Resíduo seco:</strong> ${escapeHtml(formatKg(inferResiduoSeco(item)))}</div>
        <div class="read-box"><strong>Rejeito:</strong> ${escapeHtml(formatKg(inferRejeito(item)))}</div>
        <div class="read-box"><strong>Não comercializado:</strong> ${escapeHtml(formatKg(inferNaoComercializado(item)))}</div>
        <div class="read-box"><strong>Qualidade:</strong> ${escapeHtml(getQualidade(item) || "—")}</div>

        <div class="read-box collection-span-full">
          <strong>Observação:</strong> ${escapeHtml(inferObservacao(item) || "—")}
        </div>
      </div>

      <div class="read-box">
        <strong>Materiais informados</strong>
        <div class="collection-details-list">
          ${materialsHtml || "<div>Nenhum material detalhado informado.</div>"}
        </div>
      </div>

      <div class="read-box">
        <strong>Foto(s) do registro</strong>
        <div class="collection-details-actions">
          ${
            photos.length
              ? photos.map((url, index) => `
                  <button
                    type="button"
                    class="action-btn edit"
                    data-photo="${escapeHtml(url)}"
                  >
                    Abrir foto ${index + 1}
                  </button>
                `).join("")
              : `<div>Nenhuma foto vinculada ao registro.</div>`
          }
        </div>
      </div>

      <details class="read-box">
        <summary class="collection-details-summary">Ver payload salvo do registro</summary>
        <pre class="collection-details-payload">${rawPayload}</pre>
      </details>
    </div>
  `;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function renderMainTable(items) {
  if (!els.tableColetasBody) return;

  if (!items.length) {
    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum registro encontrado para o filtro atual.</td>
      </tr>
    `;
    updateTableSummary();
    return;
  }

  els.tableColetasBody.innerHTML = items.map((item) => {
    const participant = resolveParticipant(item);
    const canceled = getStatus(item) === "cancelado";

    return `
      <tr class="${canceled ? "row-muted" : ""}">
        <td>${formatDateBR(inferDateISO(item))}</td>
        <td>${escapeHtml(participant.name)}</td>
        <td>${escapeHtml(participant.code)}</td>
        <td>${escapeHtml(inferFluxo(item))}</td>
        <td>${renderStatusBadge(item)}</td>
        <td>
          <button class="action-btn edit" type="button" data-view-details="${item.id}">
            Ver coleta
          </button>
        </td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" data-edit="${item.id}" ${canceled ? "disabled" : ""}>Editar</button>
            <button class="action-btn cancel" data-cancel="${item.id}" ${canceled ? "disabled" : ""}>Cancelar</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  updateTableSummary();
}

function applyTableFilters() {
  const search = normalizeText(els.tSearch?.value || "");
  const fluxo = els.tFluxo?.value || "__all__";
  const entrega = els.tEntrega?.value || "__all__";
  const status = els.tStatus?.value || "__all__";
  const tipoCadastro = els.tTipoCadastro?.value || "__all__";

  tableFilteredColetas = filteredColetas.filter((item) => {
    const participant = resolveParticipant(item);

    const haystack = normalizeText([
      participant.name,
      participant.code,
      inferObservacao(item),
      inferEntrega(item),
      inferFluxo(item),
      ...MATERIAL_META.map((m) => m.label)
    ].join(" "));

    if (search && !haystack.includes(search)) return false;
    if (fluxo !== "__all__" && inferFluxo(item) !== fluxo) return false;
    if (entrega !== "__all__" && inferEntrega(item) !== entrega) return false;
    if (status !== "__all__" && resolveHumanStatus(item) !== status) return false;
    if (tipoCadastro !== "__all__" && getParticipantTypeForTable(item) !== tipoCadastro) return false;

    return true;
  });

  renderMainTable(tableFilteredColetas);
}

/* =========================
   EXPORTAÇÕES
========================= */

async function exportToExcel() {
  try {
    const items = getExportBaseItems();

    if (!items.length) {
      alert("Nenhum registro encontrado para exportar.");
      return;
    }

    const XLSX = await ensureXLSX();
    const rows = getExportRows(items).map((row) => ({
      "Data": row.data,
      "Participante": row.participante,
      "Código": row.codigo,
      "Fluxo": row.fluxo,
      "Entrega": row.entrega,
      "Território": row.territorio,
      "Tipo cadastro": row.tipoCadastro,
      "Status": row.status,
      "Reciclável total (kg)": row.reciclavelKg,
      "Plástico (kg)": row.plasticoKg,
      "Vidro (kg)": row.vidroKg,
      "Metal / Alumínio (kg)": row.aluminioMetalKg,
      "Sacaria (kg)": row.sacariaKg,
      "Papel misto (kg)": row.papelMistoKg,
      "Papelão (kg)": row.papelaoKg,
      "Isopor (kg)": row.isoporKg,
      "Óleo de cozinha (kg)": row.oleoKg,
      "Rejeito (kg)": row.rejeitoKg,
      "Não comercializado (kg)": row.naoComercializadoKg,
      "Qualidade": row.qualidade,
      "Observação": row.observacao
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    const colWidths = [
      { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
      { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 12 },
      { wch: 40 }
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio");
    XLSX.writeFile(workbook, `relatorio-coletas_${buildExportFileStamp()}.xlsx`);
  } catch (error) {
    console.error("Erro ao exportar Excel:", error);
    alert("Não foi possível exportar o Excel.");
  }
}

async function exportToPDF() {
  try {
    const items = getExportBaseItems();

    if (!items.length) {
      alert("Nenhum registro encontrado para exportar.");
      return;
    }

    const jsPDF = await ensureJsPDF();
    const rows = getExportRows(items);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    let y = 14;
    const marginX = 10;
    const rowHeight = 7;
    const colX = {
      data: 10,
      participante: 30,
      codigo: 95,
      fluxo: 128,
      entrega: 158,
      reciclavel: 196,
      rejeito: 225,
      status: 252
    };

    const drawHeader = () => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Relatório geral de coletas", marginX, y);
      y += 7;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Território: ${coopProfile?.territoryLabel || coopProfile?.territoryId || pageTerritoryId || "Território"}`, marginX, y);
      y += 5;
      pdf.text(`Período: ${els.txtPeriodo?.textContent || "—"}`, marginX, y);
      y += 5;
      pdf.text(`Registros exportados: ${rows.length}`, marginX, y);
      y += 8;

      pdf.setDrawColor(180);
      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 5;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Data", colX.data, y);
      pdf.text("Participante", colX.participante, y);
      pdf.text("Código", colX.codigo, y);
      pdf.text("Fluxo", colX.fluxo, y);
      pdf.text("Entrega", colX.entrega, y);
      pdf.text("Reciclável", colX.reciclavel, y, { align: "right" });
      pdf.text("Rejeito", colX.rejeito, y, { align: "right" });
      pdf.text("Status", colX.status, y);
      y += 3;

      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 5;
    };

    const addPageIfNeeded = (extraHeight = rowHeight) => {
      if (y + extraHeight > pageHeight - 12) {
        pdf.addPage();
        y = 14;
        drawHeader();
      }
    };

    drawHeader();

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    rows.forEach((row) => {
      addPageIfNeeded(10);

      const participante = String(row.participante || "—").slice(0, 32);
      const codigo = String(row.codigo || "—").slice(0, 18);
      const fluxo = String(row.fluxo || "—").slice(0, 18);
      const entrega = String(row.entrega || "—").slice(0, 20);
      const status = String(row.status || "—").slice(0, 12);

      pdf.text(String(row.data || "—"), colX.data, y);
      pdf.text(participante, colX.participante, y);
      pdf.text(codigo, colX.codigo, y);
      pdf.text(fluxo, colX.fluxo, y);
      pdf.text(entrega, colX.entrega, y);
      pdf.text(formatNumber(row.reciclavelKg), colX.reciclavel, y, { align: "right" });
      pdf.text(formatNumber(row.rejeitoKg), colX.rejeito, y, { align: "right" });
      pdf.text(status, colX.status, y);

      y += rowHeight;
    });

    pdf.save(`relatorio-coletas_${buildExportFileStamp()}.pdf`);
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    alert("Não foi possível exportar o PDF.");
  }
}

/* =========================
   MODAIS / AÇÕES
========================= */

function openPhoto(url) {
  if (!url || !els.photoModal || !els.photoModalImg) return;

  const detailsModal = document.getElementById("collectionDetailsModal");
  if (detailsModal?.classList.contains("open")) {
    detailsModal.classList.remove("open");
    detailsModal.setAttribute("aria-hidden", "true");
  }

  els.photoModalImg.src = url;
  els.photoModal.classList.add("open");
  els.photoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (id === "photoModal") {
    const detailsModal = document.getElementById("collectionDetailsModal");
    if (detailsModal) {
      detailsModal.classList.add("open");
      detailsModal.setAttribute("aria-hidden", "false");
    }
  }

  const hasAnyOpenModal = document.querySelector(".modal.open");
  if (!hasAnyOpenModal) {
    document.body.classList.remove("modal-open");
  }
}


function openEditModal(itemId) {
  const item = allColetas.find((x) => x.id === itemId);
  if (!item) return;

  const participant = resolveParticipant(item);
  activeEditId = itemId;

  if (els.editParticipantName) els.editParticipantName.textContent = `${participant.name} • ${participant.code}`;
  if (els.editFluxo) els.editFluxo.value = inferFluxo(item) === "—" ? "recebimento" : inferFluxo(item);
  if (els.editEntrega) els.editEntrega.value = inferEntrega(item) === "—" ? "" : inferEntrega(item);
  if (els.editPesoBase) els.editPesoBase.value = String(inferResiduoSeco(item) || "");
  if (els.editQualidade) els.editQualidade.value = getQualidade(item);
  if (els.editRejeito) els.editRejeito.value = String(inferRejeito(item) || "");
  if (els.editNaoComercializado) els.editNaoComercializado.value = String(inferNaoComercializado(item) || "");

  /* Preenche as frações de resíduos, tanto de recebimento quanto de final de turno */
  if (els.editPlasticoKg) els.editPlasticoKg.value = String(getMaterialValue(item, "plasticoKg") || "");
  if (els.editVidroKg) els.editVidroKg.value = String(getMaterialValue(item, "vidroKg") || "");
  if (els.editAluminioMetalKg) els.editAluminioMetalKg.value = String(getMaterialValue(item, "aluminioMetalKg") || "");
  if (els.editSacariaKg) els.editSacariaKg.value = String(getMaterialValue(item, "sacariaKg") || "");
  if (els.editPapelMistoKg) els.editPapelMistoKg.value = String(getMaterialValue(item, "papelMistoKg") || "");
  if (els.editPapelaoKg) els.editPapelaoKg.value = String(getMaterialValue(item, "papelaoKg") || "");
  if (els.editIsoporKg) els.editIsoporKg.value = String(getMaterialValue(item, "isoporKg") || "");
  if (els.editOleoKg) els.editOleoKg.value = String(getMaterialValue(item, "oleoKg") || "");

  if (els.editObs) els.editObs.value = inferObservacao(item);

 if (els.editModal) {
  els.editModal.classList.add("open");
  els.editModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
}

async function saveEdit() {
  if (!activeEditId) return;

  const ref = doc(db, "coletas", activeEditId);
  const isEditFinalTurno = els.editFluxo?.value === "final_turno";

  const payload = {
    flowType: els.editFluxo?.value || "recebimento",
    deliveryType: els.editEntrega?.value?.trim?.() || "",
    observacao: els.editObs?.value?.trim?.() || "",
    updatedAt: serverTimestamp()
  };

  const qualityValue = els.editQualidade?.value ? Number(els.editQualidade.value) : null;

  const materiaisPayload = {
    plasticoKg: Number(els.editPlasticoKg?.value || 0),
    vidroKg: Number(els.editVidroKg?.value || 0),
    aluminioMetalKg: Number(els.editAluminioMetalKg?.value || 0),
    sacariaKg: Number(els.editSacariaKg?.value || 0),
    papelMistoKg: Number(els.editPapelMistoKg?.value || 0),
    papelaoKg: Number(els.editPapelaoKg?.value || 0),
    isoporKg: Number(els.editIsoporKg?.value || 0),
    oleoKg: Number(els.editOleoKg?.value || 0)
  };

  if (isEditFinalTurno) {
    payload["finalTurno.observacao"] = els.editObs?.value?.trim?.() || "";
    payload["finalTurno.pesoResiduoSecoKg"] = Number(els.editPesoBase?.value || 0);
    payload["finalTurno.qualidadeNota"] = qualityValue;
    payload["finalTurno.pesoRejeitoKg"] = Number(els.editRejeito?.value || 0);
    payload["finalTurno.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado?.value || 0);
    payload["finalTurno.materiais"] = materiaisPayload;
    payload.materiais = materiaisPayload;
  } else {
    payload["recebimento.observacao"] = els.editObs?.value?.trim?.() || "";
    payload["recebimento.pesoResiduoSecoKg"] = Number(els.editPesoBase?.value || 0);
    payload["recebimento.qualidadeNota"] = qualityValue;
    payload["recebimento.pesoRejeitoKg"] = Number(els.editRejeito?.value || 0);
    payload["recebimento.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado?.value || 0);
    payload["recebimento.materiais"] = materiaisPayload;
    payload.materiais = materiaisPayload;
  }

  await updateDoc(ref, payload);

  closeModal("editModal");
  activeEditId = null;
}

async function cancelRegistro(itemId) {
  const ok = window.confirm(
    "Deseja realmente cancelar este registro? Ele continuará no histórico, mas não contará nos indicadores ativos."
  );
  if (!ok) return;

  const ref = doc(db, "coletas", itemId);
  await updateDoc(ref, {
    status: "cancelado",
    canceledAt: serverTimestamp()
  });
}

/* =========================
   UI
========================= */

function initCursorGlow() {
  const glow = document.getElementById("cursorGlow");
  if (!glow) return;

  window.addEventListener("mousemove", (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
    glow.style.opacity = ".9";
  });

  window.addEventListener("mouseleave", () => {
    glow.style.opacity = "0";
  });
}

function bindUI() {
  ensureCollectionDetailsModal();
  ensureRefreshButton();
  
  document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal.open").forEach((modal) => {
      closeModal(modal.id);
    });
  }
});

  els.btnAplicar?.addEventListener("click", applyFilters);
  els.btnLimpar?.addEventListener("click", clearFilters);
  els.btnPrint?.addEventListener("click", () => window.print());
  els.btnExportPDF?.addEventListener("click", exportToPDF);
  els.btnExportExcel?.addEventListener("click", exportToExcel);
  els.btnSaveEdit?.addEventListener("click", saveEdit);

  els.fParticipantCode?.addEventListener("input", () => {
    showQuickParticipantPreviewByCode(els.fParticipantCode.value);
  });

  [
    els.chartMainType,
    els.chartFlowType,
    els.chartDeliveryType,
    els.chartTerritoryType
  ].forEach((el) => {
    el?.addEventListener("change", () => renderCharts(filteredColetas));
  });

  [
    els.fFluxo,
    els.fEntrega,
    els.fIni,
    els.fFim,
    els.fSearchType
  ].forEach((el) => {
    el?.addEventListener("change", applyFilters);
  });

  els.fBusca?.addEventListener("input", applyFilters);

  els.btnApplyTableFilters?.addEventListener("click", applyTableFilters);
  els.btnClearTableFilters?.addEventListener("click", () => {
    if (els.tSearch) els.tSearch.value = "";
    if (els.tFluxo) els.tFluxo.value = "__all__";
    if (els.tEntrega) els.tEntrega.value = "__all__";
    if (els.tStatus) els.tStatus.value = "__all__";
    if (els.tTipoCadastro) els.tTipoCadastro.value = "__all__";
    applyTableFilters();
  });

  document.addEventListener("click", async (event) => {
    const photo = event.target.closest("[data-photo]");
    if (photo) {
      openPhoto(photo.dataset.photo);
      return;
    }

    const routePointBtn = event.target.closest("[data-route-point]");
    if (routePointBtn) {
      selectedPointKey = routePointBtn.dataset.routePoint;
      renderCollectionPoints(filteredColetas);
      return;
    }

    const detailsBtn = event.target.closest("[data-view-details]");
    if (detailsBtn) {
      openCollectionDetailsModal(detailsBtn.dataset.viewDetails);
      return;
    }

    const editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      openEditModal(editBtn.dataset.edit);
      return;
    }

    const cancelBtn = event.target.closest("[data-cancel]");
    if (cancelBtn) {
      try {
        await cancelRegistro(cancelBtn.dataset.cancel);
      } catch (error) {
        console.error(error);
        alert("Não foi possível cancelar o registro.");
      }
      return;
    }


    const closer = event.target.closest("[data-close]");
    if (closer) {
      closeModal(closer.dataset.close);
    }
  });
}

/* =========================
   BOOT
========================= */

async function boot() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initCursorGlow();
  bindUI();

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

      if (!pageTerritoryId) {
        throw new Error("Território da página não definido.");
      }

      fillUser(profile);
      loadParticipantsMap();
      listenColetas();

      const urlParams = new URLSearchParams(window.location.search);
      const codigo = urlParams.get("codigo");
      if (codigo && els.fParticipantCode) {
        els.fParticipantCode.value = codigo;
        showQuickParticipantPreviewByCode(codigo);
      }
    } catch (error) {
      console.error("Erro ao iniciar dashboard:", error);
      alert(error.message || "Não foi possível carregar o dashboard.");
      window.location.href = "login.html";
    }
  });
}

boot();