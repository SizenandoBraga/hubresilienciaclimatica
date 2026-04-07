import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
STATE
========================= */

const STATE = {
  authUser: null,
  userDoc: null,
  participants: [],
  approvalRequests: [],
  users: [],
  filteredUsers: []
};

/* =========================
UTILS
========================= */

const $ = (id) => document.getElementById(id);

function onlyDigits(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizeStatus(v) {
  const s = String(v || "").toLowerCase();

  if (["approved", "aprovado", "ativo"].includes(s)) return "aprovado";
  if (["rejected", "inativo"].includes(s)) return "inativo";
  return "pendente";
}

function sameTerritory(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

/* =========================
MAPEAMENTO
========================= */

function mapParticipant(docSnap) {
  const d = docSnap.data() || {};

  return {
    id: docSnap.id,
    name: d.name || "Sem nome",
    code: d.participantCode || "—",
    phone: d.phone || "",
    territoryId: d.territoryId || null,
    territoryLabel: d.territoryLabel || "",
    status: normalizeStatus(d.status || d.approvalStatus),
    approvalRequestId: d.approvalRequestId || null,
    raw: d
  };
}

function mapApproval(docSnap) {
  const d = docSnap.data() || {};
  const snap = d.payloadSnapshot || {};

  return {
    id: docSnap.id,
    name: d.participantName || snap.name || "Pendente",
    code: d.participantCode || snap.participantCode || "—",
    territoryId: d.territoryId || snap.territoryId || null,
    territoryLabel: d.territoryLabel || snap.territoryLabel || "",
    status: String(d.status || "pending"),
    raw: d
  };
}

/* =========================
MERGE (CORREÇÃO PRINCIPAL)
========================= */

function mergeUsers() {
  const map = new Map();

  // PARTICIPANTS
  STATE.participants.forEach((p) => {
    map.set(p.id, {
      ...p,
      source: "participant"
    });
  });

  // APPROVALS (pendentes)
  STATE.approvalRequests.forEach((a) => {
    if (["approved", "rejected"].includes(a.status)) return;

    const existing = [...map.values()].find(
      (p) =>
        p.approvalRequestId === a.id ||
        p.code === a.code
    );

    if (!existing) {
      map.set(a.id, {
        id: `approval_${a.id}`,
        name: a.name,
        code: a.code,
        territoryId: a.territoryId,
        territoryLabel: a.territoryLabel,
        status: "pendente",
        approvalRequestId: a.id,
        source: "approval",
        raw: a.raw
      });
    }
  });

  let users = Array.from(map.values());

  // FILTRO TERRITÓRIO
  if (STATE.userDoc?.territoryId) {
    users = users.filter((u) =>
      sameTerritory(u.territoryId, STATE.userDoc.territoryId)
    );
  }

  STATE.users = users.sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR")
  );

  applyFilters();
}

/* =========================
FILTROS
========================= */

function applyFilters() {
  const term = ($("searchInput")?.value || "").toLowerCase();

  STATE.filteredUsers = STATE.users.filter((u) =>
    u.name.toLowerCase().includes(term) ||
    String(u.code).toLowerCase().includes(term)
  );

  render();
}

/* =========================
RENDER
========================= */

function render() {
  renderPending();
  renderActive();
  renderTable();
}

function renderPending() {
  const el = $("pendingList");
  if (!el) return;

  const list = STATE.filteredUsers.filter((u) => u.status === "pendente");

  if (!list.length) {
    el.innerHTML = "Nenhum pendente";
    return;
  }

  el.innerHTML = list.map((u) => `
    <div>
      <strong>${u.name}</strong> (${u.code})
      <button onclick="approveUser('${u.id}')">Aprovar</button>
      <button onclick="rejectUser('${u.id}')">Rejeitar</button>
    </div>
  `).join("");
}

function renderActive() {
  const el = $("activeList");
  if (!el) return;

  const list = STATE.filteredUsers.filter((u) => u.status === "aprovado");

  if (!list.length) {
    el.innerHTML = "Nenhum ativo";
    return;
  }

  el.innerHTML = list.map((u) => `
    <div>
      <strong>${u.name}</strong> (${u.code})
    </div>
  `).join("");
}

function renderTable() {
  const el = $("usersTableBody");
  if (!el) return;

  el.innerHTML = STATE.filteredUsers.map((u) => `
    <tr>
      <td>${u.name}</td>
      <td>${u.code}</td>
      <td>${u.status}</td>
      <td>${u.territoryLabel || "-"}</td>
    </tr>
  `).join("");
}

/* =========================
APROVAÇÃO
========================= */

async function approveUser(id) {
  const user = STATE.users.find((u) => u.id === id);
  if (!user) return;

  try {
    const batch = writeBatch(db);

    if (user.approvalRequestId) {
      batch.update(doc(db, "approvalRequests", user.approvalRequestId), {
        status: "approved",
        reviewedAt: serverTimestamp()
      });
    }

    await batch.commit();

    await setDoc(doc(db, "participants", user.code), {
      name: user.name,
      participantCode: user.code,
      territoryId: user.territoryId,
      territoryLabel: user.territoryLabel,
      status: "aprovado",
      approvalStatus: "approved",
      createdAt: serverTimestamp()
    }, { merge: true });

    reload();
  } catch (e) {
    console.error(e);
    alert("Erro ao aprovar");
  }
}

async function rejectUser(id) {
  const user = STATE.users.find((u) => u.id === id);
  if (!user) return;

  try {
    if (user.approvalRequestId) {
      await writeBatch(db)
        .update(doc(db, "approvalRequests", user.approvalRequestId), {
          status: "rejected"
        })
        .commit();
    }

    reload();
  } catch (e) {
    console.error(e);
    alert("Erro ao rejeitar");
  }
}

/* =========================
LOAD
========================= */

async function loadParticipants() {
  const snap = await getDocs(collection(db, "participants"));
  STATE.participants = snap.docs.map(mapParticipant);
  mergeUsers();
}

async function loadApprovals() {
  const snap = await getDocs(collection(db, "approvalRequests"));
  STATE.approvalRequests = snap.docs.map(mapApproval);
  mergeUsers();
}

function startListeners() {
  onSnapshot(collection(db, "participants"), (snap) => {
    STATE.participants = snap.docs.map(mapParticipant);
    mergeUsers();
  });

  onSnapshot(collection(db, "approvalRequests"), (snap) => {
    STATE.approvalRequests = snap.docs.map(mapApproval);
    mergeUsers();
  });
}

function reload() {
  loadParticipants();
  loadApprovals();
}

/* =========================
INIT
========================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  STATE.authUser = user;

  const userSnap = await getDoc(doc(db, "users", user.uid));
  STATE.userDoc = userSnap.data();

  loadParticipants();
  loadApprovals();
  startListeners();
});

/* =========================
EVENTOS
========================= */

$("searchInput")?.addEventListener("input", applyFilters);
$("btnLogout")?.addEventListener("click", () => signOut(auth));