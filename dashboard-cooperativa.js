import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const MATERIAL_META = [
  { key: "plasticoKg", label: "Plástico", price: 1.92, color: "#2E7D32" },
  { key: "vidroKg", label: "Vidro", price: 0.08, color: "#0288D1" },
  { key: "aluminioMetalKg", label: "Metal / Alumínio", price: 2.9, color: "#757575" },
  { key: "sacariaKg", label: "Sacaria", price: 0.12, color: "#8D6E63" },
  { key: "papelMistoKg", label: "Papel misto", price: 0.66, color: "#1565C0" },
  { key: "papelaoKg", label: "Papelão", price: 0.52, color: "#A65A2A" },
  { key: "isoporKg", label: "Isopor", price: 0.4, color: "#00ACC1" },
  { key: "oleoKg", label: "Óleo de cozinha", price: 1.5, color: "#C79200", isSpecial: true }
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
  "vila-pinto": { lat: -30.048729170292532, lng: -51.15652604283108 },
  cooadesc: { lat: -30.003, lng: -51.206 },
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

function createdAtToISO(item) {
  if (item.createdAt?.toDate) return item.createdAt.toDate().toISOString();
  if (item.updatedAt?.toDate) return item.updatedAt.toDate().toISOString();
  if (item.createdAtISO) return String(item.createdAtISO);
  return "";
}

function inferDateISO(item) {
  if (item.opDate) return String(item.opDate).slice(0, 10);
  if (item.dataOperacao) return String(item.dataOperacao).slice(0, 10);
  if (item.operationDate) return String(item.operationDate).slice(0, 10);
  if (item.dataColeta) return String(item.dataColeta).slice(0, 10);
  if (item.coletaData) return String(item.coletaData).slice(0, 10);
  if (item.dateColeta) return String(item.dateColeta).slice(0, 10);
  if (item.data) return String(item.data).slice(0, 10);

  if (item.payloadSnapshot?.opDate) return String(item.payloadSnapshot.opDate).slice(0, 10);
  if (item.payloadSnapshot?.dataOperacao) return String(item.payloadSnapshot.dataOperacao).slice(0, 10);
  if (item.payloadSnapshot?.dataColeta) return String(item.payloadSnapshot.dataColeta).slice(0, 10);
  if (item.payloadSnapshot?.data) return String(item.payloadSnapshot.data).slice(0, 10);

  const iso = createdAtToISO(item);
  return iso ? iso.slice(0, 10) : "";
}

function inferDateTimeISO(item) {
  return (
    createdAtToISO(item) ||
    item.opDate ||
    item.dataOperacao ||
    item.operationDate ||
    item.dataColeta ||
    item.coletaData ||
    item.dateColeta ||
    item.data ||
    ""
  );
}

function inferFluxo(item) {
  const raw =
    item.flowType ||
    item.fluxo ||
    item.tipoColeta ||
    item.tipoRecebimento ||
    item.receiptType ||
    item.recebimento?.flowType ||
    item.recebimento?.fluxo ||
    item.finalTurno?.flowType ||
    item.finalTurno?.fluxo ||
    item.payloadSnapshot?.flowType ||
    item.payloadSnapshot?.fluxo ||
    item.payloadSnapshot?.tipoRecebimento ||
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
    item.recebimento?.entrega ||
    item.finalTurno?.deliveryType ||
    item.finalTurno?.entrega ||
    item.payloadSnapshot?.deliveryType ||
    item.payloadSnapshot?.entrega ||
    "—"
  );
}

function inferTerritorio(item) {
  return (
    item.territoryLabel ||
    item.territoryId ||
    item.territory ||
    item.cooperativa ||
    item.payloadSnapshot?.territoryLabel ||
    item.payloadSnapshot?.territoryId ||
    item.payloadSnapshot?.territory ||
    coopProfile?.territoryLabel ||
    pageTerritoryId ||
    "Território"
  );
}

function getStatus(item) {
  return String(
    item.status ||
    item.situacao ||
    item.coletaStatus ||
    item.decision ||
    "ativo"
  ).toLowerCase();
}

function isActiveCollection(item) {
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

function resolveHumanStatus(item) {
  const status = normalizeText(getStatus(item));

  if (status.includes("cancel")) return "Cancelado";
  if (status.includes("edit")) return "Editado";
  if (status.includes("pend")) return "Pendente";
  if (status.includes("reje")) return "Rejeitado";

  return "Ativo";
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
    item.peso_recebido,
    item.totalPesoRecebido,
    item.totalRecebido,
    item.totalKg,
    item.pesoTotal,
    item.peso,
    item.kg,
    item.payloadSnapshot?.pesoRecebido,
    item.payloadSnapshot?.pesoResiduoSecoKg,
    item.payloadSnapshot?.totalKg
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
    item.payloadSnapshot?.pesoRejeitoKg,
    item.payloadSnapshot?.totalRejeito
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
    item.nao_comercializado,
    item.totalNaoComercializado,
    item.materialNaoComercializado,
    item.naoVenda,
    item.semComercializacao,
    item.payloadSnapshot?.naoComercializado,
    item.payloadSnapshot?.totalNaoComercializado
  );
}

function getMaterialValue(item, key) {
  const aliases = MATERIAL_ALIASES[key] || [key];

  const sources = [
    item.materiais,
    item.materials,
    item.recebimento?.materiais,
    item.recebimento?.materials,
    item.finalTurno?.materiais,
    item.finalTurno?.materials,
    item.payloadSnapshot?.materiais,
    item.payloadSnapshot?.materials,
    item.recebimento,
    item.finalTurno,
    item.payloadSnapshot,
    item
  ].filter(Boolean);

  for (const source of sources) {
    for (const alias of aliases) {
      if (source[alias] !== undefined && source[alias] !== null && source[alias] !== "") {
        return toNumberBR(source[alias]);
      }
    }
  }

  return 0;
}

function inferTotalMateriaisRegistro(item) {
  return MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
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

function inferTotalReciclavelRegistro(item) {
  return inferResiduoSeco(item) || inferTotalMateriaisRegistro(item);
}

function inferRejeitoNaoReciclavel(item) {
  return Math.max(0, inferPesoRejeitoInformado(item) - inferNaoComercializado(item));
}

function inferTotalRejeitoRegistro(item) {
  return inferPesoRejeitoInformado(item) + inferNaoComercializado(item);
}

function inferObservacao(item) {
  return (
    item.observacao ||
    item.obs ||
    item.recebimento?.observacao ||
    item.recebimento?.obs ||
    item.finalTurno?.observacao ||
    item.finalTurno?.obs ||
    item.payloadSnapshot?.observacao ||
    item.payloadSnapshot?.obs ||
    ""
  );
}

function getQualidade(item) {
  const value =
    item.recebimento?.qualidadeNota ??
    item.recebimento?.qualidade ??
    item.finalTurno?.qualidadeNota ??
    item.finalTurno?.qualidade ??
    item.qualidadeNota ??
    item.qualidade ??
    item.notaQualidade ??
    item.qualityScore ??
    item.payloadSnapshot?.qualidadeNota ??
    item.payloadSnapshot?.qualidade ??
    "";

  if (value === null || value === undefined || value === "") return "—";

  return String(value);
}

function sortColetasLocally(items) {
  return [...items].sort((a, b) => {
    const aDate = String(inferDateTimeISO(a) || "");
    const bDate = String(inferDateTimeISO(b) || "");
    return bDate.localeCompare(aDate);
  });
}

/* =========================
   PARTICIPANTES
========================= */

function extractLatLngFromSource(source) {
  if (!source || typeof source !== "object") {
    return { lat: null, lng: null };
  }

  return {
    lat: firstFinite(
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
    ),
    lng: firstFinite(
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
    )
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

  const fallbackCode = participantCode || familyCode || (isFinalTurno(item) ? "F000" : "—");

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

  if (els.quickParticipantName) els.quickParticipantName.textContent = found.name || "—";
  if (els.quickParticipantCode) els.quickParticipantCode.textContent = found.participantCode || normalized;
  if (els.quickParticipantType) els.quickParticipantType.textContent = found.participantType || "—";
  if (els.quickParticipantStatus) els.quickParticipantStatus.textContent = found.status || "—";

  if (els.quickParticipantAddress) {
    els.quickParticipantAddress.textContent =
      found.enderecoCompleto ||
      [found.rua || "", found.numero || "", found.bairro || "", found.cidade || ""].filter(Boolean).join(" ") ||
      "—";
  }
}

/* =========================
   PERFIL
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
  const isActiveUser =
    profile.status === "active" ||
    profile.status === "aprovado" ||
    profile.active === true ||
    !profile.status;

  if (!isActiveUser) {
    throw new Error("Usuário sem acesso ativo.");
  }
}

function fillUser(profile) {
  if (els.userDisplayName) {
    els.userDisplayName.textContent = profile.displayName || profile.name || profile.nome || "Usuário";
  }

  if (els.userRole) {
    els.userRole.textContent = profile.role || "cooperativa";
  }

  if (els.userTerritory) {
    els.userTerritory.textContent = profile.territoryLabel || profile.territoryId || pageTerritoryId || "—";
  }
}

/* =========================
   FIRESTORE
========================= */

function loadParticipantsMap() {
  if (activeParticipantsUnsubscribe) {
    activeParticipantsUnsubscribe();
    activeParticipantsUnsubscribe = null;
  }

  activeParticipantsUnsubscribe = onSnapshot(
    collection(db, "participants"),
    (snap) => {
      participantsMap.clear();

      snap.forEach((d) => {
        const data = d.data();

        if (!itemBelongsToPageTerritory(data)) return;

        const coords = extractLatLngFromSource(data);

        const payload = {
          id: d.id,
          name: data.name || data.participantName || data.nome || "Sem nome",
          participantCode: data.participantCode || data.familyCode || data.codigo || d.id,
          participantType: data.participantType || data.type || data.localType || "",
          status: data.status || data.decision || "",
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
      let loaded = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      const totalOriginal = loaded.length;

      loaded = loaded.filter(itemBelongsToPageTerritory);
      loaded = sortColetasLocally(loaded);

      allColetas = loaded;

      if (els.dbStatus) {
        els.dbStatus.textContent = `conectado • ${loaded.length}/${totalOriginal} coletas`;
      }

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

    els.fEntrega.value = Array.from(entregas).includes(currentEntrega)
      ? currentEntrega
      : "__all__";
  }
}

function populateTableFilters(items) {
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "—") entregas.add(entrega);
  });

  const currentEntrega = els.tEntrega?.value || "__all__";

  if (els.tEntrega) {
    els.tEntrega.innerHTML =
      `<option value="__all__">Todas</option>` +
      Array.from(entregas)
        .sort()
        .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
        .join("");

    els.tEntrega.value = Array.from(entregas).includes(currentEntrega)
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

  if (!els.txtPeriodo) return;

  if (ini && fim) {
    els.txtPeriodo.textContent = `${formatDateBR(ini)} → ${formatDateBR(fim)}`;
    return;
  }

  if (ini) {
    els.txtPeriodo.textContent = `${formatDateBR(ini)} → hoje`;
    return;
  }

  if (fim) {
    els.txtPeriodo.textContent = `até ${formatDateBR(fim)}`;
    return;
  }

  const dates = filteredColetas.map((item) => inferDateISO(item)).filter(Boolean).sort();

  els.txtPeriodo.textContent = dates.length
    ? `${formatDateBR(dates[0])} → ${formatDateBR(dates[dates.length - 1])}`
    : "—";
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

  if (els.quickParticipantPreview) {
    els.quickParticipantPreview.classList.add("hidden");
  }

  applyFilters();
}

/* =========================
   KPIs E CARDS
========================= */

function renderKpis(items) {
  const ativos = items.filter(isActiveCollection);
  const participantIds = new Set();

  let residuoSeco = 0;
  let rejeitoTotal = 0;
  let finalTurno = 0;

  ativos.forEach((item) => {
    const p = resolveParticipant(item);

    if (p.code && p.code !== "—") participantIds.add(p.code);

    residuoSeco += inferTotalReciclavelRegistro(item);
    rejeitoTotal += inferTotalRejeitoRegistro(item);

    if (isFinalTurno(item)) finalTurno += 1;
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

  items.filter(isActiveCollection).forEach((item) => {
    MATERIAL_META.forEach((mat) => {
      totals[mat.key] += getMaterialValue(item, mat.key);
    });
  });

  return totals;
}

function computeExpandedMetrics(items) {
  const ativos = items.filter(isActiveCollection);
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
    if (d) uniqueDays.add(d);

    if (participant.code && participant.code !== "—") participantSet.add(participant.code);
    if (type === "condominio" || type === "condomínio") condominioSet.add(participant.code || participant.name);
    if (type === "comercio" || type === "comércio") comercioSet.add(participant.code || participant.name);

    if (normalizeText(inferEntrega(item)).includes("volunt")) entregaVoluntaria += 1;
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

  if (!els.materialCards) return;

  const totalMateriais = Object.values(m.materialTotals).reduce((acc, v) => acc + v, 0);

  els.materialCards.innerHTML = MATERIAL_META.map((mat) => {
    const kg = m.materialTotals[mat.key] || 0;
    const pct = totalMateriais ? (kg / totalMateriais) * 100 : 0;
    const receita = kg * mat.price;

    return `
      <article class="material-card professional-card ${mat.isSpecial ? "special-flow-card" : ""}" style="--material-color:${mat.color}">
        <div class="material-top">
          <div class="icon-group">
            <div class="mat-icon professional-icon">${escapeHtml(mat.label).slice(0, 2)}</div>
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

/* =========================
   GRÁFICOS
========================= */

function getChartOptions(type = "bar") {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { usePointStyle: true, padding: 16 }
      }
    }
  };

  if (type === "doughnut" || type === "pie") return base;

  return {
    ...base,
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#64748B", maxRotation: 45, minRotation: 0 }
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148,163,184,.15)" },
        ticks: { color: "#64748B" }
      }
    }
  };
}

function buildWeightDailySeries(items) {
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
      const fluxoLabel = item.fluxo === "final_turno" ? "Final turno" : "Recebimento";
      return `${formatDateBR(item.date)} • ${fluxoLabel}`;
    }),
    reciclavel: ordered.map((item) => Number(item.reciclavel.toFixed(2))),
    rejeito: ordered.map((item) => Number(item.rejeito.toFixed(2))),
    quantidade: ordered.map((item) => item.quantidade)
  };
}

function renderWeightTimeline(items) {
  const canvas = document.getElementById("weightTimelineChart");

  if (!canvas || typeof Chart === "undefined") return;

  const daily = buildWeightDailySeries(items);

  if (weightTimelineChart) weightTimelineChart.destroy();

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

function buildDailySeries(items) {
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

function buildFlowSeries(items) {
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

function buildMaterialSeries(items) {
  const totals = sumMaterials(items);

  const ordered = MATERIAL_META.map((mat) => ({
    label: mat.label,
    value: totals[mat.key] || 0
  })).filter((item) => item.value > 0);

  return {
    labels: ordered.map((item) => item.label),
    values: ordered.map((item) => item.value)
  };
}

function buildCollectionPointsSeries(items) {
  const map = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const p = resolveParticipant(item);
    const key = p.code || p.name || "Sem código";
    map.set(key, (map.get(key) || 0) + 1);
  });

  const ordered = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);

  return {
    labels: ordered.map(([label]) => label),
    values: ordered.map(([, value]) => value)
  };
}

function renderCharts(items) {
  const ctxMain = document.getElementById("mainChart");
  const ctxA = document.getElementById("secA");
  const ctxB = document.getElementById("secB");
  const ctxC = document.getElementById("secC");

  if (typeof Chart === "undefined") return;

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
            backgroundColor: ["rgba(83,172,222,.82)", "rgba(129,185,42,.82)"]
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
   TABELA
========================= */

function getTableFilters() {
  return {
    search: normalizeText(els.tSearch?.value || ""),
    fluxo: els.tFluxo?.value || "__all__",
    entrega: els.tEntrega?.value || "__all__",
    status: els.tStatus?.value || "__all__",
    tipoCadastro: els.tTipoCadastro?.value || "__all__"
  };
}

function applyTableFilters() {
  const filters = getTableFilters();

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
      if (filters.tipoCadastro === "condominio" && !tipo.includes("condominio") && !tipo.includes("condomínio")) return false;
      if (filters.tipoCadastro === "comercio" && !tipo.includes("comercio") && !tipo.includes("comércio")) return false;
      if (filters.tipoCadastro === "participante" && (tipo.includes("condominio") || tipo.includes("comercio"))) return false;
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

  tableFilteredColetas = [...filteredColetas];
  renderTable(tableFilteredColetas);
}

function statusBadge(item) {
  const status = normalizeText(getStatus(item));

  if (status.includes("cancel")) {
    return `<span class="status-badge rejeitado">Cancelado</span>`;
  }

  if (status.includes("edit")) {
    return `<span class="status-badge pendente">Editado</span>`;
  }

  return `<span class="status-badge realizada">Ativo</span>`;
}

function renderTable(items) {
  if (!els.tableColetasBody) return;

  if (!items.length) {
    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum registro encontrado.</td>
      </tr>
    `;
  } else {
    els.tableColetasBody.innerHTML = items.map((item) => {
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

  if (els.tableVisibleCount) els.tableVisibleCount.textContent = String(items.length);
  if (els.tableFilteredCount) els.tableFilteredCount.textContent = String(filteredColetas.length);
  if (els.tableLastUpdate) els.tableLastUpdate.textContent = formatDateTimeBR(new Date());
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
    const kg = getMaterialValue(item, mat.key);

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
      <div class="coleta-info-card"><strong>Qualidade:</strong> ${escapeHtml(getQualidade(item))}</div>
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
  if (els.editPesoBase) els.editPesoBase.value = inferPesoResiduoSecoBruto(item) || "";
  if (els.editQualidade) els.editQualidade.value = getQualidade(item) === "—" ? "" : getQualidade(item);
  if (els.editRejeito) els.editRejeito.value = inferPesoRejeitoInformado(item) || "";
  if (els.editNaoComercializado) els.editNaoComercializado.value = inferNaoComercializado(item) || "";

  if (els.editPlasticoKg) els.editPlasticoKg.value = getMaterialValue(item, "plasticoKg") || "";
  if (els.editVidroKg) els.editVidroKg.value = getMaterialValue(item, "vidroKg") || "";
  if (els.editAluminioMetalKg) els.editAluminioMetalKg.value = getMaterialValue(item, "aluminioMetalKg") || "";
  if (els.editSacariaKg) els.editSacariaKg.value = getMaterialValue(item, "sacariaKg") || "";
  if (els.editPapelMistoKg) els.editPapelMistoKg.value = getMaterialValue(item, "papelMistoKg") || "";
  if (els.editPapelaoKg) els.editPapelaoKg.value = getMaterialValue(item, "papelaoKg") || "";
  if (els.editIsoporKg) els.editIsoporKg.value = getMaterialValue(item, "isoporKg") || "";
  if (els.editOleoKg) els.editOleoKg.value = getMaterialValue(item, "oleoKg") || "";
  if (els.editObs) els.editObs.value = inferObservacao(item);

  els.editModal.classList.add("show");
  els.editModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

async function saveEdit() {
  if (!activeEditId) return;

  const payload = {
    fluxo: els.editFluxo?.value || "recebimento",
    entrega: els.editEntrega?.value || "",
    pesoRecebido: toNumberBR(els.editPesoBase?.value),
    qualidade: els.editQualidade?.value || "",
    rejeito: toNumberBR(els.editRejeito?.value),
    naoComercializado: toNumberBR(els.editNaoComercializado?.value),
    plasticoKg: toNumberBR(els.editPlasticoKg?.value),
    vidroKg: toNumberBR(els.editVidroKg?.value),
    aluminioMetalKg: toNumberBR(els.editAluminioMetalKg?.value),
    sacariaKg: toNumberBR(els.editSacariaKg?.value),
    papelMistoKg: toNumberBR(els.editPapelMistoKg?.value),
    papelaoKg: toNumberBR(els.editPapelaoKg?.value),
    isoporKg: toNumberBR(els.editIsoporKg?.value),
    oleoKg: toNumberBR(els.editOleoKg?.value),
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

function renderCollectionPoints(items) {
  if (!els.collectionPointsGrid) return;

  const pointsMap = new Map();

  items.filter(isActiveCollection).forEach((item) => {
    const p = resolveParticipant(item);

    if (!p.lat || !p.lng) return;

    const key = p.code || p.name;

    if (!pointsMap.has(key)) {
      pointsMap.set(key, {
        ...p,
        count: 0
      });
    }

    pointsMap.get(key).count += 1;
  });

  const points = Array.from(pointsMap.values());

  if (!points.length) {
    els.collectionPointsGrid.innerHTML = `<div class="empty-materials">Nenhum ponto com coordenadas localizado.</div>`;
  } else {
    els.collectionPointsGrid.innerHTML = points.map((p) => `
      <button type="button" class="point-card" data-route-code="${escapeHtml(p.code)}">
        <span class="point-code">${escapeHtml(p.code)}</span>
        <h4>${escapeHtml(p.name)}</h4>
        <div class="point-address">${escapeHtml(p.address || p.localColeta || "Sem endereço informado")}</div>
        <div class="point-meta">
          <span class="point-chip">${p.count} coleta(s)</span>
        </div>
      </button>
    `).join("");
  }

  if (!routeMap || !routeMarkersLayer) return;

  routeMarkersLayer.clearLayers();

  const base = getCoopBase();

  L.marker([base.lat, base.lng])
    .addTo(routeMarkersLayer)
    .bindPopup("Cooperativa");

  points.forEach((p) => {
    L.marker([p.lat, p.lng])
      .addTo(routeMarkersLayer)
      .bindPopup(`${p.name}<br>${p.code}`);
  });

  if (points.length) {
    const bounds = L.latLngBounds([
      [base.lat, base.lng],
      ...points.map((p) => [p.lat, p.lng])
    ]);

    routeMap.fitBounds(bounds, {
      padding: [30, 30]
    });
  }
}

function renderRouteToPoint(code) {
  const point = Array.from(participantsMap.values()).find((p) => String(p.participantCode) === String(code));

  if (!point || !point.lat || !point.lng || !routeMap || typeof L === "undefined") return;

  const base = getCoopBase();

  if (routeControl && typeof routeMap.removeControl === "function") {
    routeMap.removeControl(routeControl);
    routeControl = null;
  }

  if (els.routeOriginLabel) els.routeOriginLabel.textContent = "Cooperativa";
  if (els.routeDestLabel) els.routeDestLabel.textContent = `${point.name} • ${point.participantCode}`;
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

function getExportRows(items) {
  return items.map((item) => {
    const participant = resolveParticipant(item);

    const row = {
      Data: formatDateBR(inferDateISO(item)),
      Participante: participant.name || "—",
      Código: participant.code || "—",
      Fluxo: formatFluxoLabel(inferFluxo(item)),
      Entrega: inferEntrega(item),
      Território: inferTerritorio(item),
      Tipo: participant.type || "—",
      Status: resolveHumanStatus(item),
      "Reciclável kg": Number(inferTotalReciclavelRegistro(item) || 0),
      "Rejeito kg": Number(inferTotalRejeitoRegistro(item) || 0),
      "Não reciclável kg": Number(inferRejeitoNaoReciclavel(item) || 0),
      "Não comercializado kg": Number(inferNaoComercializado(item) || 0),
      Qualidade: getQualidade(item) || "—",
      Observação: inferObservacao(item) || ""
    };

    MATERIAL_META.forEach((mat) => {
      row[mat.label] = Number(getMaterialValue(item, mat.key) || 0);
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
   MODAIS
========================= */

function closeModal(id) {
  const modal = document.getElementById(id);

  if (!modal) return;

  modal.classList.remove("show", "open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

/* =========================
   EVENTOS
========================= */

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

  document.addEventListener("click", async (event) => {
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