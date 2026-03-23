import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
STATE GLOBAL
========================= */

const STATE = {
  user: null,
  userDoc: null,
  territoryId: null
};

/* =========================
UTILS
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

function toISODate(d) {
  return d.toISOString().split("T")[0];
}

function parseNum(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* =========================
AUTH + USER
========================= */

async function loadUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function bootstrap(user) {

  setText("dbStatus", "conectado");

  const userDoc = await loadUserDoc(user.uid);

  if (!userDoc) {
    alert("Usuário não encontrado.");
    location.href = "index.html";
    return;
  }

  STATE.user = user;
  STATE.userDoc = userDoc;
  STATE.territoryId = userDoc.territoryId;

  console.log("👤 UserDoc:", userDoc);

  if (!STATE.territoryId) {
    alert("Usuário sem território definido.");
  }
}

/* =========================
CHOICES
========================= */

function wireChoices() {

  document.querySelectorAll("[data-delivery]").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("[data-delivery]").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");
      $("deliveryType").value = btn.dataset.delivery;
    };
  });

  document.querySelectorAll("[data-flow]").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("[data-flow]").forEach(el => el.classList.remove("active"));
      btn.classList.add("active");

      $("flowType").value = btn.dataset.flow;

      $("panelRecebimento").classList.toggle("hidden", btn.dataset.flow !== "recebimento");
      $("panelFinalTurno").classList.toggle("hidden", btn.dataset.flow !== "final_turno");
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

/* =========================
SALVAR (AGORA COM TERRITORY)
========================= */

async function salvarRecebimento() {

  await addDoc(collection(db, "coletas"), {
    createdAt: serverTimestamp(),

    territoryId: STATE.territoryId, // 🔥 ESSENCIAL

    opDate: $("opDate").value,
    flowType: "recebimento",

    recebimento: {
      pesoResiduoSecoKg: parseNum($("pesoResiduoSecoKg").value),
      qualidadeNota: parseNum($("qualidadeNota").value)
    }
  });
}

async function salvarFinalTurno() {

  await addDoc(collection(db, "coletas"), {
    createdAt: serverTimestamp(),

    territoryId: STATE.territoryId, // 🔥 ESSENCIAL

    opDate: $("opDate").value,
    flowType: "final_turno",

    fotosQtd: fotosFinalTurno.length
  });
}

/* =========================
FORMS
========================= */

function wireForms() {

  $("formRecebimento")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await salvarRecebimento();
      setMsg($("msgRecebimento"), "ok", "Salvo ✓");
    } catch (e) {
      console.error(e);
      setMsg($("msgRecebimento"), "bad", e.message);
    }
  });

  $("formFinalTurno")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await salvarFinalTurno();
      setMsg($("msgFinalTurno"), "ok", "Salvo ✓");
    } catch (e) {
      console.error(e);
      setMsg($("msgFinalTurno"), "bad", e.message);
    }
  });
}

/* =========================
FOTOS COM MINIATURA
========================= */

const inputFotosFinalTurno = $("fotoFinalTurno");
const previewFinalTurno = $("previewFinalTurno");

let fotosFinalTurno = [];
const MAX_FOTOS = 10;

inputFotosFinalTurno?.addEventListener("change", (e) => {

  const files = Array.from(e.target.files);
  const imagens = files.filter(f => f.type.startsWith("image/"));

  if (fotosFinalTurno.length + imagens.length > MAX_FOTOS) {
    alert(`Máximo de ${MAX_FOTOS} fotos`);
    return;
  }

  fotosFinalTurno = [...fotosFinalTurno, ...imagens];

  renderPreviewFinalTurno();

  inputFotosFinalTurno.value = "";
});

function renderPreviewFinalTurno() {

  previewFinalTurno.innerHTML = "";

  fotosFinalTurno.forEach((file, index) => {

    const reader = new FileReader();

    reader.onload = (e) => {

      const div = document.createElement("div");
      div.className = "preview-item";

      div.innerHTML = `
        <img src="${e.target.result}">
        <button class="preview-remove" data-index="${index}">×</button>
      `;

      previewFinalTurno.appendChild(div);

      div.querySelector(".preview-remove").onclick = () => {
        fotosFinalTurno.splice(index, 1);
        renderPreviewFinalTurno();
      };
    };

    reader.readAsDataURL(file);
  });
}

/* =========================
INIT
========================= */

function init() {

  wireChoices();
  wireForms();

  if ($("opDate")) {
    $("opDate").value = toISODate(new Date());
  }

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      setText("dbStatus", "deslogado");
      location.href = "index.html";
      return;
    }

    await bootstrap(user);

    console.log("🔥 Firebase conectado");
  });
}

init();