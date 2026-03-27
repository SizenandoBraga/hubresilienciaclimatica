import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
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
  usersList: document.getElementById("usersList"),
  totalUsers: document.getElementById("totalUsers"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter")
};

/* =========================
   UTILS
========================= */
function safe(value, fallback = "—") {
  return String(value ?? "").trim() || fallback;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase().trim();

  if (["aprovado", "approved", "ativo", "active"].includes(s)) return "aprovado";
  if (["inativo", "rejected", "inactive"].includes(s)) return "inativo";
  return "pendente";
}

function statusLabel(status) {
  if (status === "aprovado") return "🟢 Aprovado";
  if (status === "inativo") return "🔴 Inativo";
  return "🟡 Pendente";
}

function sortParticipants(items) {
  return [...items].sort((a, b) => {
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

function getFilteredParticipants() {
  const term = String(els.searchInput?.value || "").trim().toLowerCase();
  const statusFilter = String(els.statusFilter?.value || "all");

  return STATE.participants.filter((item) => {
    const matchesTerm =
      !term ||
      String(item.name || "").toLowerCase().includes(term) ||
      String(item.participantCode || "").toLowerCase().includes(term) ||
      String(item.phone || "").toLowerCase().includes(term) ||
      String(item.territoryLabel || "").toLowerCase().includes(term) ||
      String(item.address || "").toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    return matchesTerm && matchesStatus;
  });
}

/* =========================
   FIRESTORE
========================= */
async function loadParticipants() {
  try {
    const snap = await getDocs(collection(db, "participants"));

    STATE.participants = sortParticipants(
      snap.docs.map((docSnap) => {
        const data = docSnap.data() || {};

        return {
          id: docSnap.id,
          name: data.name || "Sem nome",
          participantCode: data.participantCode || "—",
          phone: data.phone || "",
          email: data.email || "",
          cpf: data.cpf || "",
          territoryId: data.territoryId || "",
          territoryLabel: data.territoryLabel || data.territoryId || "",
          status: normalizeStatus(data.status || data.approvalStatus),
          rawStatus: data.status || "",
          approvalStatus: data.approvalStatus || "",
          inOperation: data.inOperation === "sim" ? "sim" : "nao",
          inTerritory: data.inTerritory === "sim" ? "sim" : "nao",
          address:
            data.enderecoCompleto ||
            data.address?.addressLine ||
            "—",
          lat: data.lat ?? data.address?.lat ?? null,
          lng: data.lng ?? data.address?.lng ?? null,
          schedule: data.schedule || "A definir"
        };
      })
    );

    renderParticipants();
  } catch (error) {
    console.error("Erro ao buscar participants:", error);
    alert("Erro ao carregar usuários.");
  }
}

async function approveParticipant(id) {
  try {
    await updateDoc(doc(db, "participants", id), {
      status: "aprovado",
      approvalStatus: "approved",
      active: true,
      inOperation: "sim",
      inTerritory: "sim",
      schedule: "A definir",
      updatedAt: serverTimestamp(),
      updatedBy: STATE.user?.uid || null
    });

    await loadParticipants();
  } catch (error) {
    console.error("Erro ao aprovar participante:", error);
    alert("Não foi possível aprovar o participante.");
  }
}

async function rejectParticipant(id) {
  try {
    await updateDoc(doc(db, "participants", id), {
      status: "inativo",
      approvalStatus: "rejected",
      active: false,
      inOperation: "nao",
      updatedAt: serverTimestamp(),
      updatedBy: STATE.user?.uid || null
    });

    await loadParticipants();
  } catch (error) {
    console.error("Erro ao rejeitar participante:", error);
    alert("Não foi possível rejeitar o participante.");
  }
}

/* =========================
   RENDER
========================= */
function renderParticipants() {
  const items = getFilteredParticipants();

  if (els.totalUsers) {
    els.totalUsers.textContent = String(items.length);
  }

  if (!els.usersList) return;

  if (!items.length) {
    els.usersList.innerHTML = `<p>Nenhum participante encontrado.</p>`;
    return;
  }

  els.usersList.innerHTML = items
    .map((u) => {
      return `
        <div class="user-card">
          <strong>${safe(u.name)}</strong>

          <div><b>Código:</b> ${safe(u.participantCode)}</div>
          <div><b>Telefone:</b> ${safe(u.phone)}</div>
          <div><b>Email:</b> ${safe(u.email)}</div>
          <div><b>CPF:</b> ${safe(u.cpf)}</div>
          <div><b>Território:</b> ${safe(u.territoryLabel)}</div>
          <div><b>Endereço:</b> ${safe(u.address)}</div>
          <div><b>Status:</b> ${statusLabel(u.status)}</div>
          <div><b>Operação:</b> ${u.inOperation === "sim" ? "Sim" : "Não"}</div>
          <div><b>Rota:</b> ${safe(u.schedule)}</div>
          <div><b>Lat/Lng:</b> ${
            u.lat !== null && u.lng !== null ? `${u.lat}, ${u.lng}` : "Sem coordenadas"
          }</div>

          <div class="user-actions" style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" data-action="approve" data-id="${u.id}">
              Aprovar
            </button>

            <button type="button" data-action="reject" data-id="${u.id}">
              Rejeitar
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

/* =========================
   EVENTOS
========================= */
function bindEvents() {
  els.searchInput?.addEventListener("input", renderParticipants);
  els.statusFilter?.addEventListener("change", renderParticipants);

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    if (!id) return;

    if (action === "approve") {
      await approveParticipant(id);
      return;
    }

    if (action === "reject") {
      await rejectParticipant(id);
    }
  });
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
    alert("Erro ao carregar usuário autenticado.");
  }
});

/* =========================
   INIT
========================= */
bindEvents();

/* =========================
   FUNÇÕES GLOBAIS OPCIONAIS
========================= */
window.reloadParticipants = loadParticipants;