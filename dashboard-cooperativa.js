import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const MATERIAL_META = [
  { key: "plasticoKg", label: "Plástico", price: 1.92, icon: "🧴" },
  { key: "vidroKg", label: "Vidro", price: 0.08, icon: "🍾" },
  { key: "aluminioMetalKg", label: "Metal", price: 2.9, icon: "🥫" },
  { key: "sacariaKg", label: "Sacaria", price: 0.12, icon: "🧵" },
  { key: "papelMistoKg", label: "Papel misto", price: 0.66, icon: "📄" },
  { key: "papelaoKg", label: "Papelão", price: 0.52, icon: "📦" },
  { key: "isoporKg", label: "Isopor", price: 0.4, icon: "🧊" },
  { key: "oleoKg", label: "Óleo de cozinha", price: 1.5, icon: "🛢️" }
];

const CHART_COLORS = {
  blue: "#53ACDE",
  green: "#81B92A",
  orange: "#EF6B22"
};

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
  quickParticipantAddress: document.getElementById("quickParticipantAddress"),
  quickParticipantStatus: document.getElementById("quickParticipantStatus"),

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
  k_outroKg: document.getElementById("k_outroKg"),

  materialCards: document.getElementById("materialCards"),
  collectionPointsGrid: document.getElementById("collectionPointsGrid"),
  tableColetasBody: document.getElementById("tableColetasBody"),

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
  btnSaveEdit: document.getElementById("btnSaveEdit"),

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
  btnGenerateCollectionLabel: document.getElementById("btnGenerateCollectionLabel"),
  btnPrintCollectionLabel: document.getElementById("btnPrintCollectionLabel"),

  collectionLabelModal: document.getElementById("collectionLabelModal"),
  printLabelParticipantName: document.getElementById("printLabelParticipantName"),
  printLabelParticipantCode: document.getElementById("printLabelParticipantCode"),
  printLabelCollectionDate: document.getElementById("printLabelCollectionDate"),
  printLabelCollectionFlow: document.getElementById("printLabelCollectionFlow")
};

let coopProfile = null;
let allColetas = [];
let filteredColetas = [];
let tableFilteredColetas = [];
let participantsMap = new Map();
let participantsList = [];
let activeEditId = null;
let selectedCollectionLabelRecord = null;

let mainChart = null;
let secA = null;
let secB = null;
let secC = null;
let weightTimelineChart = null;

let routeMap = null;
let routeControl = null;
let coopMarker = null;
let destinationMarker = null;
let pointsLayer = null;
let selectedPointKey = null;
let activeUnsubscribe = null;

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

function normalizeSlug(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function createdAtToISO(item) {
  if (item.createdAt?.toDate) return item.createdAt.toDate().toISOString();
  if (item.updatedAt?.toDate) return item.updatedAt.toDate().toISOString();
  return item.createdAtClient || "";
}

function inferDateISO(item) {
  if (item.opDate) return String(item.opDate).slice(0, 10);
  const iso = createdAtToISO(item);
  return iso ? iso.slice(0, 10) : "";
}

function inferDateTimeISO(item) {
  return createdAtToISO(item) || item.opDate || "";
}

function firstPhotoUrl(item) {
  if (item.photoURL) return item.photoURL;
  if (item.photoUrl) return item.photoUrl;
  if (item.fotoURL) return item.fotoURL;
  if (item.fotoUrl) return item.fotoUrl;
  if (Array.isArray(item.photos) && item.photos.length) return item.photos[0];
  if (Array.isArray(item.fotos) && item.fotos.length) return item.fotos[0];
  if (Array.isArray(item.recebimento?.fotosResiduo) && item.recebimento.fotosResiduo.length) return item.recebimento.fotosResiduo[0];
  if (Array.isArray(item.recebimento?.fotosNaoComercializado) && item.recebimento.fotosNaoComercializado.length) return item.recebimento.fotosNaoComercializado[0];
  if (Array.isArray(item.finalTurno?.fotosResiduo) && item.finalTurno.fotosResiduo.length) return item.finalTurno.fotosResiduo[0];
  return "";
}

function inferTerritorio(item) {
  return item.territoryLabel || coopProfile?.territoryLabel || "Território";
}

function inferTerritorioId(item) {
  return String(item.territoryId || "").trim();
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

function inferResiduoSeco(item) {
  return Number(
    item.recebimento?.pesoResiduoSecoKg ??
    item.finalTurno?.pesoResiduoSecoKg ??
    item.pesoResiduoSecoKg ??
    0
  );
}

function inferRejeitoNaoReciclavel(item) {
  return Number(
    item.recebimento?.pesoRejeitoKg ??
    item.finalTurno?.pesoRejeitoKg ??
    item.finalTurno?.pesoRejeitoGeralKg ??
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

function inferRejeitoTotal(item) {
  return inferRejeitoNaoReciclavel(item) + inferNaoComercializado(item);
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

function materialFractionsText(item) {
  const partes = MATERIAL_META
    .map((mat) => {
      const value = getMaterialValue(item, mat.key);
      return value > 0 ? `${mat.label}: ${formatNumber(value)} kg` : "";
    })
    .filter(Boolean);

  return partes.length ? partes.join(" • ") : "—";
}

function extrasFractionsText(item) {
  const extras = Array.isArray(item.finalTurno?.extras) ? item.finalTurno.extras : [];
  if (!extras.length) return "—";

  return extras
    .map((e) => {
      const nome = e?.nome || e?.name || "Extra";
      const peso = Number(e?.pesoKg || e?.kg || 0);
      return `${nome}: ${formatNumber(peso)} kg`;
    })
    .join(" • ");
}

function buildTerritoryAliases(profile) {
  const aliases = new Set();
  const id = String(profile?.territoryId || "").trim();
  const label = String(profile?.territoryLabel || "").trim();

  if (id) {
    aliases.add(id);
    aliases.add(id.replaceAll("-", "_"));
    aliases.add(id.replaceAll("_", "-"));
    aliases.add(normalizeSlug(id));
    aliases.add(normalizeSlug(id).replaceAll("_", "-"));
  }

  if (label) {
    const slug = normalizeSlug(label);
    if (slug) {
      aliases.add(slug);
      aliases.add(slug.replaceAll("_", "-"));
    }
  }

  const normalized = [...aliases].map(normalizeSlug).filter(Boolean);

  if (
    normalized.some((v) => v.includes("vila_pinto")) ||
    normalized.some((v) => v.includes("crgr_vila_pinto"))
  ) {
    aliases.add("crgr_vila_pinto");
    aliases.add("crgr-vila-pinto");
    aliases.add("vila_pinto");
    aliases.add("vila-pinto");
  }

  return [...aliases].filter(Boolean);
}

function matchesProfileTerritory(item, profile) {
  if (!profile || ["admin", "governanca", "gestor"].includes(profile.role)) return true;

  const itemId = inferTerritorioId(item);
  if (!itemId) return false;

  const aliases = buildTerritoryAliases(profile);
  return aliases.includes(itemId);
}

function resolveParticipant(item) {
  const participantId = item.participantId || null;
  const participantCode = normalizeCode(item.participantCode || "");
  const familyCode = normalizeCode(
    item.familyCode ||
    item.recebimento?.familyCode ||
    item.finalTurno?.familyCode ||
    ""
  );
  const condCode = normalizeCode(item.condCode || "");
  const directName = item.participantName || null;

  const fromId = participantId ? participantsMap.get(String(participantId)) : null;
  const fromParticipantCode = participantCode ? participantsMap.get(participantCode) : null;
  const fromFamilyCode = familyCode ? participantsMap.get(familyCode) : null;
  const fromCondCode = condCode ? participantsMap.get(condCode) : null;

  const matched = fromId || fromParticipantCode || fromFamilyCode || fromCondCode || null;
  const fallbackCode = participantCode || familyCode || condCode || "—";

  let address = "";
  if (matched) {
    address =
      matched.enderecoCompleto ||
      matched.address ||
      matched.fullAddress ||
      [matched.rua || "", matched.numero || "", matched.bairro ? `- ${matched.bairro}` : "", matched.cidade || ""]
        .filter(Boolean)
        .join(" ");
  }

  return {
    id: participantId || matched?.id || "",
    code: matched?.participantCode || fallbackCode,
    name: directName || matched?.name || (fallbackCode !== "—" ? `Participante ${fallbackCode}` : "Sem participante vinculado"),
    type: matched?.registerType || matched?.participantType || matched?.type || item.registerType || "",
    localType: matched?.localType || item.localType || "",
    email: matched?.email || "",
    cpf: matched?.cpf || "",
    phone: matched?.phone || "",
    address,
    localColeta: matched?.localColeta || item.localColeta || "",
    lat: Number(matched?.lat ?? matched?.latitude ?? item.lat ?? item.latitude ?? 0),
    lng: Number(matched?.lng ?? matched?.longitude ?? item.lng ?? item.longitude ?? 0),
    status: matched?.status || matched?.approvalStatus || ""
  };
}

function renderQualidadeBadge(item) {
  const q = getQualidade(item);
  if (!q) return `<span class="quality-badge">—</span>`;
  if (q === "1") return `<span class="quality-badge quality-1">1</span>`;
  if (q === "2") return `<span class="quality-badge quality-2">2</span>`;
  return `<span class="quality-badge quality-3">${escapeHtml(q)}</span>`;
}

function renderStatusBadge(item) {
  const status = getStatus(item);
  if (status === "cancelado") return `<span class="status-badge status-cancelado">Cancelado</span>`;
  if (item.updatedAt) return `<span class="status-badge status-editado">Editado</span>`;
  return `<span class="status-badge status-ok">Ativo</span>`;
}

function matchesDateRange(item, ini, fim) {
  const dateIso = inferDateISO(item);
  if (!dateIso) return true;
  if (ini && dateIso < ini) return false;
  if (fim && dateIso > fim) return false;
  return true;
}

function fillUser(profile) {
  els.userDisplayName.textContent = profile.displayName || profile.name || "Usuário";
  els.userRole.textContent = profile.role || "cooperativa";
  els.userTerritory.textContent = profile.territoryLabel || profile.territoryId || "—";
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado.");
  return snap.data();
}

function validateProfile(profile) {
  if (!["cooperativa", "admin", "governanca", "gestor"].includes(profile.role)) {
    throw new Error("Acesso permitido somente para cooperativa, governança, gestor ou administrador.");
  }
  if (profile.status !== "active") {
    throw new Error("Usuário sem acesso ativo.");
  }
  if (!profile.territoryId && !["admin", "governanca", "gestor"].includes(profile.role)) {
    throw new Error("Usuário sem território vinculado.");
  }
}

async function loadParticipantsMap(territoryId) {
  participantsMap.clear();
  participantsList = [];

  let queriesToRun = [];

  if (["admin", "governanca", "gestor"].includes(coopProfile?.role)) {
    queriesToRun = [query(collection(db, "participants"))];
  } else {
    const aliases = buildTerritoryAliases({
      territoryId,
      territoryLabel: coopProfile?.territoryLabel || ""
    });
    const uniqueAliases = [...new Set(aliases)].filter(Boolean).slice(0, 10);

    if (uniqueAliases.length > 1) {
      queriesToRun = [query(collection(db, "participants"), where("territoryId", "in", uniqueAliases))];
    } else {
      queriesToRun = [query(collection(db, "participants"), where("territoryId", "==", uniqueAliases[0] || territoryId))];
    }
  }

  let docs = [];
  try {
    for (const qRef of queriesToRun) {
      const snap = await getDocs(qRef);
      docs = docs.concat(snap.docs);
    }
  } catch {
    const snap = await getDocs(query(collection(db, "participants"), where("territoryId", "==", territoryId)));
    docs = snap.docs;
  }

  const seen = new Set();

  docs.forEach((d) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);

    const data = d.data();
    const payload = {
      id: d.id,
      name: data.name || data.participantName || "Sem nome",
      participantCode: normalizeCode(data.participantCode || data.familyCode || data.codigo || d.id),
      familyCode: normalizeCode(data.familyCode || ""),
      registerType: data.registerType || "",
      participantType: data.participantType || data.type || "",
      localType: data.localType || "",
      email: data.email || "",
      cpf: data.cpf || "",
      phone: data.phone || "",
      status: data.status || data.approvalStatus || "",
      enderecoCompleto: data.enderecoCompleto || "",
      address: data.address || "",
      fullAddress: data.fullAddress || "",
      rua: data.rua || "",
      numero: data.numero || "",
      bairro: data.bairro || "",
      cidade: data.cidade || "",
      localColeta: data.localColeta || "",
      lat: data.lat ?? data.latitude ?? null,
      lng: data.lng ?? data.longitude ?? null
    };

    participantsList.push(payload);
    participantsMap.set(d.id, payload);
    if (payload.participantCode) participantsMap.set(payload.participantCode, payload);
    if (payload.familyCode) participantsMap.set(payload.familyCode, payload);
  });
}

function findParticipantByCodeLike(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;

  const exact = participantsList.find((p) => p.participantCode === normalized || p.familyCode === normalized);
  if (exact) return exact;

  return participantsList.find((p) =>
    p.participantCode?.includes(normalized) || p.familyCode?.includes(normalized)
  ) || null;
}

function renderQuickParticipantPreview() {
  if (!els.quickParticipantPreview) return;

  const code = normalizeCode(els.fParticipantCode?.value || "");
  if (!code) {
    els.quickParticipantPreview.classList.add("hidden");
    return;
  }

  const participant = findParticipantByCodeLike(code);
  if (!participant) {
    els.quickParticipantPreview.classList.remove("hidden");
    els.quickParticipantName.textContent = "Participante não encontrado";
    els.quickParticipantCode.textContent = code;
    els.quickParticipantType.textContent = "—";
    els.quickParticipantAddress.textContent = "Nenhum cadastro correspondente.";
    els.quickParticipantStatus.textContent = "—";
    return;
  }

  els.quickParticipantPreview.classList.remove("hidden");
  els.quickParticipantName.textContent = participant.name || "—";
  els.quickParticipantCode.textContent = participant.participantCode || participant.familyCode || "—";
  els.quickParticipantType.textContent = participant.registerType || participant.localType || participant.participantType || "—";
  els.quickParticipantAddress.textContent = participant.enderecoCompleto || participant.address || "Endereço não informado";
  els.quickParticipantStatus.textContent = participant.status || "—";
}

function populateFilters(items) {
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "—") entregas.add(entrega);
  });

  const currentEntrega = els.fEntrega.value || "__all__";
  const currentTableEntrega = els.tEntrega?.value || "__all__";

  const options =
    `<option value="__all__">Todos</option>` +
    Array.from(entregas).sort().map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");

  els.fEntrega.innerHTML = options;

  if (els.tEntrega) {
    els.tEntrega.innerHTML =
      `<option value="__all__">Todas</option>` +
      Array.from(entregas).sort().map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
  }

  els.fEntrega.value = Array.from(entregas).includes(currentEntrega) ? currentEntrega : "__all__";
  if (els.tEntrega) {
    els.tEntrega.value = Array.from(entregas).includes(currentTableEntrega) ? currentTableEntrega : "__all__";
  }
}

function updateTopInfo() {
  els.txtRegistrosTopo.textContent = String(filteredColetas.length);

  const ini = els.fIni.value;
  const fim = els.fFim.value;

  if (ini && fim) {
    els.txtPeriodo.textContent = `${formatDateBR(ini)} → ${formatDateBR(fim)}`;
    return;
  }
  if (ini && !fim) {
    els.txtPeriodo.textContent = `${formatDateBR(ini)} → hoje`;
    return;
  }
  if (!ini && fim) {
    els.txtPeriodo.textContent = `até ${formatDateBR(fim)}`;
    return;
  }

  const dates = filteredColetas.map((item) => inferDateISO(item)).filter(Boolean).sort();
  els.txtPeriodo.textContent = dates.length
    ? `${formatDateBR(dates[0])} → ${formatDateBR(dates[dates.length - 1])}`
    : "—";
}

function renderKpis(items) {
  const ativos = items.filter((item) => getStatus(item) !== "cancelado");
  const participantIds = new Set();

  let residuoSeco = 0;
  let rejeitoTotal = 0;
  let finalTurno = 0;

  ativos.forEach((item) => {
    const p = resolveParticipant(item);
    if (p.code && p.code !== "—") participantIds.add(p.code);

    const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
    residuoSeco += isFinalTurno(item) ? somaMateriais : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item));
    rejeitoTotal += inferRejeitoTotal(item);
    if (isFinalTurno(item)) finalTurno += 1;
  });

  els.k_totalColetas.textContent = String(ativos.length);
  els.k_participantes.textContent = String(participantIds.size);
  els.k_residuoSeco.textContent = formatNumber(residuoSeco);
  els.k_rejeito.textContent = formatNumber(rejeitoTotal);
  els.k_finalTurno.textContent = String(finalTurno);
}

function sumMaterials(items) {
  const totals = {};
  MATERIAL_META.forEach((mat) => {
    totals[mat.key] = 0;
  });

  items.filter((item) => getStatus(item) !== "cancelado").forEach((item) => {
    MATERIAL_META.forEach((mat) => {
      const value = getMaterialValue(item, mat.key);
      totals[mat.key] += Number.isFinite(value) ? value : 0;
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
  const participantCondominioSet = new Set();
  const participantComercioSet = new Set();

  let entregaVoluntaria = 0;

  ativos.forEach((item) => {
    const participant = resolveParticipant(item);
    const type = normalizeText(participant.type || participant.localType);
    const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);

    if (isFinalTurno(item)) {
      reciclavelKg += somaMateriais;
    } else {
      const pesoBase = inferResiduoSeco(item);
      reciclavelKg += somaMateriais > 0 ? somaMateriais : pesoBase;
    }

    rejeitoNaoReciclavelKg += inferRejeitoNaoReciclavel(item);
    naoComercializadoKg += inferNaoComercializado(item);

    const d = inferDateISO(item);
    if (d) uniqueDays.add(d);

    if (participant.code && participant.code !== "—") participantSet.add(participant.code);
    if (type === "condominio") participantCondominioSet.add(participant.code || participant.name);
    if (type === "comercio") participantComercioSet.add(participant.code || participant.name);

    if (normalizeText(inferEntrega(item)).includes("volunt")) {
      entregaVoluntaria += 1;
    }
  });

  const rejeitoTotalKg = rejeitoNaoReciclavelKg + naoComercializadoKg;
  const totalGeral = reciclavelKg + rejeitoTotalKg;
  const reciclavelPct = totalGeral ? (reciclavelKg / totalGeral) * 100 : 0;
  const rejeitoTotalPct = totalGeral ? (rejeitoTotalKg / totalGeral) * 100 : 0;

  let receitaTotal = 0;
  MATERIAL_META.forEach((mat) => {
    receitaTotal += (materialTotals[mat.key] || 0) * mat.price;
  });

  return {
    materialTotals,
    reciclavelKg,
    rejeitoNaoReciclavelKg,
    naoComercializadoKg,
    rejeitoTotalKg,
    reciclavelPct,
    rejeitoTotalPct,
    receitaTotal,
    totalDiasProjeto: uniqueDays.size,
    operacoesRealizadas: ativos.length,
    participantesProjeto: participantSet.size,
    condominiosParticipantes: participantCondominioSet.size,
    comercioParticipantes: participantComercioSet.size,
    entregaVoluntaria
  };
}

function renderExpandedPanel(items) {
  const m = computeExpandedMetrics(items);
  const allDates = items.map((item) => inferDateISO(item)).filter(Boolean).sort();
  const projectStart = allDates.length ? formatDateBR(allDates[0]) : "—";

  els.k_totalDiasProjeto.textContent = String(m.totalDiasProjeto);
  els.k_inicioProjeto.textContent = `Início: ${projectStart}`;
  els.k_operacoesRealizadas.textContent = String(m.operacoesRealizadas);
  els.k_participantesProjeto.textContent = String(m.participantesProjeto);
  els.k_condominiosParticipantes.textContent = String(m.condominiosParticipantes);
  els.k_entregaVoluntaria.textContent = String(m.entregaVoluntaria);
  els.k_comercioParticipantes.textContent = String(m.comercioParticipantes);

  els.k_totalReciclavelKg.textContent = formatNumber(m.reciclavelKg);
  els.k_totalReciclavelPct.textContent = `${formatNumber(m.reciclavelPct)}%`;
  els.k_receitaTotal.textContent = formatMoneyBR(m.receitaTotal);
  els.k_totalRejeitoKg.textContent = formatNumber(m.rejeitoTotalKg);
  els.k_totalRejeitoPct.textContent = `${formatNumber(m.rejeitoTotalPct)}%`;

  const rejeitoBase = m.rejeitoTotalKg;
  const pctNaoReciclavel = rejeitoBase ? (m.rejeitoNaoReciclavelKg / rejeitoBase) * 100 : 0;
  const pctNaoComercializado = rejeitoBase ? (m.naoComercializadoKg / rejeitoBase) * 100 : 0;

  els.k_rejeitoNaoReciclavelPct.textContent = `${formatNumber(pctNaoReciclavel)}%`;
  els.k_rejeitoNaoReciclavelKg.textContent = formatKg(m.rejeitoNaoReciclavelKg);
  els.k_naoComercializadoPct.textContent = `${formatNumber(pctNaoComercializado)}%`;
  els.k_naoComercializadoKg.textContent = formatKg(m.naoComercializadoKg);
  if (els.k_outroKg) els.k_outroKg.textContent = "Óleo na Seção 2";

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

function getCoopBaseLatLng() {
  if (coopProfile?.territoryId === "crgr_vila_pinto" || coopProfile?.territoryId === "vila-pinto") {
    return { lat: -30.048729170292532, lng: -51.15652604283108 };
  }
  if (coopProfile?.baseLat && coopProfile?.baseLng) {
    return { lat: Number(coopProfile.baseLat), lng: Number(coopProfile.baseLng) };
  }
  return { lat: -30.048729170292532, lng: -51.15652604283108 };
}

function pointColor(point) {
  const code = normalizeCode(point.code || "");
  const type = normalizeText(point.type || point.localType || "");
  if (code.startsWith("COND-") || type === "condominio") return "#EF6B22";
  return "#53ACDE";
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

  pointsLayer = L.layerGroup().addTo(routeMap);

  coopMarker = L.circleMarker([base.lat, base.lng], {
    radius: 10,
    color: "#2f7d32",
    fillColor: "#81B92A",
    fillOpacity: 0.95,
    weight: 2
  }).addTo(routeMap).bindPopup("Cooperativa");
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

  if (els.routeDistanceLabel) {
    els.routeDistanceLabel.textContent = `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  }
  if (els.routeTimeLabel) {
    els.routeTimeLabel.textContent = `${min} min`;
  }
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
  if (!routeMap || !point?.lat || !point?.lng || typeof L === "undefined") return;

  const base = getCoopBaseLatLng();

  clearRouteControl();

  destinationMarker = L.circleMarker([point.lat, point.lng], {
    radius: 9,
    color: pointColor(point),
    fillColor: pointColor(point),
    fillOpacity: 0.95,
    weight: 2
  }).addTo(routeMap).bindPopup(point.name || "Destino");

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
        type: participant.type,
        localType: participant.localType,
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

  const points = getParticipantPointDataFromMapItems(items);

  if (pointsLayer) pointsLayer.clearLayers();

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

  points.forEach((point) => {
    L.circleMarker([point.lat, point.lng], {
      radius: 7,
      color: pointColor(point),
      fillColor: pointColor(point),
      fillOpacity: 0.9,
      weight: 2
    }).bindPopup(`${point.name}<br>${point.code || ""}`).addTo(pointsLayer);
  });

  els.collectionPointsGrid.innerHTML = points.map((point) => `
    <article class="point-card ${selectedPointKey === point.key ? "active" : ""}" data-route-point="${escapeHtml(point.key)}">
      <div class="point-code">${escapeHtml(point.code || "sem código")}</div>
      <h4>${escapeHtml(point.name)}</h4>
      <div class="point-address">${escapeHtml(point.address || "Endereço não informado")}</div>
      <div class="point-meta">
        <span class="point-chip">${pointColor(point) === "#EF6B22" ? "🏢 Condomínio" : "👤 Participante"}</span>
        <span class="point-chip">📍 ${escapeHtml(point.localColeta || "Coleta")}</span>
      </div>
    </article>
  `).join("");

  if (!selectedPointKey) selectedPointKey = points[0].key;
  const selectedPoint = points.find((p) => p.key === selectedPointKey) || points[0];
  if (selectedPoint) drawRouteToPoint(selectedPoint);
}

function chartAxisOptions(chartType, unitLabel = "kg", horizontal = false) {
  if (chartType === "doughnut" || chartType === "pie") return {};

  if (horizontal) {
    return {
      x: { beginAtZero: true, title: { display: true, text: unitLabel } },
      y: { title: { display: false, text: "" } }
    };
  }

  return {
    y: { beginAtZero: true, title: { display: true, text: unitLabel } },
    x: { title: { display: false, text: "" } }
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
  const rejeito = valid.map((item) => inferRejeitoTotal(item));

  if (weightTimelineChart) weightTimelineChart.destroy();

  weightTimelineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Peso do rejeito total (kg)",
          data: rejeito,
          backgroundColor: "rgba(239,107,34,.75)"
        },
        {
          label: "Peso reciclável (kg)",
          data: reciclavel,
          backgroundColor: "rgba(129,185,42,.75)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: "bottom" } },
      scales: chartAxisOptions("bar", "kg")
    }
  });
}

function buildDailySeries(items) {
  const map = new Map();

  items.filter((item) => getStatus(item) !== "cancelado").forEach((item) => {
    const d = inferDateISO(item);
    if (!d) return;
    map.set(d, (map.get(d) || 0) + 1);
  });

  const labels = Array.from(map.keys()).sort();
  const values = labels.map((l) => map.get(l));
  return { labels, values };
}

function buildFlowSeries(items) {
  const map = { recebimento: 0, final_turno: 0 };

  items.filter((item) => getStatus(item) !== "cancelado").forEach((item) => {
    const fluxo = inferFluxo(item);
    if (map[fluxo] !== undefined) map[fluxo] += 1;
  });

  return {
    labels: ["Recebimento", "Final do turno"],
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

  items.filter((item) => getStatus(item) !== "cancelado").forEach((item) => {
    const participant = resolveParticipant(item);
    const key = participant.localColeta || participant.address || inferEntrega(item) || "Ponto não informado";
    map.set(key, (map.get(key) || 0) + 1);
  });

  const labels = Array.from(map.keys());
  const values = labels.map((l) => map.get(l));
  return { labels, values };
}

function getChartOptions(type, horizontal = false, unitLabel = "Quantidade") {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "bottom" } }
  };

  if (type === "doughnut" || type === "pie") return base;

  return {
    ...base,
    scales: chartAxisOptions(type, unitLabel, horizontal)
  };
}

function destroyCharts() {
  [mainChart, secA, secB, secC].forEach((chart) => {
    if (chart) chart.destroy();
  });
}

function renderCharts(items) {
  destroyCharts();

  const daily = buildDailySeries(items);
  const flow = buildFlowSeries(items);
  const material = buildMaterialSeries(items);
  const points = buildCollectionPointsSeries(items);

  const mainType = els.chartMainType?.value || "line";
  const flowType = els.chartFlowType?.value || "doughnut";
  const materialType = els.chartDeliveryType?.value || "bar";
  const pointsType = els.chartTerritoryType?.value || "bar";

  const mainCanvas = document.getElementById("mainChart");
  const secACanvas = document.getElementById("secA");
  const secBCanvas = document.getElementById("secB");
  const secCCanvas = document.getElementById("secC");

  if (!mainCanvas || !secACanvas || !secBCanvas || !secCCanvas) return;

  mainChart = new Chart(mainCanvas, {
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
        pointRadius: mainType === "line" ? 4 : 0,
        pointHoverRadius: mainType === "line" ? 5 : 0
      }]
    },
    options: getChartOptions(mainType, false, "Quantidade")
  });

  secA = new Chart(secACanvas, {
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
    options: getChartOptions(flowType, false, "Quantidade")
  });

  secB = new Chart(secBCanvas, {
    type: materialType,
    data: {
      labels: material.labels,
      datasets: [{
        label: "Coletas por materiais (kg)",
        data: material.values,
        backgroundColor: material.labels.map(() => "rgba(129,185,42,.40)"),
        borderColor: material.labels.map(() => CHART_COLORS.green),
        borderWidth: materialType === "line" ? 3 : 1.5,
        fill: materialType === "line"
      }]
    },
    options: getChartOptions(materialType, false, "kg")
  });

  secC = new Chart(secCCanvas, {
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
      ...getChartOptions(pointsType, pointsType === "bar", "Quantidade"),
      indexAxis: pointsType === "bar" ? "y" : "x"
    }
  });
}

function renderPhotoCell(item) {
  const photo = firstPhotoUrl(item);
  const qtdResiduo = Number(item.recebimento?.fotosResiduoQtd ?? 0);
  const qtdNaoComercializado = Number(item.recebimento?.fotosNaoComercializadoQtd ?? 0);
  const qtdFinalTurno = Number(item.finalTurno?.fotosQtd ?? 0);
  const totalFotos = qtdResiduo + qtdNaoComercializado + qtdFinalTurno;

  if (photo) {
    return `<img src="${escapeHtml(photo)}" alt="Foto do registro" class="photo-thumb" data-photo="${escapeHtml(photo)}" />`;
  }
  if (totalFotos > 0) {
    return `<span class="photo-badge has-photo">${totalFotos} foto(s)</span>`;
  }
  return `<span class="empty-photo">—</span>`;
}

function renderRawDetails(item, participant) {
  const details = [
    `territoryId: ${inferTerritorioId(item) || "—"}`,
    `participantCode: ${participant.code || item.participantCode || "—"}`,
    `familyCode: ${item.familyCode || item.recebimento?.familyCode || "—"}`,
    `condCode: ${item.condCode || "—"}`,
    `localType: ${participant.localType || "—"}`,
    `registerType: ${participant.type || "—"}`,
    `localColeta: ${participant.localColeta || "—"}`,
    `email: ${participant.email || "—"}`,
    `telefone: ${participant.phone || "—"}`,
    `cpf: ${participant.cpf || "—"}`
  ];

  return details.map((d) => `<div>${escapeHtml(d)}</div>`).join("");
}

function getDashboardQrUrl(participantCode) {
  const url = new URL(window.location.href);
  url.searchParams.set("participantCode", participantCode);
  return url.toString();
}

function renderQrCodeInContainer(containerId, text) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = "";

  if (typeof QRCode === "undefined") {
    el.innerHTML = "<span>QR indisponível</span>";
    return;
  }

  new QRCode(el, {
    text,
    width: 160,
    height: 160,
    correctLevel: QRCode.CorrectLevel.H
  });
}

function fillCollectionLabel(record) {
  if (!record) return;

  const participant = resolveParticipant(record);
  const code = participant.code || record.participantCode || "";
  const qrUrl = getDashboardQrUrl(code);

  if (els.labelParticipantName) els.labelParticipantName.textContent = participant.name || "—";
  if (els.labelParticipantCode) els.labelParticipantCode.textContent = code || "—";
  if (els.labelCollectionDate) els.labelCollectionDate.textContent = formatDateBR(inferDateISO(record));
  if (els.labelCollectionFlow) els.labelCollectionFlow.textContent = inferFluxo(record);

  if (els.printLabelParticipantName) els.printLabelParticipantName.textContent = participant.name || "—";
  if (els.printLabelParticipantCode) els.printLabelParticipantCode.textContent = code || "—";
  if (els.printLabelCollectionDate) els.printLabelCollectionDate.textContent = formatDateBR(inferDateISO(record));
  if (els.printLabelCollectionFlow) els.printLabelCollectionFlow.textContent = inferFluxo(record);

  renderQrCodeInContainer("collectionLabelQr", qrUrl);
  renderQrCodeInContainer("printCollectionLabelQr", qrUrl);
}

function openCollectionLabelModal() {
  if (!els.collectionLabelModal) return;
  els.collectionLabelModal.classList.add("open");
  els.collectionLabelModal.setAttribute("aria-hidden", "false");
}

function closeCollectionLabelModal() {
  if (!els.collectionLabelModal) return;
  els.collectionLabelModal.classList.remove("open");
  els.collectionLabelModal.setAttribute("aria-hidden", "true");
}

function renderMainTable(items) {
  tableFilteredColetas = items;

  if (els.tableVisibleCount) els.tableVisibleCount.textContent = String(filteredColetas.length);
  if (els.tableFilteredCount) els.tableFilteredCount.textContent = String(items.length);
  if (els.tableLastUpdate) els.tableLastUpdate.textContent = formatDateTimeBR(new Date());

  if (!items.length) {
    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-table-state">
            <strong>Nenhum registro encontrado</strong>
            <span>Ajuste os filtros da tabela para visualizar os dados.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  els.tableColetasBody.innerHTML = items.map((item) => {
    const participant = resolveParticipant(item);
    const canceled = getStatus(item) === "cancelado";

    const reciclavel = isFinalTurno(item)
      ? MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0)
      : inferResiduoSeco(item);

    const naoReciclavel = inferRejeitoNaoReciclavel(item);
    const naoComercializavel = inferNaoComercializado(item);
    const rejeitoTotal = inferRejeitoTotal(item);

    const observacao = inferObservacao(item) || "Sem observação";
    const fracoes = materialFractionsText(item);
    const extras = extrasFractionsText(item);
    const fotosHtml = renderPhotoCell(item);

    return `
      <tr class="${canceled ? "row-muted" : ""}">
        <td>${formatDateBR(inferDateISO(item))}</td>

        <td>
          <div class="cell-main">
            <strong>${escapeHtml(participant.name)}</strong>
          </div>
        </td>

        <td>
          <span class="code-badge">${escapeHtml(participant.code || "—")}</span>
        </td>

        <td>${escapeHtml(inferEntrega(item))}</td>

        <td>${renderStatusBadge(item)}</td>

        <td>
          <details class="table-details compact-details">
            <summary>Ver mais dados</summary>
            <div class="details-block">
              <div><strong>Tipo de cadastro:</strong> ${escapeHtml(participant.type || participant.localType || "—")}</div>
              <div><strong>Fluxo:</strong> ${escapeHtml(inferFluxo(item))}</div>
              <div><strong>Endereço:</strong> ${escapeHtml(participant.address || "Endereço não informado")}</div>
              <div><strong>Reciclável:</strong> ${formatKg(reciclavel)}</div>
              <div><strong>Não reciclável:</strong> ${formatKg(naoReciclavel)}</div>
              <div><strong>Não comercializável:</strong> ${formatKg(naoComercializavel)}</div>
              <div><strong>Rejeito total:</strong> ${formatKg(rejeitoTotal)}</div>
              <div><strong>Qualidade:</strong> ${getQualidade(item) || "—"}</div>
              <div><strong>Observações:</strong> ${escapeHtml(observacao)}</div>
              <div><strong>Material por fração:</strong> ${escapeHtml(fracoes)}</div>
              <div><strong>Outras frações:</strong> ${escapeHtml(extras)}</div>
              <div><strong>Criado por:</strong> ${escapeHtml(item.createdByName || item.createdBy || "—")}</div>
              <div><strong>Fotos:</strong> ${fotosHtml}</div>
              <div><strong>Email:</strong> ${escapeHtml(participant.email || "—")}</div>
              <div><strong>Telefone:</strong> ${escapeHtml(participant.phone || "—")}</div>
              <div><strong>CPF:</strong> ${escapeHtml(participant.cpf || "—")}</div>
            </div>
          </details>
        </td>

        <td>
          <div class="table-actions table-actions-vertical">
            <button class="action-btn view" data-view="${item.id}">Visualizar</button>
            <button class="action-btn edit" data-edit="${item.id}" ${canceled ? "disabled" : ""}>Editar</button>
            <button class="action-btn cancel" data-cancel="${item.id}" ${canceled ? "disabled" : ""}>Excluir</button>
            <button class="action-btn label" data-label="${item.id}">Etiqueta</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openPhoto(url) {
  if (!url) return;
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

  els.editParticipantName.textContent = `${participant.name} • ${participant.code}`;
  els.editFluxo.value = inferFluxo(item) === "—" ? "recebimento" : inferFluxo(item);
  els.editEntrega.value = inferEntrega(item) === "—" ? "" : inferEntrega(item);
  els.editPesoBase.value = String(inferResiduoSeco(item) || "");
  els.editQualidade.value = getQualidade(item);
  els.editRejeito.value = String(inferRejeitoNaoReciclavel(item) || "");
  els.editNaoComercializado.value = String(inferNaoComercializado(item) || "");
  els.editObs.value = inferObservacao(item);

  els.editModal.classList.add("open");
  els.editModal.setAttribute("aria-hidden", "false");
}

async function saveEdit() {
  if (!activeEditId) return;

  const ref = doc(db, "coletas", activeEditId);
  const isEditFinalTurno = els.editFluxo.value === "final_turno";

  const payload = {
    flowType: els.editFluxo.value,
    deliveryType: els.editEntrega.value.trim(),
    observacao: els.editObs.value.trim(),
    updatedAt: serverTimestamp()
  };

  if (isEditFinalTurno) {
    payload["finalTurno.observacao"] = els.editObs.value.trim();
    payload["finalTurno.pesoResiduoSecoKg"] = Number(els.editPesoBase.value || 0);
    payload["finalTurno.qualidadeNota"] = els.editQualidade.value ? Number(els.editQualidade.value) : null;
    payload["finalTurno.pesoRejeitoKg"] = Number(els.editRejeito.value || 0);
    payload["finalTurno.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado.value || 0);
  } else {
    payload["recebimento.observacao"] = els.editObs.value.trim();
    payload["recebimento.pesoResiduoSecoKg"] = Number(els.editPesoBase.value || 0);
    payload["recebimento.qualidadeNota"] = els.editQualidade.value ? Number(els.editQualidade.value) : null;
    payload["recebimento.pesoRejeitoKg"] = Number(els.editRejeito.value || 0);
    payload["recebimento.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado.value || 0);
  }

  await updateDoc(ref, payload);
  closeModal("editModal");
  activeEditId = null;
}

async function cancelRegistro(itemId) {
  const ok = window.confirm("Deseja realmente excluir/cancelar este registro? Ele continuará no histórico, mas não contará nos indicadores ativos.");
  if (!ok) return;

  const ref = doc(db, "coletas", itemId);
  await updateDoc(ref, {
    status: "cancelado",
    canceledAt: serverTimestamp()
  });
}

function getSearchTarget(item, participant, searchType) {
  const familyCode = item.familyCode || item.recebimento?.familyCode || item.finalTurno?.familyCode || "";
  const rawMaterials = materialFractionsText(item);
  const rawExtras = extrasFractionsText(item);

  const targets = {
    participant: `${participant.name} ${item.participantName || ""} ${familyCode}`,
    code: `${participant.code} ${item.participantCode || ""} ${familyCode} ${item.condCode || ""}`,
    creator: `${item.createdByName || ""} ${item.createdByPublicCode || ""} ${item.createdBy || ""}`,
    obs: `${inferObservacao(item)}`,
    delivery: `${inferEntrega(item)}`,
    flow: `${inferFluxo(item)}`
  };

  if (searchType === "all") {
    return [
      participant.name,
      participant.code,
      participant.address,
      participant.email,
      participant.phone,
      participant.cpf,
      item.createdByName,
      item.createdByPublicCode,
      item.createdBy,
      inferEntrega(item),
      inferFluxo(item),
      inferObservacao(item),
      familyCode,
      item.participantCode || "",
      item.condCode || "",
      rawMaterials,
      rawExtras
    ].join(" ");
  }

  return targets[searchType] || "";
}

function applyFilters() {
  const codeFilter = normalizeCode(els.fParticipantCode?.value || "");
  const fluxo = els.fFluxo.value;
  const entrega = els.fEntrega.value;
  const ini = els.fIni.value;
  const fim = els.fFim.value;
  const busca = normalizeText(els.fBusca.value);
  const searchType = els.fSearchType?.value || "all";

  filteredColetas = allColetas.filter((item) => {
    const participant = resolveParticipant(item);
    const searchTarget = normalizeText(getSearchTarget(item, participant, searchType));
    const participantCode = normalizeCode(participant.code || item.participantCode || "");

    if (codeFilter && !participantCode.includes(codeFilter)) return false;
    if (fluxo !== "__all__" && inferFluxo(item) !== fluxo) return false;
    if (entrega !== "__all__" && inferEntrega(item) !== entrega) return false;
    if (!matchesDateRange(item, ini, fim)) return false;
    if (busca && !searchTarget.includes(busca)) return false;
    return true;
  });

  updateTopInfo();
  renderKpis(filteredColetas);
  renderExpandedPanel(filteredColetas);
  renderWeightTimeline(filteredColetas);
  renderCharts(filteredColetas);
  renderCollectionPoints(filteredColetas);

  const refined = applyTableFilters(filteredColetas);
  renderMainTable(refined);
}

function clearFilters() {
  if (els.fParticipantCode) els.fParticipantCode.value = "";
  els.fFluxo.value = "__all__";
  els.fEntrega.value = "__all__";
  els.fIni.value = "";
  els.fFim.value = "";
  els.fBusca.value = "";
  if (els.fSearchType) els.fSearchType.value = "all";
  renderQuickParticipantPreview();
  applyFilters();
}

function setDefaultDateRange(items) {
  if (els.fIni.value || els.fFim.value || !items.length) return;
  const dates = items.map((item) => inferDateISO(item)).filter(Boolean).sort();
  if (!dates.length) return;
  els.fIni.value = dates[0];
  els.fFim.value = dates[dates.length - 1];
}

function sortColetasLocally(items) {
  return items.sort((a, b) => {
    const aDate = String(inferDateTimeISO(a) || "");
    const bDate = String(inferDateTimeISO(b) || "");
    return bDate.localeCompare(aDate);
  });
}

function subscribeToQuery(qRef, useFallbackLabel = false) {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  activeUnsubscribe = onSnapshot(
    qRef,
    (snapshot) => {
      let loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (useFallbackLabel) {
        loaded = sortColetasLocally(loaded);
      }

      if (!["admin", "governanca", "gestor"].includes(coopProfile?.role)) {
        loaded = loaded.filter((item) => matchesProfileTerritory(item, coopProfile));
      }

      allColetas = loaded;
      populateFilters(allColetas);
      setDefaultDateRange(allColetas);
      renderQuickParticipantPreview();
      applyFilters();

      els.dbStatus.textContent = useFallbackLabel ? "conectado (modo provisório)" : "conectado";
    },
    async (error) => {
      console.error("Erro ao carregar coletas:", error);

      const msg = String(error?.message || "").toLowerCase();
      const aliases = buildTerritoryAliases(coopProfile).slice(0, 10);

      if (!useFallbackLabel && aliases.length > 1) {
        try {
          const fallbackQuery = query(collection(db, "coletas"), where("territoryId", "==", aliases[0]));
          subscribeToQuery(fallbackQuery, true);
          return;
        } catch {}
      }

      if (!useFallbackLabel && msg.includes("index")) {
        try {
          const fallbackQuery =
            ["admin", "governanca", "gestor"].includes(coopProfile?.role)
              ? query(collection(db, "coletas"))
              : query(collection(db, "coletas"), where("territoryId", "==", coopProfile.territoryId));
          subscribeToQuery(fallbackQuery, true);
          return;
        } catch {}
      }

      els.dbStatus.textContent = "erro";
      alert("Não foi possível carregar os dados do dashboard.");
    }
  );
}

function listenColetas(profile) {
  els.dbStatus.textContent = "conectando…";

  if (["admin", "governanca", "gestor"].includes(profile.role)) {
    subscribeToQuery(query(collection(db, "coletas"), orderBy("createdAt", "desc")), false);
    return;
  }

  const aliases = buildTerritoryAliases(profile).slice(0, 10);

  if (aliases.length > 1) {
    try {
      subscribeToQuery(
        query(collection(db, "coletas"), where("territoryId", "in", aliases), orderBy("createdAt", "desc")),
        false
      );
      return;
    } catch {}
  }

  subscribeToQuery(
    query(collection(db, "coletas"), where("territoryId", "==", profile.territoryId), orderBy("createdAt", "desc")),
    false
  );
}

function getTableStatusView(item) {
  const status = getStatus(item);
  if (status === "cancelado") return "cancelado";
  if (item.updatedAt) return "editado";
  return "ativo";
}

function applyTableFilters(baseItems) {
  const tSearch = normalizeText(els.tSearch?.value || "");
  const tFluxo = els.tFluxo?.value || "__all__";
  const tEntrega = els.tEntrega?.value || "__all__";
  const tStatus = els.tStatus?.value || "__all__";
  const tTipoCadastro = normalizeText(els.tTipoCadastro?.value || "__all__");

  return baseItems.filter((item) => {
    const participant = resolveParticipant(item);
    const fluxo = inferFluxo(item);
    const entrega = inferEntrega(item);
    const statusView = getTableStatusView(item);
    const tipo = normalizeText(participant.type || participant.localType || "");

    const haystack = normalizeText([
      participant.name,
      participant.code,
      participant.address,
      inferObservacao(item),
      materialFractionsText(item),
      extrasFractionsText(item),
      item.createdByName,
      item.createdBy
    ].join(" "));

    if (tSearch && !haystack.includes(tSearch)) return false;
    if (tFluxo !== "__all__" && fluxo !== tFluxo) return false;
    if (tEntrega !== "__all__" && entrega !== tEntrega) return false;
    if (tStatus !== "__all__" && statusView !== tStatus) return false;
    if (tTipoCadastro !== "__all__" && tipo !== tTipoCadastro) return false;

    return true;
  });
}

function bindTableFilters() {
  els.btnApplyTableFilters?.addEventListener("click", () => {
    const refined = applyTableFilters(filteredColetas);
    renderMainTable(refined);
  });

  els.btnClearTableFilters?.addEventListener("click", () => {
    if (els.tSearch) els.tSearch.value = "";
    if (els.tFluxo) els.tFluxo.value = "__all__";
    if (els.tEntrega) els.tEntrega.value = "__all__";
    if (els.tStatus) els.tStatus.value = "__all__";
    if (els.tTipoCadastro) els.tTipoCadastro.value = "__all__";
    renderMainTable(filteredColetas);
  });

  ["tSearch", "tFluxo", "tEntrega", "tStatus", "tTipoCadastro"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
      const refined = applyTableFilters(filteredColetas);
      renderMainTable(refined);
    });
    el?.addEventListener("change", () => {
      const refined = applyTableFilters(filteredColetas);
      renderMainTable(refined);
    });
  });
}

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

function applyParticipantCodeFromUrl() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("participantCode");
  if (code && els.fParticipantCode) {
    els.fParticipantCode.value = normalizeCode(code);
  }
}

function bindUI() {
  els.btnAplicar?.addEventListener("click", applyFilters);
  els.btnLimpar?.addEventListener("click", clearFilters);
  els.btnPrint?.addEventListener("click", () => window.print());
  els.btnSaveEdit?.addEventListener("click", saveEdit);

  [els.chartMainType, els.chartFlowType, els.chartDeliveryType, els.chartTerritoryType].forEach((el) => {
    el?.addEventListener("change", () => renderCharts(filteredColetas));
  });

  [els.fFluxo, els.fEntrega, els.fIni, els.fFim, els.fSearchType].forEach((el) => {
    el?.addEventListener("change", applyFilters);
  });

  els.fParticipantCode?.addEventListener("input", () => {
    renderQuickParticipantPreview();
    applyFilters();
  });

  els.fBusca?.addEventListener("input", applyFilters);

  els.btnGenerateCollectionLabel?.addEventListener("click", () => {
    if (!selectedCollectionLabelRecord && tableFilteredColetas.length) {
      selectedCollectionLabelRecord = tableFilteredColetas[0];
    }

    if (!selectedCollectionLabelRecord) {
      alert("Selecione um registro da tabela para gerar a etiqueta.");
      return;
    }

    fillCollectionLabel(selectedCollectionLabelRecord);
  });

  els.btnPrintCollectionLabel?.addEventListener("click", () => {
    if (!selectedCollectionLabelRecord) {
      alert("Selecione ou gere uma etiqueta primeiro.");
      return;
    }

    fillCollectionLabel(selectedCollectionLabelRecord);
    openCollectionLabelModal();
    setTimeout(() => window.print(), 150);
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

    const viewBtn = event.target.closest("[data-view]");
    if (viewBtn) {
      const row = viewBtn.closest("tr");
      const details = row?.querySelector("details");
      if (details) details.open = !details.open;
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
        alert("Não foi possível excluir/cancelar o registro.");
      }
      return;
    }

    const labelBtn = event.target.closest("[data-label]");
    if (labelBtn) {
      const record = allColetas.find((x) => x.id === labelBtn.dataset.label);
      if (record) {
        selectedCollectionLabelRecord = record;
        fillCollectionLabel(record);
      }
      return;
    }

    const closer = event.target.closest("[data-close]");
    if (closer) {
      closeModal(closer.dataset.close);
      if (closer.dataset.close === "collectionLabelModal") {
        closeCollectionLabelModal();
      }
    }
  });
}

async function boot() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initCursorGlow();
  bindUI();
  bindTableFilters();
  applyParticipantCodeFromUrl();

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

      try {
        await loadParticipantsMap(profile.territoryId);
      } catch (e) {
        console.warn("Participantes não puderam ser carregados:", e);
      }

      listenColetas(profile);
    } catch (error) {
      console.error("Erro ao iniciar dashboard:", error);
      alert(error.message || "Não foi possível carregar o dashboard.");
      window.location.href = "login.html";
    }
  });
}

boot();