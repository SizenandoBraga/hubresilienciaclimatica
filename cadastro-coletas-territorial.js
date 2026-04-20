import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const PAGE_TERRITORY = {
  territoryId: "vila-pinto",
  territoryLabel: "Centro de Triagem Vila Pinto",
  backUrl: "./vila-pinto.html"
};

/* =========================
   STATE
========================= */

const STATE = {
  territoryId: PAGE_TERRITORY.territoryId,
  operacao: null,
  ultimaEtiqueta: null,
  salvando: false,
  user: null,
  userDoc: null
};

/* =========================
   HELPERS
========================= */

const $ = (id) => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}

function setMsg(el, kind, text) {
  if (!el) return;
  el.className = `msg ${kind}`;
  el.textContent = text;
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function parseNum(value) {
  if (!value) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatDateBR(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function gerarCodigoEtiqueta() {
  const d = new Date();
  return `ETQ-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${d.getHours()}${d.getMinutes()}${d.getSeconds()}`;
}

/* =========================
   QR CODE (CORRIGIDO)
========================= */

function gerarQrCode(valor) {
  const el = $("qrcode");
  if (!el) return;

  el.innerHTML = "";

  try {
    new QRCode(el, {
      text: String(valor),
      width: 200,
      height: 200,
      correctLevel: QRCode.CorrectLevel.M
    });
  } catch (e) {
    console.error("Erro QRCode:", e);
    el.innerHTML = "<small>Erro ao gerar QR</small>";
  }
}

/* =========================
   ETIQUETA (CORRIGIDA)
========================= */

function preencherEtiquetaSimples(registro) {
  STATE.ultimaEtiqueta = registro;

  const code = registro.participantCode || "SEM-CODIGO";

  // 🔥 QR MINIMAL (RESOLVE OVERFLOW)
  const qrPayload = `${code}|${STATE.territoryId}|${registro.id}`;

  setText("labelFamilyCode", code);
  setText("labelDate", formatDateBR(registro.opDate));

  gerarQrCode(qrPayload);
}

/* =========================
   AUTH
========================= */

async function loadCurrentUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) return resolve();

      STATE.user = user;

      const snap = await getDoc(doc(db, "users", user.uid));

      if (!snap.exists()) {
        console.error("Usuário sem doc users");
        return resolve();
      }

      STATE.userDoc = snap.data();

      console.log("Usuário autenticado:", {
        uid: user.uid,
        role: STATE.userDoc.role,
        status: STATE.userDoc.status,
        territoryId: STATE.userDoc.territoryId
      });

      resolve();
    });
  });
}

function ensureUser() {
  if (!STATE.user) throw new Error("Sem login");

  const status = STATE.userDoc?.status;
  if (!["active", "aprovado"].includes(status) && STATE.userDoc?.active !== true) {
    throw new Error("Usuário sem permissão");
  }

  if (STATE.userDoc.territoryId !== STATE.territoryId) {
    throw new Error("Território inválido");
  }
}

/* =========================
   OPERAÇÃO BASE
========================= */

function saveOperacaoBase() {
  const opDate = $("opDate").value;
  const deliveryType = $("deliveryType").value;
  const flowType = $("flowType").value;

  if (!opDate || !deliveryType || !flowType) {
    throw new Error("Preencha dados da operação");
  }

  STATE.operacao = { opDate, deliveryType, flowType };
}

/* =========================
   FIRESTORE
========================= */

async function salvarRecebimento() {
  ensureUser();
  saveOperacaoBase();

  const participantCode = $("familyCode").value.trim();

  if (!participantCode) throw new Error("Informe código participante");

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId,
    territoryLabel: PAGE_TERRITORY.territoryLabel,

    createdBy: STATE.user.uid,
    createdByName: STATE.userDoc.name || STATE.user.email,

    opDate: STATE.operacao.opDate,
    participantCode,

    deliveryType: STATE.operacao.deliveryType,
    flowType: "recebimento",

    codigoEtiqueta: gerarCodigoEtiqueta(),

    familyCode: participantCode,

    recebimento: {
      pesoResiduoSecoKg: parseNum($("pesoResiduoSecoKg").value),
      qualidadeNota: parseNum($("qualidadeNota").value),
      pesoRejeitoKg: parseNum($("pesoRejeitoKg").value),
      pesoNaoComercializadoKg: parseNum($("pesoNaoComercializadoKg").value)
    }
  };

  console.log("Payload:", payload);

  const ref = await addDoc(collection(db, "coletas"), payload);

  return { ...payload, id: ref.id };
}

/* =========================
   FORM
========================= */

function wireForms() {
  $("formRecebimento").addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const registro = await salvarRecebimento();

      preencherEtiquetaSimples(registro);

      alert("Coleta salva com sucesso");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });
}

/* =========================
   INIT
========================= */

async function init() {
  await loadCurrentUser();

  $("opDate").value = toISODate(new Date());

  wireForms();

  console.log("Página pronta");
}

init();