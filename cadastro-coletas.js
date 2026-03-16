// /js/cadastro-coletas.js
import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, updateDoc,
  addDoc, collection, serverTimestamp,
  query, where, getDocs, limit
} from "firebase/firestore";

const $ = (id) => document.getElementById(id);

const STATE = {
  user: null,
  userDoc: null,
  territoryId: null,
  territoryLabel: null,
  territoryColor: null,
  role: null,
  publicCode: null,
  selectedParticipant: null,
};

function show(el, yes) { el?.classList.toggle("hidden", !yes); }
function setText(id, value) { const el = $(id); if (el) el.textContent = value ?? "—"; }

function setMsg(el, kind, text) {
  if (!el) return;
  el.classList.remove("hidden", "ok", "warn", "bad");
  el.classList.add(kind);
  el.textContent = text;
}
function hideMsg(el) { el?.classList.add("hidden"); }

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function cleanCEP(v) { return (v || "").replace(/\D/g, ""); }
function cleanPhone(v) { return (v || "").replace(/\D/g, ""); }

function genUserPublicCode(uid) {
  const base = (uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const pad = base.padStart(6, "0");
  return `RB-${pad}`;
}

async function loadUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

async function ensureUserPublicCode(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const ud = snap.data();
  if (ud.publicCode) return ud.publicCode;

  const code = genUserPublicCode(uid);
  try {
    await updateDoc(ref, { publicCode: code, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn("[ensureUserPublicCode] sem permissão para update:", e?.message || e);
  }
  return code;
}

async function loadTerritoryMeta(territoryId) {
  try {
    const tref = doc(db, "territories", territoryId);
    const tsnap = await getDoc(tref);
    if (!tsnap.exists()) return null;
    const t = tsnap.data();
    return {
      label: t.label || t.name || territoryId,
      color: t.colorHex || t.color || null,
    };
  } catch {
    return null;
  }
}

/** ===== PERMISSÕES ===== */
function canAccessColetas(userDoc) {
  const role = userDoc?.role || null;
  const perms = userDoc?.permissions || {};
  const okByPerm = perms?.coletas === true;
  const okByRole = ["cooperativa", "gestor", "governanca", "admin"].includes(role);
  return okByPerm || okByRole;
}

/** ===== MODAL ===== */
function openModal() {
  show($("modalChoice"), true);
  $("modalChoice")?.setAttribute("aria-hidden", "false");
}
function closeModal() {
  show($("modalChoice"), false);
  $("modalChoice")?.setAttribute("aria-hidden", "true");
}

/** ===== CEP + ENDEREÇO ===== */
async function fetchCEP(cepRaw) {
  const cep = cleanCEP(cepRaw);
  if (cep.length !== 8) throw new Error("CEP inválido");
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado");
  return data;
}

function buildAddress() {
  const rua = ($("p_rua")?.value || "").trim();
  const num = ($("p_numero")?.value || "").trim();
  const bairro = ($("p_bairro")?.value || "").trim();
  const cidade = ($("p_cidade")?.value || "").trim();
  const uf = ($("p_uf")?.value || "").trim();
  const cep = ($("p_cep")?.value || "").trim();

  const full = [rua, num ? `nº ${num}` : "", bairro, `${cidade}/${uf}`, cep]
    .filter(Boolean)
    .join(" • ");

  if ($("p_address")) $("p_address").value = full;

  return {
    cep: cleanCEP(cep),
    rua,
    numero: num,
    bairro,
    cidade,
    uf,
    full,
    complemento: ($("p_comp")?.value || "").trim(),
  };
}

// opcional: geocode
async function geocodeAddressNominatim(addressFull) {
  const q = encodeURIComponent(addressFull);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;
  const item = data[0];
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, provider: "nominatim" };
}

/** ===== PARTICIPANTES ===== */
async function findParticipantByCode(codeRaw) {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code) return null;

  const qy = query(
    collection(db, "participants"),
    where("territoryId", "==", STATE.territoryId),
    where("code", "==", code),
    limit(1)
  );

  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function genNewParticipantCode() {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const tail = (STATE.user?.uid || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase()
    .padStart(4, "0");
  return `RB-${y}${m}${day}-${tail}`;
}

function clearParticipantForm() {
  [
    "p_name","p_phone","p_local","p_cep","p_rua","p_numero","p_comp",
    "p_bairro","p_cidade","p_uf","p_address"
  ].forEach(id => { const el = $(id); if (el) el.value = ""; });
}

async function createParticipantFromForm() {
  const name = ($("p_name")?.value || "").trim();
  const phone = cleanPhone($("p_phone")?.value || "");
  const local = ($("p_local")?.value || "").trim();
  const addr = buildAddress();

  if (!name) throw new Error("Informe o nome do participante.");
  if (!addr.cep || addr.cep.length !== 8) throw new Error("Informe um CEP válido.");
  if (!addr.numero) throw new Error("Informe o número.");
  if (!addr.rua) throw new Error("Busque o CEP para preencher o logradouro.");

  const code = ($("p_code")?.value || "").trim() || await genNewParticipantCode();

  const createdByName =
    STATE.user.displayName ||
    STATE.userDoc?.name ||
    STATE.user.email ||
    "Usuário";

  const payload = {
    code,
    name,
    phoneDigits: phone || null,
    pickupLocal: local || null,

    territoryId: STATE.territoryId,
    territoryLabel: STATE.territoryLabel,
    territoryColor: STATE.territoryColor || null,

    address: addr,
    geo: null,

    createdBy: STATE.user.uid,
    createdByName,
    createdByPublicCode: STATE.publicCode || null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    userType: "participant"
  };

  try {
    const geo = await geocodeAddressNominatim(addr.full);
    if (geo) payload.geo = geo;
  } catch {}

  const ref = await addDoc(collection(db, "participants"), payload);
  return { id: ref.id, ...payload };
}

/** ===== COLETAS ===== */
function parseNum(v) {
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function saveColeta() {
  if (!STATE.selectedParticipant) throw new Error("Selecione um participante.");

  const opDate = ($("c_opDate")?.value || "").trim();
  const flowType = ($("c_flowType")?.value || "").trim();
  const deliveryType = ($("c_deliveryType")?.value || "").trim();
  const observacao = ($("c_observacao")?.value || "").trim();

  if (!opDate) throw new Error("Informe a data da operação.");
  if (!flowType) throw new Error("Selecione o tipo de fluxo.");

  const createdByName =
    STATE.user.displayName ||
    STATE.userDoc?.name ||
    STATE.user.email ||
    "Usuário";

  const base = {
    territoryId: STATE.territoryId,
    territoryLabel: STATE.territoryLabel,
    territoryColor: STATE.territoryColor || null,

    participantId: STATE.selectedParticipant.id,
    participantCode: STATE.selectedParticipant.code || null,
    participantName: STATE.selectedParticipant.name || null,

    createdBy: STATE.user.uid,
    createdByName,
    createdByPublicCode: STATE.publicCode || null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    opDate,
    flowType,
    deliveryType: deliveryType || null,
    observacao: observacao || null,
  };

  const recebimento = {
    pesoResiduoSecoKg: parseNum($("c_pesoResiduoSecoKg")?.value),
    pesoRejeitoKg: parseNum($("c_pesoRejeitoKg")?.value),
    pesoNaoComercializadoKg: parseNum($("c_pesoNaoComercializadoKg")?.value),
    qualidadeNota: parseNum($("c_qualidadeNota")?.value),
  };

  const finalTurno = {
    plasticoKg: parseNum($("c_plasticoKg")?.value),
    papelMistoKg: parseNum($("c_papelMistoKg")?.value),
    papelaoKg: parseNum($("c_papelaoKg")?.value),
    aluminioMetalKg: parseNum($("c_aluminioMetalKg")?.value),
    vidroKg: parseNum($("c_vidroKg")?.value),
    sacariaKg: parseNum($("c_sacariaKg")?.value),
    isoporKg: parseNum($("c_isoporKg")?.value),
    oleoKg: parseNum($("c_oleoKg")?.value),
    pesoRejeitoGeralKg: parseNum($("c_pesoRejeitoGeralKg")?.value),
  };

  let details = {};
  if (flowType === "recebimento") details = { recebimento };
  if (flowType === "final_turno") details = { finalTurno };

  const payload = { ...base, ...details };

  await addDoc(collection(db, "coletas"), payload);
  return payload;
}

/** ===== UI / SELEÇÃO ===== */
function setSelectedParticipant(p) {
  STATE.selectedParticipant = p || null;

  if (!p) {
    setText("selectedParticipantLabel", "—");
    show($("boxColeta"), false);
    return;
  }

  setText("selectedParticipantLabel", `${p.code || "—"} • ${p.name || "Participante"}`);

  show($("boxColeta"), true);
  show($("boxJaTenho"), false);
  show($("boxSouNovo"), false);

  setText("pageHint", "Participante selecionado ✅");
}

function wireModal() {
  $("btnAbrirModal")?.addEventListener("click", openModal);
  $("btnFecharModal")?.addEventListener("click", closeModal);
  document.querySelector("#modalChoice .modal-backdrop")?.addEventListener("click", closeModal);

  $("btnJaTenho")?.addEventListener("click", () => {
    closeModal();
    show($("boxJaTenho"), true);
    show($("boxSouNovo"), false);
    show($("boxColeta"), false);
    hideMsg($("msgExisting"));
    setText("pageHint", "Buscar participante pelo código");
  });

  $("btnSouNovo")?.addEventListener("click", async () => {
    closeModal();
    show($("boxSouNovo"), true);
    show($("boxJaTenho"), false);
    show($("boxColeta"), false);
    hideMsg($("msgParticipant"));
    clearParticipantForm();

    const code = await genNewParticipantCode();
    if ($("p_code")) $("p_code").value = code;

    setText("pageHint", "Cadastrar novo participante");
  });

  $("btnTrocarParticipante")?.addEventListener("click", () => {
    setSelectedParticipant(null);
    openModal();
  });
}

function wireCEPButton() {
  $("btnCep")?.addEventListener("click", async () => {
    const msg = $("msgParticipant");
    hideMsg(msg);

    try {
      const data = await fetchCEP($("p_cep")?.value || "");
      $("p_rua").value = data.logradouro || "";
      $("p_bairro").value = data.bairro || "";
      $("p_cidade").value = data.localidade || "";
      $("p_uf").value = data.uf || "";
      buildAddress();
      setMsg(msg, "ok", "CEP encontrado ✓");
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", "Erro ao buscar CEP. Abra via Live Server/HTTP (não use file://).");
    }
  });

  ["p_rua","p_numero","p_bairro","p_cidade","p_uf","p_cep","p_comp"].forEach(id => {
    $(id)?.addEventListener("input", buildAddress);
  });
}

function wireBuscarExistente() {
  $("btnBuscarParticipant")?.addEventListener("click", async () => {
    const msg = $("msgExisting");
    hideMsg(msg);

    try {
      const code = ($("ex_code")?.value || "").trim().toUpperCase();
      if (!code) return setMsg(msg, "warn", "Digite o código do participante.");

      const p = await findParticipantByCode(code);
      if (!p) return setMsg(msg, "bad", "Código não encontrado no seu território.");

      setSelectedParticipant(p);
      setMsg(msg, "ok", "Cadastro carregado ✓");
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", "Falha ao buscar cadastro.");
    }
  });
}

function wireCadastrarParticipante() {
  $("formParticipant")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msgParticipant");
    hideMsg(msg);

    try {
      setMsg(msg, "warn", "Salvando participante…");
      const p = await createParticipantFromForm();
      setMsg(msg, "ok", "Participante cadastrado ✓");
      setSelectedParticipant(p);
      show($("boxSouNovo"), false);
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", e.message || "Erro ao cadastrar participante.");
    }
  });
}

function wireSalvarColeta() {
  $("formColeta")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msgColeta");
    hideMsg(msg);

    try {
      setMsg(msg, "warn", "Salvando coleta…");
      await saveColeta();
      setMsg(msg, "ok", "Coleta salva ✓");

      [
        "c_deliveryType","c_observacao",
        "c_pesoResiduoSecoKg","c_pesoRejeitoKg","c_pesoNaoComercializadoKg","c_qualidadeNota",
        "c_plasticoKg","c_papelMistoKg","c_papelaoKg","c_aluminioMetalKg",
        "c_vidroKg","c_sacariaKg","c_isoporKg","c_oleoKg","c_pesoRejeitoGeralKg"
      ].forEach(id => { const el = $(id); if (el) el.value = ""; });

      if ($("c_opDate")) $("c_opDate").value = toISODate(new Date());
      if ($("c_flowType")) $("c_flowType").value = "";
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", e.message || "Erro ao salvar coleta.");
    }
  });
}

/** ===== BOOTSTRAP ===== */
async function bootstrapAfterAuth(user) {
  STATE.user = user;
  setText("authStatus", "logado ✓");

  const ud = await loadUserDoc(user.uid);
  STATE.userDoc = ud;

  if (!ud) {
    alert("Seu usuário não está cadastrado na base (users).");
    window.location.href = "/index.html";
    return;
  }

  // 🔒 onboarding obrigatório (endereço + território + questionário)
  if (!ud.onboardingCompleted) {
    // ajuste para tua página real de onboarding
    window.location.href = "cadastro-usuario.html";
    return;
  }

  // 🔒 permissão
  if (!canAccessColetas(ud)) {
    alert("Sem permissão para acessar Cadastro de Coletas.");
    window.location.href = "index.html";
    return;
  }

  STATE.territoryId = ud.territoryId || null;
  STATE.territoryLabel = ud.territoryLabel || "—";
  STATE.role = ud.role || null;

  const tmeta = STATE.territoryId ? await loadTerritoryMeta(STATE.territoryId) : null;
  STATE.territoryLabel = tmeta?.label || STATE.territoryLabel;
  STATE.territoryColor = tmeta?.color || ud.territoryColor || null;

  STATE.publicCode = await ensureUserPublicCode(user.uid);

  // UI topo
  setText("territoryStatus", STATE.territoryLabel || "—");
  setText("pageHint", "Selecione um participante para registrar");

  const displayName = user.displayName || ud.name || user.email || "Usuário";
  setText("userDisplayName", displayName);
  setText("userPublicCode", STATE.publicCode || "—");

  if ($("c_opDate")) $("c_opDate").value = toISODate(new Date());

  setSelectedParticipant(null);
  show($("boxJaTenho"), false);
  show($("boxSouNovo"), false);
  show($("boxColeta"), false);
}

function init() {
  wireModal();
  wireCEPButton();
  wireBuscarExistente();
  wireCadastrarParticipante();
  wireSalvarColeta();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        setText("authStatus", "deslogado");
        setText("pageHint", "Aguardando login…");
        window.location.href = "index.html";
        return;
      }
      await bootstrapAfterAuth(user);
    } catch (e) {
      console.error(e);
      alert("Erro ao iniciar cadastro de coletas. Verifique CSP/Console.");
    }
  });
}

init();