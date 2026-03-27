import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
ESTADO
========================= */

const STATE = {
  user: null,
  userDoc: null,
  participants: []
};

/* =========================
ELEMENTOS
========================= */

const els = {
  list: document.getElementById("usersList"),
  total: document.getElementById("totalUsers")
};

/* =========================
UTILS
========================= */

function safe(value, fallback = "—") {
  return String(value ?? "").trim() || fallback;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase();

  if (["aprovado", "approved", "ativo"].includes(s)) return "aprovado";
  if (["pendente", "pending"].includes(s)) return "pendente";
  if (["inativo", "rejected"].includes(s)) return "inativo";

  return "pendente";
}

function statusLabel(status) {
  if (status === "aprovado") return "🟢 Aprovado";
  if (status === "inativo") return "🔴 Inativo";
  return "🟡 Pendente";
}

/* =========================
BUSCAR USUÁRIOS
========================= */

async function loadParticipants() {
  try {
    const snap = await getDocs(collection(db, "participants"));

    STATE.participants = snap.docs.map((docSnap) => {
      const data = docSnap.data();

      return {
        id: docSnap.id,
        name: data.name || "Sem nome",
        code: data.participantCode || "—",
        phone: data.phone || "",
        territory: data.territoryLabel || data.territoryId || "",
        status: normalizeStatus(data.status),
        inOperation: data.inOperation === "sim" ? "sim" : "nao",
        lat: data.lat || null,
        lng: data.lng || null,
        address: data.enderecoCompleto || ""
      };
    });

    render();
  } catch (error) {
    console.error("Erro ao buscar participants:", error);
    alert("Erro ao carregar usuários.");
  }
}

/* =========================
RENDER
========================= */

function render() {
  els.total.textContent = STATE.participants.length;

  if (!STATE.participants.length) {
    els.list.innerHTML = `<p>Nenhum usuário encontrado.</p>`;
    return;
  }

  els.list.innerHTML = STATE.participants
    .map((u) => {
      return `
      <div class="user-card">
        <strong>${safe(u.name)}</strong>
        <div>Código: ${safe(u.code)}</div>
        <div>Telefone: ${safe(u.phone)}</div>
        <div>Território: ${safe(u.territory)}</div>
        <div>Status: ${statusLabel(u.status)}</div>
        <div>Operação: ${u.inOperation === "sim" ? "Sim" : "Não"}</div>
      </div>
    `;
    })
    .join("");
}

/* =========================
AUTH
========================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  STATE.user = user;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    STATE.userDoc = snap.exists() ? snap.data() : null;

    await loadParticipants();
  } catch (error) {
    console.error("Erro ao carregar userDoc:", error);
  }
});