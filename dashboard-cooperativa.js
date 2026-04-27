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

/* =========================================================
   DASHBOARD COOPERATIVA - NSRU
   ---------------------------------------------------------
   O que este arquivo faz:
   1. Autentica o usuário logado pelo Firebase Auth.
   2. Busca o perfil do usuário em users/{uid}.
   3. Define o território do dashboard.
   4. Busca participantes da coleção participants.
   5. Busca coletas da coleção coletas.
   6. Aplica filtros.
   7. Calcula KPIs.
   8. Renderiza gráficos, tabela, mapa e rota.
   9. Exporta Excel/PDF.
   10. Permite editar/cancelar registros.
   ========================================================= */

/* =========================
   CONFIGURAÇÕES GERAIS
========================= */

/*
  Materiais recicláveis secos.
  Importante:
  - Óleo NÃO entra aqui porque não é resíduo seco.
  - Rejeito NÃO entra aqui porque é separado.
  - Não comercializado NÃO entra aqui porque é separado.
*/
const MATERIAL_META = [
  { key: "plasticoKg", label: "Plástico", price: 1.92, icon: "🧴" },
  { key: "vidroKg", label: "Vidro", price: 0.08, icon: "🍾" },
  { key: "aluminioMetalKg", label: "Metal / Alumínio", price: 2.9, icon: "🥫" },
  { key: "sacariaKg", label: "Sacaria", price: 0.12, icon: "🧵" },
  { key: "papelMistoKg", label: "Papel misto", price: 0.66, icon: "📄" },
  { key: "papelaoKg", label: "Papelão", price: 0.52, icon: "📦" },
  { key: "isoporKg", label: "Isopor", price: 0.4, icon: "🧊" }
];

/*
  Óleo é fluxo especial:
  - não entra em resíduo seco;
  - não entra em rejeito;
  - entra no Excel;
  - entra na receita estimada, se necessário.
*/
const MATERIAL_OLEO = {
  key: "oleoKg",
  label: "Óleo de cozinha",
  price: 1.5,
  icon: "🛢️"
};

const ALL_MATERIAL_META = [...MATERIAL_META, MATERIAL_OLEO];

const CHART_COLORS = {
  blue: "#53ACDE",
  green: "#81B92A",
  orange: "#EF6B22"
};

const COOP_BASES = {
  "vila-pinto": { lat: -30.048729170292532, lng: -51.15652604283108 },
  "crgr-vila-pinto": { lat: -30.048729170292532, lng: -51.15652604283108 },
  "cooadesc": { lat: -30.003, lng: -51.206 },
  "crgr-cooadesc": { lat: -30.003, lng: -51.206 },
  "padre-cacique": { lat: -30.140122365657504, lng: -51.1268772051727 },
  "crgr-padre-cacique": { lat: -30.140122365657504, lng: -51.1268772051727 }
};

/* =========================
   ELEMENTOS DO DOM
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
  k_oleoKg: document.getElementById("k_oleoKg"),
  k_oleoPct: document.getElementById("k_oleoPct"),

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
   ESTADO DA PÁGINA
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
   UTILITÁRIOS
========================= */

function formatDateBR(value) {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T12:00:00`) : value;
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
  return `${formatNumber(n)} kg`;
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

  if (v === "vila-pinto" || v === "crgr-vila-pinto") return ["vila-pinto", "crgr-vila-pinto"];
  if (v === "cooadesc" || v === "crgr-cooadesc") return ["cooadesc", "crgr-cooadesc"];
  if (v === "padre-cacique" || v === "crgr-padre-cacique") return ["padre-cacique", "crgr-padre-cacique"];

  return v ? [v] : [];
}

function sameTerritoryValue(a, b) {
  const aNorm = normalizeTerritory(a);
  return getTerritoryAliases(b).includes(aNorm);
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
  if (item.createdAtClient) return String(item.createdAtClient);
  if (item.createdAtISO) return String(item.createdAtISO);
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
  return String(item.flowType || item.fluxo || "").toLowerCase() || "—";
}

function isFinalTurno(item) {
  return inferFluxo(item) === "final_turno";
}

function inferEntrega(item) {
  return item.deliveryType || item.tipoRecebimento || item.entrega || "—";
}

function inferTerritorio(item) {
  return item.territoryLabel || coopProfile?.territoryLabel || pageTerritoryId || "Território";
}

function getStatus(item) {
  return String(item.status || "ativo").toLowerCase();
}

function inferResiduoSeco(item) {
  const directValue =
    item.recebimento?.pesoResiduoSecoKg ??
    item.finalTurno?.pesoResiduoSecoKg ??
    item.pesoResiduoSecoKg ??
    item.residuoSecoKg;

  if (directValue !== undefined && directValue !== null && directValue !== "") {
    return Number(directValue || 0);
  }

  return MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
}

/*
  Rejeito total:
  - considera APENAS pesoRejeitoKg / rejeitoKg;
  - não soma óleo;
  - não soma não comercializado.
*/
function inferRejeito(item) {
  return Number(
    item.finalTurno?.pesoRejeitoGeralKg ??
    item.finalTurno?.pesoRejeitoKg ??
    item.recebimento?.pesoRejeitoKg ??
    item.recebimento?.rejeitoKg ??
    item.finalTurno?.rejeitoKg ??
    item.pesoRejeitoGeralKg ??
    item.pesoRejeitoKg ??
    item.rejeitoKg ??
    0
  );
}

/*
  Não comercializado:
  - separado do rejeito;
  - aparece no Excel e na seção própria.
*/
function inferNaoComercializado(item) {
  return Number(
    item.recebimento?.pesoNaoComercializadoKg ??
    item.finalTurno?.pesoNaoComercializadoKg ??
    item.pesoNaoComercializadoKg ??
    item.naoComercializadoKg ??
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

/*
  Reciclável seco:
  - soma apenas MATERIAL_META;
  - não soma óleo;
  - não soma rejeito;
  - não soma não comercializado.
*/
function inferTotalReciclavelRegistro(item) {
  const somaSecos = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);

  if (isFinalTurno(item)) return somaSecos;

  return somaSecos > 0 ? somaSecos : inferResiduoSeco(item);
}

function sortColetasLocally(items) {
  return [...items].sort((a, b) => {
    const aDate = String(inferDateTimeISO(a) || "");
    const bDate = String(inferDateTimeISO(b) || "");
    return bDate.localeCompare(aDate);
  });
}

function resolveHumanStatus(item) {
  const status = getStatus(item);
  if (status === "cancelado") return "cancelado";
  if (item.updatedAt) return "editado";
  return "ativo";
}

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
      fluxo: inferFluxo(item),
      entrega: inferEntrega(item),
      territorio: inferTerritorio(item),
      tipoCadastro: participant.type || "—",
      status: resolveHumanStatus(item),
      reciclavelKg: Number(inferTotalReciclavelRegistro(item) || 0),
      rejeitoKg: Number(inferRejeito(item) || 0),
      naoComercializadoKg: Number(inferNaoComercializado(item) || 0),
      oleoKg: Number(getMaterialValue(item, MATERIAL_OLEO.key) || 0),
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
        if (typeof possible === "string" && possible.trim()) urls.push(possible.trim());
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

/* =========================
   PERFIL / AUTORIZAÇÃO
========================= */

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado em users.");
  return { id: snap.id, ...snap.data() };
}

function validateProfile(profile) {
  const role = normalizeText(profile.role);

  const allowedRoles = ["cooperativa", "operador", "usuario", "admin", "governanca", "gestor"];
  if (!allowedRoles.includes(role)) {
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
   FIRESTORE
========================= */

function buildTerritoryQuery(colName) {
  const aliases = getTerritoryAliases(pageTerritoryId);

  if (!aliases.length) {
    return query(collection(db, colName));
  }

  /*
    Busca pelos aliases do território.
    Exemplo Vila Pinto:
    - vila-pinto
    - crgr-vila-pinto
  */
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
        if (payload.participantCode) participantsMap.set(String(payload.participantCode), payload);
        if (data.familyCode) participantsMap.set(String(data.familyCode), payload);
        if (data.codigo) participantsMap.set(String(data.codigo), payload);
      });

      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar participantes:", error);
      if (els.dbStatus) els.dbStatus.textContent = "erro em participantes";
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
        els.dbStatus.textContent = `conectado • ${allColetas.length} registros`;
      }

      populateFilters(allColetas);
      populateTableFilters(allColetas);
      setDefaultDateRange(allColetas);
      applyFilters();
    },
    (error) => {
      console.error("Erro ao carregar coletas:", error);
      if (els.dbStatus) els.dbStatus.textContent = "erro em coletas";
      alert(`Não foi possível carregar os registros das coletas: ${error.message || error}`);
    }
  );
}

function listenColetas() {
  if (els.dbStatus) els.dbStatus.textContent = "conectando…";
  subscribeToQuery(buildTerritoryQuery("coletas"));
}

/* =========================
   PARTICIPANTES
========================= */

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
  if (els.quickParticipantAddress) els.quickParticipantAddress.textContent = found.enderecoCompleto || "—";
}

/* =========================
   DADOS PÚBLICOS
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
      return acc + inferTotalReciclavelRegistro(item);
    }, 0);

    const pontosSet = new Set();
    participantsMap.forEach((p) => {
      if (
        p &&
        sameTerritoryValue(p.territoryId || pageTerritoryId, pageTerritoryId) &&
        (p.lat || p.lng || p.enderecoCompleto || p.localColeta)
      ) {
        pontosSet.add(p.participantCode || p.id || p.name);
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
   FILTROS
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
      inferObservacao(item),
      ...ALL_MATERIAL_META.map((m) => m.label)
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

  if (!els.txtPeriodo) return;

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
      ].map(String).join(" ");

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
   KPIs
========================= */

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
  let oleoKg = 0;

  const uniqueDays = new Set();
  const participantSet = new Set();
  const condominioSet = new Set();
  const comercioSet = new Set();

  let entregaVoluntaria = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);
    const type = normalizeText(participant.type);

    reciclavelKg += inferTotalReciclavelRegistro(item);
    rejeitoKg += inferRejeito(item);
    naoComercializadoKg += inferNaoComercializado(item);
    oleoKg += getMaterialValue(item, MATERIAL_OLEO.key);

    const d = inferDateISO(item);
    if (d) uniqueDays.add(d);

    if (participant.code && participant.code !== "—") participantSet.add(participant.code);
    if (type === "condominio") condominioSet.add(participant.code || participant.name);
    if (type === "comercio") comercioSet.add(participant.code || participant.name);
    if (normalizeText(inferEntrega(item)).includes("volunt")) entregaVoluntaria += 1;
  });

  const totalBase = reciclavelKg + rejeitoKg;
  const reciclavelPct = totalBase ? (reciclavelKg / totalBase) * 100 : 0;
  const rejeitoPct = totalBase ? (rejeitoKg / totalBase) * 100 : 0;

  let receitaTotal = 0;
  MATERIAL_META.forEach((mat) => {
    receitaTotal += (materialTotals[mat.key] || 0) * mat.price;
  });
  receitaTotal += oleoKg * MATERIAL_OLEO.price;

  return {
    materialTotals,
    reciclavelKg,
    rejeitoKg,
    naoComercializadoKg,
    oleoKg,
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

function renderKpis(items) {
  const m = computeExpandedMetrics(items);

  const participantIds = new Set();
  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      const p = resolveParticipant(item);
      if (p.code && p.code !== "—") participantIds.add(p.code);
    });

  if (els.k_totalColetas) els.k_totalColetas.textContent = String(m.operacoesRealizadas);
  if (els.k_participantes) els.k_participantes.textContent = String(participantIds.size);
  if (els.k_residuoSeco) els.k_residuoSeco.textContent = formatNumber(m.reciclavelKg);
  if (els.k_rejeito) els.k_rejeito.textContent = formatNumber(m.rejeitoKg);
  if (els.k_finalTurno) {
    const finalTurnos = items.filter((item) => getStatus(item) !== "cancelado" && isFinalTurno(item)).length;
    els.k_finalTurno.textContent = String(finalTurnos);
  }
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

  /*
    Seção de rejeitos:
    - rejeito não reciclável = rejeito puro;
    - não comercializado = separado;
    - óleo = separado, se houver campo no HTML.
  */
  if (els.k_rejeitoNaoReciclavelPct) els.k_rejeitoNaoReciclavelPct.textContent = m.rejeitoKg > 0 ? "100%" : "0%";
  if (els.k_rejeitoNaoReciclavelKg) els.k_rejeitoNaoReciclavelKg.textContent = formatKg(m.rejeitoKg);
  if (els.k_naoComercializadoPct) els.k_naoComercializadoPct.textContent = "—";
  if (els.k_naoComercializadoKg) els.k_naoComercializadoKg.textContent = formatKg(m.naoComercializadoKg);
  if (els.k_oleoKg) els.k_oleoKg.textContent = formatKg(m.oleoKg);
  if (els.k_oleoPct) els.k_oleoPct.textContent = "—";
  
  if (els.materialCards) {
    const totalMateriaisSecos = Object.values(m.materialTotals).reduce((acc, v) => acc + v, 0);

    const materialCards = MATERIAL_META.map((mat) => {
      const kg = m.materialTotals[mat.key] || 0;
      const pct = totalMateriaisSecos ? (kg / totalMateriaisSecos) * 100 : 0;
      const receita = kg * mat.price;

      return `
        <article class="material-card">
          <div class="material-top">
            <div class="mat-icon">${mat.icon}</div>
            <div class="mat-pct">${formatNumber(pct)}%</div>
          </div>
          <div class="mat-name">${escapeHtml(mat.label)}</div>
          <div class="mat-kg">${formatNumber(kg)} kg</div>
          <div class="mat-sub">Receita estimada ≈ ${formatMoneyBR(receita)}</div>
        </article>
      `;
    }).join("");

    const oleoCard = m.oleoKg > 0
      ? `
        <article class="material-card material-card-special">
          <div class="material-top">
            <div class="mat-icon">${MATERIAL_OLEO.icon}</div>
            <div class="mat-pct">fluxo especial</div>
          </div>
          <div class="mat-name">${escapeHtml(MATERIAL_OLEO.label)}</div>
          <div class="mat-kg">${formatNumber(m.oleoKg)} kg</div>
          <div class="mat-sub">Não compõe resíduo seco • Receita estimada ≈ ${formatMoneyBR(m.oleoKg * MATERIAL_OLEO.price)}</div>
        </article>
      `
      : "";

    els.materialCards.innerHTML = materialCards + oleoCard;
  }
}
