import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const MATERIAL_META = [
  { key: "plasticoKg", label: "Plástico", price: 1.92, icon: "🧴" },
  { key: "vidroKg", label: "Vidro", price: 0.08, icon: "🍾" },
  { key: "metalKg", label: "Metal", price: 2.9, icon: "🥫" },
  { key: "sacariaKg", label: "Sacaria", price: 0.12, icon: "🧵" },
  { key: "papelMistoKg", label: "Papel misto", price: 0.66, icon: "📄" },
  { key: "papelaoKg", label: "Papelão", price: 0.52, icon: "📦" },
  { key: "isoporKg", label: "Isopor", price: 0.4, icon: "🧊" },
  { key: "oleoCozinhaKg", label: "Óleo de cozinha", price: 1.5, icon: "🛢️" }
];

const CHART_COLORS = {
  blue: "#53ACDE",
  green: "#81B92A",
  orange: "#EF6B22"
};

const COOP_BASES = {
  "vila-pinto": { lat: -30.048729170292532, lng: -51.15652604283108 }
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
  editObs: document.getElementById("editObs"),
  btnSaveEdit: document.getElementById("btnSaveEdit")
};

/* =========================
   STATE
========================= */

let coopProfile = null;
let allColetas = [];
let filteredColetas = [];
let tableFilteredColetas = [];
let participantsMap = new Map();
let activeEditId = null;
let selectedLabelRecordId = null;

let mainChart = null;
let secA = null;
let secB = null;
let secC = null;
let weightTimelineChart = null;

let routeMap = null;
let routeControl = null;
let destinationMarker = null;
let selectedPointKey = null;
let activeUnsubscribe = null;

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
  return item.territoryLabel || coopProfile?.territoryLabel || "Território";
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
    item.pesoRejeitoKg ??
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
    item.finalTurno
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

/* =========================
   PERFIL / PARTICIPANTES
========================= */

function matchesProfileTerritory(item, profile) {
  if (!profile?.territoryId) return false;
  const role = normalizeText(profile.role);
  if (role === "admin" || role === "governanca") return true;

  const itemTerr = normalizeTerritory(item.territoryId);
  const userTerr = normalizeTerritory(profile.territoryId);

  return (
    itemTerr === userTerr ||
    itemTerr.includes(userTerr) ||
    userTerr.includes(itemTerr)
  );
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

  return {
    id: participantId || matched?.id || "",
    code: matched?.participantCode || fallbackCode,
    name: directName || matched?.name || (fallbackCode !== "—" ? `Participante ${fallbackCode}` : "Sem participante vinculado"),
    type: matched?.participantType || matched?.type || "",
    status: matched?.status || "—",
    address,
    localColeta: matched?.localColeta || item.localColeta || "",
    lat: Number(matched?.lat ?? matched?.latitude ?? matched?.coords?.lat ?? 0),
    lng: Number(matched?.lng ?? matched?.longitude ?? matched?.coords?.lng ?? 0)
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
  return snap.data();
}

function validateProfile(profile) {
  const role = normalizeText(profile.role);
  if (!["cooperativa", "admin", "governanca"].includes(role)) {
    throw new Error("Acesso permitido somente para cooperativa, admin ou governança.");
  }
  if (profile.status !== "active") {
    throw new Error("Usuário sem acesso ativo.");
  }
  if (!profile.territoryId && role !== "admin" && role !== "governanca") {
    throw new Error("Usuário sem território vinculado.");
  }
}

function fillUser(profile) {
  if (els.userDisplayName) els.userDisplayName.textContent = profile.displayName || profile.name || "Usuário";
  if (els.userRole) els.userRole.textContent = profile.role || "cooperativa";
  if (els.userTerritory) els.userTerritory.textContent = profile.territoryLabel || profile.territoryId || "—";
}

async function loadParticipantsMap() {
  participantsMap.clear();

  let snap;
  try {
    snap = await getDocs(query(collection(db, "participants")));
  } catch (error) {
    console.error("Erro ao carregar participantes:", error);
    return;
  }

  snap.forEach((d) => {
    const data = d.data();
    const payload = {
      id: d.id,
      name: data.name || data.participantName || "Sem nome",
      participantCode: data.participantCode || data.familyCode || data.codigo || d.id,
      participantType: data.participantType || data.type || "",
      status: data.status || "",
      enderecoCompleto: data.enderecoCompleto || "",
      rua: data.rua || "",
      numero: data.numero || "",
      bairro: data.bairro || "",
      cidade: data.cidade || "",
      localColeta: data.localColeta || "",
      lat: data.lat ?? data.latitude ?? null,
      lng: data.lng ?? data.longitude ?? null,
      coords: data.coords || null
    };

    participantsMap.set(d.id, payload);
    if (data.participantCode) participantsMap.set(String(data.participantCode), payload);
    if (data.familyCode) participantsMap.set(String(data.familyCode), payload);
    if (data.codigo) participantsMap.set(String(data.codigo), payload);
  });
}

/* =========================
   FIRESTORE COLETAS
========================= */

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

      if (normalizeText(coopProfile?.role) !== "admin" && normalizeText(coopProfile?.role) !== "governanca") {
        loaded = loaded.filter((item) => matchesProfileTerritory(item, coopProfile));
      }

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
  const qRef = query(collection(db, "coletas"));
  subscribeToQuery(qRef);
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
  }
}

/* =========================
   GRÁFICOS
========================= */

function destroyCharts() {
  [mainChart, secA, secB, secC, weightTimelineChart].forEach((chart) => {
    if (chart) chart.destroy();
  });
}

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
  if (!canvas) return;

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
  const territoryKey = normalizeTerritory(coopProfile?.territoryId);
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

function drawRouteToPoint(point) {
  if (!routeMap || !point?.lat || !point?.lng || typeof L === "undefined" || !L.Routing) return;

  const base = getCoopBaseLatLng();
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
  const selectedPoint = points.find((p) => p.key === selectedPointKey) || points[0];
  if (selectedPoint) drawRouteToPoint(selectedPoint);
}

/* =========================
   TABELA
========================= */

function renderQualidadeBadge(item) {
  const q = getQualidade(item);
  if (!q) return `<span class="quality-badge">—</span>`;
  if (q === "1") return `<span class="quality-badge quality-1">1</span>`;
  if (q === "2") return `<span class="quality-badge quality-2">2</span>`;
  if (q === "3") return `<span class="quality-badge quality-3">3</span>`;
  return `<span class="quality-badge">${escapeHtml(q)}</span>`;
}

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
    const detailParts = [
      `Entrega: ${inferEntrega(item)}`,
      `Seco: ${formatKg(inferResiduoSeco(item))}`,
      `Rejeito: ${formatKg(inferRejeito(item))}`,
      `Não comerc.: ${formatKg(inferNaoComercializado(item))}`,
      `Qualidade: ${getQualidade(item) || "—"}`
    ];

    return `
      <tr class="${canceled ? "row-muted" : ""}">
        <td>${formatDateBR(inferDateISO(item))}</td>
        <td>${escapeHtml(participant.name)}</td>
        <td>${escapeHtml(participant.code)}</td>
        <td>${escapeHtml(inferFluxo(item))}</td>
        <td>${renderStatusBadge(item)}</td>
        <td>${detailParts.map((p) => `<div>${escapeHtml(p)}</div>`).join("")}</td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" data-edit="${item.id}" ${canceled ? "disabled" : ""}>Editar</button>
            <button class="action-btn cancel" data-cancel="${item.id}" ${canceled ? "disabled" : ""}>Cancelar</button>
            <button class="action-btn edit" data-label="${item.id}">Etiqueta</button>
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
   ETIQUETA
========================= */

function renderLabelQr(record) {
  if (!els.collectionLabelQr) return;
  const participant = resolveParticipant(record);
  const filterUrl = `${window.location.origin}${window.location.pathname}?codigo=${encodeURIComponent(participant.code || "")}`;

  els.collectionLabelQr.innerHTML = `
    <div style="display:grid;place-items:center;width:100%;min-height:140px;border:1px dashed rgba(60,58,57,.18);border-radius:16px;padding:12px;text-align:center;">
      <div>
        <div style="font-weight:800;margin-bottom:8px;">QR / Link rápido</div>
        <div style="font-size:12px;word-break:break-word;">${escapeHtml(filterUrl)}</div>
      </div>
    </div>
  `;
}

function generateCollectionLabel(recordId = selectedLabelRecordId) {
  const record = allColetas.find((item) => item.id === recordId);
  if (!record) {
    alert("Selecione um registro da tabela para gerar a etiqueta.");
    return;
  }

  selectedLabelRecordId = record.id;
  const participant = resolveParticipant(record);

  if (els.labelParticipantName) els.labelParticipantName.textContent = participant.name || "—";
  if (els.labelParticipantCode) els.labelParticipantCode.textContent = participant.code || "—";
  if (els.labelCollectionDate) els.labelCollectionDate.textContent = formatDateBR(inferDateISO(record));
  if (els.labelCollectionFlow) els.labelCollectionFlow.textContent = inferFluxo(record);

  renderLabelQr(record);
}

function printCollectionLabel() {
  if (!selectedLabelRecordId) {
    alert("Gere uma etiqueta antes de imprimir.");
    return;
  }
  window.print();
}

/* =========================
   MODAIS / AÇÕES
========================= */

function openPhoto(url) {
  if (!url || !els.photoModal || !els.photoModalImg) return;
  els.photoModalImg.src = url;
  els.photoModal.classList.add("open");
  els.photoModal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
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
  if (els.editObs) els.editObs.value = inferObservacao(item);

  if (els.editModal) {
    els.editModal.classList.add("open");
    els.editModal.setAttribute("aria-hidden", "false");
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

  if (isEditFinalTurno) {
    payload["finalTurno.observacao"] = els.editObs?.value?.trim?.() || "";
    payload["finalTurno.pesoResiduoSecoKg"] = Number(els.editPesoBase?.value || 0);
    payload["finalTurno.qualidadeNota"] = qualityValue;
    payload["finalTurno.pesoRejeitoKg"] = Number(els.editRejeito?.value || 0);
    payload["finalTurno.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado?.value || 0);
  } else {
    payload["recebimento.observacao"] = els.editObs?.value?.trim?.() || "";
    payload["recebimento.pesoResiduoSecoKg"] = Number(els.editPesoBase?.value || 0);
    payload["recebimento.qualidadeNota"] = qualityValue;
    payload["recebimento.pesoRejeitoKg"] = Number(els.editRejeito?.value || 0);
    payload["recebimento.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado?.value || 0);
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
  els.btnAplicar?.addEventListener("click", applyFilters);
  els.btnLimpar?.addEventListener("click", clearFilters);
  els.btnPrint?.addEventListener("click", () => window.print());
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

  els.btnGenerateCollectionLabel?.addEventListener("click", () => generateCollectionLabel());
  els.btnPrintCollectionLabel?.addEventListener("click", printCollectionLabel);

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

    const labelBtn = event.target.closest("[data-label]");
    if (labelBtn) {
      selectedLabelRecordId = labelBtn.dataset.label;
      generateCollectionLabel(selectedLabelRecordId);
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

      fillUser(profile);
      await loadParticipantsMap();
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