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

const STATE = {
  territoryId: PAGE_TERRITORY.territoryId,
  operacao: null,
  salvando: false,
  user: null,
  userDoc: null
};

/* =========================
UTILS
========================= */

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

function setMsg(el, kind, text) {
  if (!el) return;
  el.className = `msg ${kind}`;
  el.textContent = text;
}

function parseNum(value) {
  if (!value) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
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
      if (snap.exists()) {
        STATE.userDoc = snap.data();
      }

      resolve();
    });
  });
}

/* =========================
CHOICES
========================= */

function activateGroup(selector, btn, hiddenId, value) {
  document.querySelectorAll(selector).forEach(el => el.classList.remove("active"));
  btn.classList.add("active");
  $(hiddenId).value = value;
}

function wireChoices() {
  $$("[data-delivery]").forEach(btn => {
    btn.onclick = () => activateGroup("[data-delivery]", btn, "deliveryType", btn.dataset.delivery);
  });

  $$("[data-flow]").forEach(btn => {
    btn.onclick = () => {
      activateGroup("[data-flow]", btn, "flowType", btn.dataset.flow);

      $("panelRecebimento").classList.toggle("hidden", btn.dataset.flow !== "recebimento");
      $("panelFinalTurno").classList.toggle("hidden", btn.dataset.flow !== "final_turno");
    };
  });

  $$(".quality-btn").forEach(btn => {
    btn.onclick = () => {
      $$(".quality-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $("qualidadeNota").value = btn.dataset.quality;
    };
  });
}

/* =========================
BASE
========================= */

function saveOperacaoBase() {
  const opDate = $("opDate").value;
  const deliveryType = $("deliveryType").value;
  const flowType = $("flowType").value;

  if (!opDate || !deliveryType || !flowType) {
    setMsg($("msgOperacao"), "bad", "Preencha os dados.");
    return false;
  }

  STATE.operacao = { opDate, deliveryType, flowType };
  return true;
}

/* =========================
SALVAR RECEBIMENTO (SEM FOTO OBRIGATÓRIA)
========================= */

async function salvarRecebimento() {
  const payload = {
    createdAt: serverTimestamp(),
    territoryId: STATE.territoryId,
    createdBy: STATE.user.uid,

    opDate: STATE.operacao.opDate,
    flowType: "recebimento",

    participantCode: $("familyCode").value || null,
    pesoResiduoSecoKg: parseNum($("pesoResiduoSecoKg").value),
    qualidadeNota: parseNum($("qualidadeNota").value),
    pesoRejeitoKg: parseNum($("pesoRejeitoKg").value),
    pesoNaoComercializadoKg: parseNum($("pesoNaoComercializadoKg").value),
    observacao: $("recebimentoObs").value || null
  };

  await addDoc(collection(db, "coletas"), payload);
}

/* =========================
SALVAR FINAL TURNO (SEM FOTO)
========================= */

async function salvarFinalTurno() {
  const payload = {
    createdAt: serverTimestamp(),
    territoryId: STATE.territoryId,
    createdBy: STATE.user.uid,

    opDate: STATE.operacao.opDate,
    flowType: "final_turno",

    participantCode: $("condCode").value || null,
    pesoRejeitoGeralKg: parseNum($("pesoRejeitoGeralKg").value)
  };

  await addDoc(collection(db, "coletas"), payload);
}

/* =========================
NOVA COLETA
========================= */

function novaColeta() {
  STATE.operacao = null;

  $("formOperacao").reset();
  $("formRecebimento").reset();
  $("formFinalTurno").reset();

  $("panelRecebimento").classList.add("hidden");
  $("panelFinalTurno").classList.add("hidden");
}

/* =========================
FORMS
========================= */

function wireForms() {
  $("formOperacao").addEventListener("submit", (e) => {
    e.preventDefault();
    saveOperacaoBase();
  });

  $("formRecebimento").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!saveOperacaoBase()) return;

    await salvarRecebimento();
    setMsg($("msgRecebimento"), "ok", "Coleta salva!");
  });

  $("formFinalTurno").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!saveOperacaoBase()) return;

    await salvarFinalTurno();
    setMsg($("msgFinalTurno"), "ok", "Turno salvo!");
  });

  $("btnNovaColeta")?.addEventListener("click", novaColeta);
}

/* =========================
INIT
========================= */

async function init() {
  wireChoices();
  wireForms();
  await loadCurrentUser();

  console.log("Sistema pronto");
}

init();