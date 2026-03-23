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
AUTH
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
SALVAR FIREBASE
========================= */

async function salvarRecebimento() {

  await addDoc(collection(db, "coletas"), {
    createdAt: serverTimestamp(),
    opDate: $("opDate").value,
    flowType: "recebimento",

    recebimento: {
      pesoResiduoSecoKg: parseNum($("pesoResiduoSecoKg").value),
      qualidadeNota: parseNum($("qualidadeNota").value),
      fotosQtd: $("fotoResiduo")?.files?.length || 0
    }
  });
}

async function salvarFinalTurno() {

  await addDoc(collection(db, "coletas"), {
    createdAt: serverTimestamp(),
    opDate: $("opDate").value,
    flowType: "final_turno",

    finalTurno: {
      fotosQtd: fotosFinalTurno.length
    }
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
      setMsg($("msgRecebimento"), "bad", "Erro ao salvar");
    }
  });

  $("formFinalTurno")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      await salvarFinalTurno();
      setMsg($("msgFinalTurno"), "ok", "Salvo ✓");

    } catch (e) {
      console.error(e);
      setMsg($("msgFinalTurno"), "bad", "Erro ao salvar");
    }
  });
}

/* =========================
FOTOS MINIATURAS (PERFEITO)
========================= */

const inputFotosFinalTurno = document.getElementById("fotoFinalTurno");
const previewFinalTurno = document.getElementById("previewFinalTurno");

let fotosFinalTurno = [];
const MAX_FOTOS = 10;

inputFotosFinalTurno?.addEventListener("change", (e) => {

  const files = Array.from(e.target.files);

  const imagensValidas = files.filter(f => f.type.startsWith("image/"));

  if (fotosFinalTurno.length + imagensValidas.length > MAX_FOTOS) {
    alert(`Máximo de ${MAX_FOTOS} fotos permitido.`);
    return;
  }

  fotosFinalTurno = [...fotosFinalTurno, ...imagensValidas];

  renderPreviewFinalTurno();

  inputFotosFinalTurno.value = "";
});

function renderPreviewFinalTurno() {

  if (!previewFinalTurno) return;

  previewFinalTurno.innerHTML = "";

  fotosFinalTurno.forEach((file, index) => {

    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.className = "preview-item";

    div.innerHTML = `
      <img src="${url}" title="${file.name}">
      <button class="preview-remove" type="button">×</button>
    `;

    div.querySelector(".preview-remove").addEventListener("click", () => {
      fotosFinalTurno.splice(index, 1);
      renderPreviewFinalTurno();
    });

    previewFinalTurno.appendChild(div);
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