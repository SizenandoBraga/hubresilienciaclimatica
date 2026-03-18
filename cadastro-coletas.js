import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
  selectedDelivery: null,
  selectedFlow: null
};

function show(el, yes) {
  el?.classList.toggle("hidden", !yes);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}

function setMsg(el, kind, text) {
  if (!el) return;
  el.classList.remove("hidden", "ok", "warn", "bad");
  el.classList.add(kind);
  el.textContent = text;
}

function hideMsg(el) {
  el?.classList.add("hidden");
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cleanCEP(v) {
  return (v || "").replace(/\D/g, "");
}

function cleanPhone(v) {
  return (v || "").replace(/\D/g, "");
}

function parseNum(v) {
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function genUserPublicCode(uid) {
  const base = (uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  const pad = base.padStart(6, "0");
  return `RB-${pad}`;
}

function genLocalParticipantCode(uid) {
  const d = new Date();
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const tail = (uid || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-4)
    .toUpperCase()
    .padStart(4, "0");

  return `RB-${y}${m}${day}-${tail}`;
}

function canAccessColetas(userDoc) {
  const role = userDoc?.role || null;
  const perms = userDoc?.permissions || {};
  const okByPerm = perms?.coletas === true;
  const okByRole = ["cooperativa", "gestor", "governanca", "admin"].includes(role);
  return okByPerm || okByRole;
}

function roleDispensaOnboarding(role) {
  return ["cooperativa", "gestor", "governanca", "admin"].includes(role || "");
}

async function loadUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

async function loadTerritoryMeta(territoryId) {
  try {
    const ref = doc(db, "territories", territoryId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const t = snap.data();
    return {
      label: t.label || t.name || territoryId,
      color: t.colorHex || t.color || null
    };
  } catch {
    return null;
  }
}

async function ensureUserPublicCode(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const ud = snap.data();
  if (ud.publicCode) return ud.publicCode;

  const code = genUserPublicCode(uid);

  try {
    await updateDoc(ref, {
      publicCode: code,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("[ensureUserPublicCode] sem permissão para update:", e?.message || e);
  }

  return code;
}

async function fetchCEP(cepRaw) {
  const cep = cleanCEP(cepRaw);
  if (cep.length !== 8) throw new Error("CEP inválido");

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!res.ok) throw new Error("Falha na consulta do CEP");

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
    complemento: ($("p_comp")?.value || "").trim()
  };
}

async function geocodeAddressNominatim(addressFull) {
  const q = encodeURIComponent(addressFull);
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;

  const item = data[0];
  const lat = Number(item.lat);
  const lng = Number(item.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, provider: "nominatim" };
}

async function findParticipantByCode(codeRaw) {
  const code = (codeRaw || "").trim().toUpperCase();
  if (!code || !STATE.territoryId) return null;

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

function setSelectedParticipant(p) {
  STATE.selectedParticipant = p || null;

  if (!p) {
    setText("selectedParticipantLabel", "—");
    show($("btnTrocarParticipante"), false);
    return;
  }

  setText("selectedParticipantLabel", `${p.code || "—"} • ${p.name || "Participante"}`);
  show($("btnTrocarParticipante"), true);
}

function resetOperacaoForms() {
  $("formOperacao")?.reset();
  $("deliveryType").value = "";
  $("flowType").value = "";
  STATE.selectedDelivery = null;
  STATE.selectedFlow = null;
  document.querySelectorAll("[data-delivery].active").forEach(el => el.classList.remove("active"));
  document.querySelectorAll("[data-flow].active").forEach(el => el.classList.remove("active"));
  setText("flowStatus", "não selecionado");
  show($("panelRecebimento"), false);
  show($("panelFinalTurno"), false);
}

function resetParticipantForm() {
  [
    "p_name", "p_phone", "p_local", "p_code", "p_cep", "p_rua", "p_numero",
    "p_comp", "p_bairro", "p_cidade", "p_uf", "p_address"
  ].forEach((id) => {
    const el = $(id);
    if (el) el.value = "";
  });
}

function resetRecebimentoForm() {
  $("formRecebimento")?.reset();
  $("qualidadeNota").value = "";
  document.querySelectorAll(".quality-btn.active").forEach(el => el.classList.remove("active"));
}

function resetFinalTurnoForm() {
  $("formFinalTurno")?.reset();
  const wrap = $("extrasWrap");
  if (wrap) {
    wrap.innerHTML = `
      <div class="extra-row">
        <input type="text" class="extra-name" placeholder="Nome do material">
        <input type="number" step="0.01" class="extra-weight" placeholder="kg">
      </div>
    `;
  }
}

function collectExtras() {
  const rows = Array.from(document.querySelectorAll("#extrasWrap .extra-row"));
  return rows
    .map((row) => {
      const name = row.querySelector(".extra-name")?.value?.trim() || "";
      const weight = parseNum(row.querySelector(".extra-weight")?.value);
      if (!name && weight == null) return null;
      return { name: name || null, weightKg: weight };
    })
    .filter(Boolean);
}

function hardenInputsAgainstAutofill() {
  const ids = [
    "participantCode",
    "opDate", "deliveryType", "flowType", "opNotes",
    "familyCode", "pesoResiduoSecoKg", "qualidadeNota", "recebimentoObs",
    "pesoRejeitoKg", "pesoNaoComercializadoKg",
    "condCode", "pesoRejeitoGeralKg", "plasticoKg", "papelMistoKg", "papelaoKg",
    "aluminioMetalKg", "vidroKg", "sacariaKg", "isoporKg", "oleoKg",
    "p_name", "p_phone", "p_local", "p_code", "p_cep", "p_rua", "p_numero",
    "p_comp", "p_bairro", "p_cidade", "p_uf", "p_address"
  ];

  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.setAttribute("data-lpignore", "true");
    el.setAttribute("data-1p-ignore", "true");
    el.setAttribute("spellcheck", "false");
    if (!el.getAttribute("autocomplete")) {
      el.setAttribute("autocomplete", "off");
    }
  });

  document.querySelectorAll("form").forEach((form) => {
    form.setAttribute("autocomplete", "off");
    form.setAttribute("data-lpignore", "true");
    form.setAttribute("data-1p-ignore", "true");
    form.setAttribute("novalidate", "novalidate");
  });
}

async function createParticipantFromForm() {
  const name = ($("p_name")?.value || "").trim();
  const phone = cleanPhone($("p_phone")?.value || "");
  const local = ($("p_local")?.value || "").trim();
  const addr = buildAddress();

  if (!STATE.user) throw new Error("Usuário não autenticado.");
  if (!STATE.territoryId) throw new Error("Território do usuário não identificado.");
  if (!name) throw new Error("Informe o nome do participante.");
  if (!addr.cep || addr.cep.length !== 8) throw new Error("Informe um CEP válido.");
  if (!addr.numero) throw new Error("Informe o número.");
  if (!addr.rua) throw new Error("Busque o CEP para preencher o logradouro.");

  const code = ($("p_code")?.value || "").trim() || genLocalParticipantCode(STATE.user.uid);

  const createdByName =
    STATE.user?.displayName ||
    STATE.userDoc?.name ||
    STATE.user?.email ||
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
  } catch (e) {
    console.warn("[geocode] não foi possível geocodificar:", e?.message || e);
  }

  const ref = await addDoc(collection(db, "participants"), payload);
  return { id: ref.id, ...payload };
}

async function saveRecebimento() {
  if (!STATE.user) throw new Error("Usuário não autenticado.");
  if (!STATE.territoryId) throw new Error("Território não definido.");
  if (!STATE.selectedFlow || STATE.selectedFlow !== "recebimento") {
    throw new Error("Selecione o fluxo de recebimento.");
  }

  const opDate = ($("opDate")?.value || "").trim();
  const participantCodeInput = ($("participantCode")?.value || "").trim().toUpperCase();
  const deliveryType = ($("deliveryType")?.value || "").trim();
  const observacaoOperacao = ($("opNotes")?.value || "").trim();

  if (!opDate) throw new Error("Informe a data da operação.");
  if (!deliveryType) throw new Error("Selecione o tipo de entrega.");

  const qualidadeNota = parseNum($("qualidadeNota")?.value);
  if (qualidadeNota == null) throw new Error("Selecione a nota de qualidade.");

  const createdByName =
    STATE.user?.displayName ||
    STATE.userDoc?.name ||
    STATE.user?.email ||
    "Usuário";

  const payload = {
    territoryId: STATE.territoryId,
    territoryLabel: STATE.territoryLabel,
    territoryColor: STATE.territoryColor || null,

    participantId: STATE.selectedParticipant?.id || null,
    participantCode: STATE.selectedParticipant?.code || participantCodeInput || null,
    participantName: STATE.selectedParticipant?.name || null,

    createdBy: STATE.user.uid,
    createdByName,
    createdByPublicCode: STATE.publicCode || null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    opDate,
    flowType: "recebimento",
    deliveryType,
    observacao: observacaoOperacao || null,

    recebimento: {
      familyCode: ($("familyCode")?.value || "").trim() || null,
      pesoResiduoSecoKg: parseNum($("pesoResiduoSecoKg")?.value),
      pesoRejeitoKg: parseNum($("pesoRejeitoKg")?.value),
      pesoNaoComercializadoKg: parseNum($("pesoNaoComercializadoKg")?.value),
      qualidadeNota,
      observacao: ($("recebimentoObs")?.value || "").trim() || null,
      fotosResiduoQtd: $("fotoResiduo")?.files?.length || 0,
      fotosNaoComercializadoQtd: $("fotoNaoComercializado")?.files?.length || 0
    }
  };

  await addDoc(collection(db, "coletas"), payload);
  return payload;
}

async function saveFinalTurno() {
  if (!STATE.user) throw new Error("Usuário não autenticado.");
  if (!STATE.territoryId) throw new Error("Território não definido.");
  if (!STATE.selectedFlow || STATE.selectedFlow !== "final_turno") {
    throw new Error("Selecione o fluxo de registro final do turno.");
  }

  const opDate = ($("opDate")?.value || "").trim();
  const participantCodeInput = ($("participantCode")?.value || "").trim().toUpperCase();
  const deliveryType = ($("deliveryType")?.value || "").trim();
  const observacaoOperacao = ($("opNotes")?.value || "").trim();

  if (!opDate) throw new Error("Informe a data da operação.");
  if (!deliveryType) throw new Error("Selecione o tipo de entrega.");

  const createdByName =
    STATE.user?.displayName ||
    STATE.userDoc?.name ||
    STATE.user?.email ||
    "Usuário";

  const payload = {
    territoryId: STATE.territoryId,
    territoryLabel: STATE.territoryLabel,
    territoryColor: STATE.territoryColor || null,

    participantId: STATE.selectedParticipant?.id || null,
    participantCode: STATE.selectedParticipant?.code || participantCodeInput || null,
    participantName: STATE.selectedParticipant?.name || null,

    createdBy: STATE.user.uid,
    createdByName,
    createdByPublicCode: STATE.publicCode || null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    opDate,
    flowType: "final_turno",
    deliveryType,
    observacao: observacaoOperacao || null,

    finalTurno: {
      condCode: ($("condCode")?.value || "").trim() || null,
      pesoRejeitoGeralKg: parseNum($("pesoRejeitoGeralKg")?.value),
      plasticoKg: parseNum($("plasticoKg")?.value),
      papelMistoKg: parseNum($("papelMistoKg")?.value),
      papelaoKg: parseNum($("papelaoKg")?.value),
      aluminioMetalKg: parseNum($("aluminioMetalKg")?.value),
      vidroKg: parseNum($("vidroKg")?.value),
      sacariaKg: parseNum($("sacariaKg")?.value),
      isoporKg: parseNum($("isoporKg")?.value),
      oleoKg: parseNum($("oleoKg")?.value),
      extras: collectExtras(),
      fotosFinalTurnoQtd: $("fotoFinalTurno")?.files?.length || 0
    }
  };

  await addDoc(collection(db, "coletas"), payload);
  return payload;
}

function wireChoiceCards() {
  document.querySelectorAll("[data-delivery]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-delivery]").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      const value = btn.getAttribute("data-delivery");
      STATE.selectedDelivery = value;
      $("deliveryType").value = value || "";
    });
  });

  document.querySelectorAll("[data-flow]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-flow]").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");

      const value = btn.getAttribute("data-flow");
      STATE.selectedFlow = value;
      $("flowType").value = value || "";
      setText("flowStatus", value === "recebimento" ? "recebimento" : "registro final do turno");

      show($("panelRecebimento"), value === "recebimento");
      show($("panelFinalTurno"), value === "final_turno");
    });
  });

  document.querySelectorAll(".quality-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".quality-btn").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      $("qualidadeNota").value = btn.getAttribute("data-quality") || "";
    });
  });
}

function wireExtras() {
  $("btnAddExtra")?.addEventListener("click", () => {
    const wrap = $("extrasWrap");
    if (!wrap) return;

    const row = document.createElement("div");
    row.className = "extra-row";
    row.innerHTML = `
      <input type="text" class="extra-name" placeholder="Nome do material">
      <input type="number" step="0.01" class="extra-weight" placeholder="kg">
    `;
    wrap.appendChild(row);
  });
}

function wireParticipantActions() {
  $("btnPreviewOperacao")?.addEventListener("click", async () => {
    const msg = $("msgOperacao");
    hideMsg(msg);

    try {
      const participantCode = ($("participantCode")?.value || "").trim().toUpperCase();

      if (!participantCode) {
        setSelectedParticipant(null);
        return setMsg(msg, "warn", "Nenhum código informado. Você pode seguir sem participante vinculado ou cadastrar um novo.");
      }

      const p = await findParticipantByCode(participantCode);
      if (!p) {
        setSelectedParticipant(null);
        return setMsg(msg, "warn", "Código não encontrado no território atual. Você pode cadastrar um novo participante.");
      }

      setSelectedParticipant(p);
      setMsg(msg, "ok", "Participante localizado e vinculado à operação.");
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", "Falha ao localizar participante.");
    }
  });

  $("btnAbrirModal")?.addEventListener("click", openModal);
  $("btnFecharModal")?.addEventListener("click", closeModal);
  document.querySelector("#modalChoice .modal-backdrop")?.addEventListener("click", closeModal);

  $("btnJaTenho")?.addEventListener("click", async () => {
    closeModal();
    const msg = $("msgOperacao");
    hideMsg(msg);

    try {
      const code = prompt("Digite o código do participante:");
      if (!code) return;

      const p = await findParticipantByCode(code);
      if (!p) {
        return setMsg(msg, "bad", "Código não encontrado no seu território.");
      }

      $("participantCode").value = p.code || "";
      setSelectedParticipant(p);
      setMsg(msg, "ok", "Participante carregado com sucesso.");
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", "Falha ao buscar participante.");
    }
  });

  $("btnSouNovo")?.addEventListener("click", async () => {
    closeModal();
    resetParticipantForm();

    const code = genLocalParticipantCode(STATE.user?.uid || "");
    $("p_code").value = code;

    const name = prompt("Nome do novo participante:");
    if (!name) return;

    $("p_name").value = name;
    const phone = prompt("Telefone/WhatsApp do participante:");
    if (phone) $("p_phone").value = phone;

    const local = prompt("Local para coleta (casa, comércio, condomínio...):");
    if (local) $("p_local").value = local;

    const msg = $("msgOperacao");
    setMsg(msg, "warn", "Preencha o CEP e o número do novo participante antes de salvar.");
    show($("panelRecebimento"), false);
    show($("panelFinalTurno"), false);

    const saveNow = confirm("Deseja abrir o formulário de endereço pelo próprio navegador? Clique em OK e depois preencha manualmente os campos ocultos via DOM, ou cancele para seguir sem salvar agora.");
    if (!saveNow) return;
  });

  $("btnTrocarParticipante")?.addEventListener("click", () => {
    setSelectedParticipant(null);
    $("participantCode").value = "";
    openModal();
  });
}

function wireCEPHelper() {
  $("btnCep")?.addEventListener("click", async () => {
    const msg = $("msgOperacao");
    hideMsg(msg);

    try {
      const data = await fetchCEP($("p_cep")?.value || "");
      if ($("p_rua")) $("p_rua").value = data.logradouro || "";
      if ($("p_bairro")) $("p_bairro").value = data.bairro || "";
      if ($("p_cidade")) $("p_cidade").value = data.localidade || "";
      if ($("p_uf")) $("p_uf").value = data.uf || "";
      buildAddress();
      setMsg(msg, "ok", "CEP encontrado ✓");
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", "Erro ao buscar CEP.");
    }
  });

  ["p_rua", "p_numero", "p_bairro", "p_cidade", "p_uf", "p_cep", "p_comp"].forEach((id) => {
    $(id)?.addEventListener("input", buildAddress);
  });
}

function wireForms() {
  $("formOperacao")?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const msg = $("msgOperacao");
    hideMsg(msg);

    try {
      const opDate = ($("opDate")?.value || "").trim();
      const deliveryType = ($("deliveryType")?.value || "").trim();
      const flowType = ($("flowType")?.value || "").trim();

      if (!opDate) throw new Error("Informe a data da operação.");
      if (!deliveryType) throw new Error("Selecione o tipo de entrega.");
      if (!flowType) throw new Error("Selecione o tipo de fluxo.");

      setMsg(msg, "ok", "Etapa inicial pronta. Continue preenchendo a seção liberada abaixo.");
    } catch (e) {
      setMsg(msg, "bad", e.message || "Erro ao validar etapa inicial.");
    }
  });

  $("formRecebimento")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msgRecebimento");
    hideMsg(msg);

    try {
      setMsg(msg, "warn", "Salvando recebimento…");
      await saveRecebimento();
      setMsg(msg, "ok", "Coleta de recebimento salva ✓");
      resetRecebimentoForm();
      resetOperacaoForms();
      setSelectedParticipant(null);
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", e.message || "Erro ao salvar recebimento.");
    }
  });

  $("formFinalTurno")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const msg = $("msgFinalTurno");
    hideMsg(msg);

    try {
      setMsg(msg, "warn", "Salvando fechamento do turno…");
      await saveFinalTurno();
      setMsg(msg, "ok", "Registro final do turno salvo ✓");
      resetFinalTurnoForm();
      resetOperacaoForms();
      setSelectedParticipant(null);
    } catch (e) {
      console.error(e);
      setMsg(msg, "bad", e.message || "Erro ao salvar registro final do turno.");
    }
  });

  $("btnVoltarRecebimento")?.addEventListener("click", () => {
    show($("panelRecebimento"), false);
    STATE.selectedFlow = null;
    $("flowType").value = "";
    document.querySelectorAll("[data-flow].active").forEach(el => el.classList.remove("active"));
    setText("flowStatus", "não selecionado");
  });

  $("btnVoltarFinalTurno")?.addEventListener("click", () => {
    show($("panelFinalTurno"), false);
    STATE.selectedFlow = null;
    $("flowType").value = "";
    document.querySelectorAll("[data-flow].active").forEach(el => el.classList.remove("active"));
    setText("flowStatus", "não selecionado");
  });
}

async function bootstrapAfterAuth(user) {
  STATE.user = user;
  setText("dbStatus", "conectado");
  const ud = await loadUserDoc(user.uid);
  STATE.userDoc = ud;

  console.log("[bootstrap] auth user:", user);
  console.log("[bootstrap] userDoc:", ud);

  if (!ud) {
    alert("Seu usuário não está cadastrado na base (users).");
    window.location.href = "./index.html";
    return;
  }

  if (!ud.onboardingCompleted && !roleDispensaOnboarding(ud.role)) {
    window.location.href = "./cadastro-usuario.html";
    return;
  }

  if (!canAccessColetas(ud)) {
    alert("Sem permissão para acessar Cadastro de Coletas.");
    window.location.href = "./index.html";
    return;
  }

  STATE.territoryId = ud.territoryId || null;
  STATE.territoryLabel = ud.territoryLabel || "—";
  STATE.role = ud.role || null;

  const tmeta = STATE.territoryId ? await loadTerritoryMeta(STATE.territoryId) : null;
  STATE.territoryLabel = tmeta?.label || STATE.territoryLabel;
  STATE.territoryColor = tmeta?.color || ud.territoryColor || null;

  STATE.publicCode = await ensureUserPublicCode(user.uid);

  setText("flowStatus", "não selecionado");

  const participantCode = ($("participantCode")?.value || "").trim();
  if (participantCode) {
    const p = await findParticipantByCode(participantCode);
    if (p) setSelectedParticipant(p);
  }
}

async function init() {
  hardenInputsAgainstAutofill();
  wireChoiceCards();
  wireExtras();
  wireParticipantActions();
  wireCEPHelper();
  wireForms();

  if ($("opDate")) $("opDate").value = toISODate(new Date());

  try {
    await auth.authStateReady();

    const user = auth.currentUser;
    console.log("[init] currentUser:", user);
    console.log("[init] origin:", window.location.origin);

    if (!user) {
      setText("dbStatus", "deslogado");
      window.location.href = "./index.html";
      return;
    }

    await bootstrapAfterAuth(user);

    onAuthStateChanged(auth, async (nextUser) => {
      if (!nextUser) {
        window.location.href = "./index.html";
      }
    });
  } catch (e) {
    console.error(e);
    setText("dbStatus", "erro");
    alert("Erro ao iniciar cadastro de coletas. Verifique o console.");
  }
}

init();