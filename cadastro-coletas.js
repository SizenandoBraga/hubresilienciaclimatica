import { auth, db } from "firebase-init.js";

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

/* =====================================================
STATE GLOBAL
===================================================== */
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

/* =====================================================
UTILS
===================================================== */
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
  const x = String(v ?? "").replace(",", ".").trim();
  if (!x) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/* =====================================================
FOTOS FINAL DE TURNO (MELHORADO)
===================================================== */

const inputFotosFinalTurno = document.getElementById("fotoFinalTurno");
const previewFinalTurno = document.getElementById("previewFinalTurno");

let fotosFinalTurno = [];
const MAX_FOTOS = 10;

// Seleção de imagens
inputFotosFinalTurno?.addEventListener("change", (e) => {

  const files = Array.from(e.target.files);

  const novas = [];

  files.forEach(file => {
    if (!file.type.startsWith("image/")) return;

    if (fotosFinalTurno.length + novas.length < MAX_FOTOS) {
      novas.push(file);
    }
  });

  fotosFinalTurno = [...fotosFinalTurno, ...novas];

  if (files.length !== novas.length) {
    alert(`Limite de ${MAX_FOTOS} imagens atingido.`);
  }

  renderPreviewFinalTurno();

  // limpa input (permite selecionar a mesma imagem novamente)
  inputFotosFinalTurno.value = "";
});

// Render preview
function renderPreviewFinalTurno(){

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

  // remover imagem
  previewFinalTurno.querySelectorAll(".preview-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const index = Number(e.target.dataset.index);
      fotosFinalTurno.splice(index, 1);
      renderPreviewFinalTurno();
    });
  });
}

/* =====================================================
SALVAR FINAL TURNO (AJUSTADO COM FOTOS)
===================================================== */

async function saveFinalTurno() {

  if (!STATE.user) throw new Error("Usuário não autenticado.");

  const payload = {
    createdBy: STATE.user.uid,
    createdAt: serverTimestamp(),

    opDate: $("opDate")?.value || null,
    flowType: "final_turno",
    deliveryType: $("deliveryType")?.value || null,

    finalTurno: {
      pesoRejeitoGeralKg: parseNum($("pesoRejeitoGeralKg")?.value),

      plasticoKg: parseNum($("plasticoKg")?.value),
      papelMistoKg: parseNum($("papelMistoKg")?.value),
      papelaoKg: parseNum($("papelaoKg")?.value),
      aluminioMetalKg: parseNum($("aluminioMetalKg")?.value),
      vidroKg: parseNum($("vidroKg")?.value),
      sacariaKg: parseNum($("sacariaKg")?.value),
      isoporKg: parseNum($("isoporKg")?.value),
      oleoKg: parseNum($("oleoKg")?.value),

      // AQUI É O AJUSTE PRINCIPAL
      fotosFinalTurnoQtd: fotosFinalTurno.length
    }
  };

  await addDoc(collection(db, "coletas"), payload);

  // limpa fotos após salvar
  fotosFinalTurno = [];
  renderPreviewFinalTurno();

  return payload;
}

/* =====================================================
FORM FINAL TURNO
===================================================== */

$("formFinalTurno")?.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const msg = $("msgFinalTurno");
  hideMsg(msg);

  try {
    setMsg(msg, "warn", "Salvando...");

    await saveFinalTurno();

    setMsg(msg, "ok", "Salvo com sucesso ✓");

    $("formFinalTurno").reset();

  } catch (e) {
    console.error(e);
    setMsg(msg, "bad", "Erro ao salvar.");
  }
});

/* =====================================================
INIT
===================================================== */

async function init() {

  if ($("opDate")) {
    $("opDate").value = toISODate(new Date());
  }

  try {

    await auth.authStateReady();

    const user = auth.currentUser;

    if (!user) {
      window.location.href = "./index.html";
      return;
    }

    STATE.user = user;

    onAuthStateChanged(auth, (u) => {
      if (!u) window.location.href = "./index.html";
    });

  } catch (e) {
    console.error(e);
    alert("Erro ao iniciar");
  }
}

init();