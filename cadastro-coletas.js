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

/* =====================================================
UTILS
===================================================== */

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
  return d.toISOString().split("T")[0];
}

function parseNum(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* =====================================================
AUTH + BOOTSTRAP (CORRIGIDO)
===================================================== */

async function loadUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function bootstrapAfterAuth(user) {
  STATE.user = user;
  setText("dbStatus", "conectado");

  const ud = await loadUserDoc(user.uid);
  STATE.userDoc = ud;

  if (!ud) {
    alert("Usuário não encontrado.");
    window.location.href = "./index.html";
    return;
  }

  STATE.territoryId = ud.territoryId || null;
  STATE.territoryLabel = ud.territoryLabel || "—";
}

/* =====================================================
CHOICES
===================================================== */

function wireChoiceCards() {
  document.querySelectorAll("[data-delivery]").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll("[data-delivery]").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      STATE.selectedDelivery = btn.dataset.delivery;
      $("deliveryType").value = btn.dataset.delivery;
    };
  });

  document.querySelectorAll("[data-flow]").forEach((btn) => {
    btn.onclick = () => {
      document.querySelectorAll("[data-flow]").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");

      STATE.selectedFlow = btn.dataset.flow;
      $("flowType").value = btn.dataset.flow;

      show($("panelRecebimento"), btn.dataset.flow === "recebimento");
      show($("panelFinalTurno"), btn.dataset.flow === "final_turno");
    };
  });

  document.querySelectorAll(".quality-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".quality-btn").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      $("qualidadeNota").value = btn.dataset.quality;
    };
  });
}

/* =====================================================
SALVAR DADOS
===================================================== */

async function saveRecebimento() {
  const payload = {
    createdAt: serverTimestamp(),
    opDate: $("opDate").value,
    deliveryType: $("deliveryType").value,
    flowType: "recebimento",

    recebimento: {
      pesoResiduoSecoKg: parseNum($("pesoResiduoSecoKg").value),
      pesoRejeitoKg: parseNum($("pesoRejeitoKg").value),
      pesoNaoComercializadoKg: parseNum($("pesoNaoComercializadoKg").value),
      qualidadeNota: parseNum($("qualidadeNota").value)
    }
  };

  await addDoc(collection(db, "coletas"), payload);
}

async function saveFinalTurno() {
  const payload = {
    createdAt: serverTimestamp(),
    opDate: $("opDate").value,
    deliveryType: $("deliveryType").value,
    flowType: "final_turno",

    finalTurno: {
      pesoRejeitoGeralKg: parseNum($("pesoRejeitoGeralKg").value),
      plasticoKg: parseNum($("plasticoKg").value),
      papelMistoKg: parseNum($("papelMistoKg").value)
    }
  };

  await addDoc(collection(db, "coletas"), payload);
}

/* =====================================================
FORMS
===================================================== */

function wireForms() {

  $("formOperacao")?.addEventListener("submit", (e) => {
    e.preventDefault();
    setMsg($("msgOperacao"), "ok", "Etapa inicial OK");
  });

  $("formRecebimento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveRecebimento();
      setMsg($("msgRecebimento"), "ok", "Salvo ✓");
    } catch (e) {
      setMsg($("msgRecebimento"), "bad", "Erro ao salvar");
    }
  });

  $("formFinalTurno")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveFinalTurno();
      setMsg($("msgFinalTurno"), "ok", "Salvo ✓");
    } catch (e) {
      setMsg($("msgFinalTurno"), "bad", "Erro ao salvar");
    }
  });
}

/* =====================================================
FOTOS FINAL TURNO (MANTIDO)
===================================================== */

const inputFotosFinalTurno = $("fotoFinalTurno");
const previewFinalTurno = $("previewFinalTurno");

let fotosFinalTurno = [];
const MAX_FOTOS = 10;

inputFotosFinalTurno?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files);

  if (fotosFinalTurno.length + files.length > MAX_FOTOS) {
    alert(`Máximo de ${MAX_FOTOS} fotos.`);
    return;
  }

  files.forEach(file => {
    if (file.type.startsWith("image/")) {
      fotosFinalTurno.push(file);
    }
  });

  renderPreviewFinalTurno();
});

function renderPreviewFinalTurno() {
  if (!previewFinalTurno) return;

  previewFinalTurno.innerHTML = "";

  fotosFinalTurno.forEach((file, index) => {
    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.className = "preview-item";

    div.innerHTML = `
      <img src="${url}">
      <button class="preview-remove" data-index="${index}">×</button>
    `;

    previewFinalTurno.appendChild(div);
  });

  previewFinalTurno.querySelectorAll(".preview-remove").forEach(btn => {
    btn.onclick = (e) => {
      fotosFinalTurno.splice(Number(e.target.dataset.index), 1);
      renderPreviewFinalTurno();
    };
  });
}

/* =====================================================
INIT (CORRIGIDO)
===================================================== */

function init() {
  wireChoiceCards();
  wireForms();

  if ($("opDate")) $("opDate").value = toISODate(new Date());

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        setText("dbStatus", "deslogado");
        window.location.href = "./index.html";
        return;
      }

      await bootstrapAfterAuth(user);

      console.log("🔥 Firebase conectado com sucesso");

    } catch (e) {
      console.error(e);
      setText("dbStatus", "erro");
    }
  });
}

init();