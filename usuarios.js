import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
ELEMENTOS
========================= */

const els = {
  pendingList: document.getElementById("pendingList"),
  pendingCountLabel: document.getElementById("pendingCountLabel")
};

/* =========================
RENDER
========================= */

function render(list) {
  els.pendingCountLabel.textContent = `${list.length} itens`;

  if (!list.length) {
    els.pendingList.innerHTML = `
      <div class="empty-state">
        ⚠️ Nenhuma solicitação encontrada
      </div>
    `;
    return;
  }

  els.pendingList.innerHTML = list.map((req) => {
    const data = req.data;

    const snapshot = data.applicantSnapshot || {};

    return `
      <div class="user-item">
        <strong>${data.participantName || snapshot.name || "Sem nome"}</strong>

        <div>Código: ${data.participantCode || "—"}</div>
        <div>Telefone: ${snapshot.phone || "—"}</div>
        <div>Email: ${snapshot.email || "—"}</div>
        <div>Território: ${data.territoryLabel || data.territoryId || "—"}</div>

        <div style="margin-top:6px;">
          Status: <b>${data.status}</b>
        </div>
      </div>
    `;
  }).join("");
}

/* =========================
LOAD
========================= */

async function loadApprovalRequests() {
  try {
    const snap = await getDocs(collection(db, "approvalRequests"));

    const list = snap.docs.map(doc => ({
      id: doc.id,
      data: doc.data()
    }));

    console.log("APPROVAL REQUESTS:", list);

    render(list);

  } catch (error) {
    console.error("ERRO AO BUSCAR approvalRequests:", error);

    els.pendingList.innerHTML = `
      <div style="color:red;">
        ❌ Erro ao carregar approvalRequests<br>
        ${error.message}
      </div>
    `;
  }
}

/* =========================
AUTH
========================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "/login.html";
    return;
  }

  console.log("Usuário logado:", user.uid);

  await loadApprovalRequests();
});