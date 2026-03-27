import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
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
  approvalRequests: [],
  filteredRequests: []
};

/* =========================
   ELEMENTOS DO HTML
========================= */
const els = {
  btnLogout: document.getElementById("btnLogout"),

  sidebarUserName: document.getElementById("sidebarUserName"),
  sidebarTerritoryLabel: document.getElementById("sidebarTerritoryLabel"),

  kpiTotal: document.getElementById("kpiTotal"),
  kpiPending: document.getElementById("kpiPending"),
  kpiActive: document.getElementById("kpiActive"),
  kpiGeo: document.getElementById("kpiGeo"),

  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  operationFilter: document.getElementById("operationFilter"),

  pendingList: document.getElementById("pendingList"),
  activeList: document.getElementById("activeList"),
  pendingCountLabel: document.getElementById("pendingCountLabel"),
  activeCountLabel: document.getElementById("activeCountLabel"),

  usersTableBody: document.getElementById("usersTableBody"),
  tableCountLabel: document.getElementById("tableCountLabel"),

  userModal: document.getElementById("userModal"),
  userModalBackdrop: document.getElementById("userModalBackdrop"),
  closeUserModal: document.getElementById("closeUserModal"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),

  modalUserId: document.getElementById("modalUserId"),
  modalApprovalRequestId: document.getElementById("modalApprovalRequestId"),
  modalUserName: document.getElementById("modalUserName"),
  modalUserCode: document.getElementById("modalUserCode"),
  modalUserPhone: document.getElementById("modalUserPhone"),
  modalUserStatus: document.getElementById("modalUserStatus"),
  modalOperation: document.getElementById("modalOperation"),
  modalTerritoryLabel: document.getElementById("modalTerritoryLabel"),
  modalAddress: document.getElementById("modalAddress"),
  modalLat: document.getElementById("modalLat"),
  modalLng: document.getElementById("modalLng"),
  modalInOperationHint: document.getElementById("modalInOperationHint"),
  modalRequestInfo: document.getElementById("modalRequestInfo"),
  userModalStatusNote: document.getElementById("userModalStatusNote"),
  modalRejectBtn: document.getElementById("modalRejectBtn"),
  modalApproveBtn: document.getElementById("modalApproveBtn"),
  userModalForm: document.getElementById("userModalForm")
};

/* =========================
   UTILS
========================= */
function safe(value, fallback = "—") {
  return String(value ?? "").trim() || fallback;
}

function normalizeStatus(status) {
  const s = String(status || "").toLowerCase().trim();

  if (["approved", "aprovado", "ativo", "active"].includes(s)) return "aprovado";
  if (["rejected", "inativo", "inactive"].includes(s)) return "inativo";
  return "pendente";
}

function badgeClass(status) {
  if (status === "aprovado") return "badge badge-aprovado";
  if (status === "inativo") return "badge badge-inativo";
  return "badge badge-pendente";
}

function buildAddress(snapshot = {}) {
  if (snapshot.enderecoCompleto) return snapshot.enderecoCompleto;
  if (snapshot.address?.addressLine) return snapshot.address.addressLine;

  const address = snapshot.address || {};
  const rua = snapshot.rua || address.street || "";
  const numero = snapshot.numero || address.number || "";
  const bairro = snapshot.bairro || address.neighborhood || "";
  const cidade = snapshot.cidade || address.city || "";
  const uf = snapshot.uf || address.state || "";
  const cep = snapshot.cep || address.cep || "";

  return [
    [rua, numero].filter(Boolean).join(", "),
    [bairro, cidade, uf].filter(Boolean).join(" - "),
    cep ? `CEP ${cep}` : ""
  ].filter(Boolean).join(" • ");
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/* =========================
   MAPEAR approvalRequests
========================= */
function mapApprovalRequest(docSnap) {
  const data = docSnap.data() || {};
  const snapshot = data.applicantSnapshot || {};
  const address = snapshot.address || {};

  return {
    id: docSnap.id,
    participantId: data.participantId || null,
    name: data.participantName || snapshot.name || "Sem nome",
    code: data.participantCode || snapshot.participantCode || "—",
    phone: snapshot.phone || "",
    email: snapshot.email || "",
    cpf: snapshot.cpf || "",
    territoryId: data.territoryId || snapshot.territoryId || "",
    territoryLabel: data.territoryLabel || snapshot.territoryLabel || "",
    status: normalizeStatus(data.status),
    rawStatus: data.status || "pending",
    inOperation: data.status === "approved" ? "sim" : "nao",
    address: buildAddress(snapshot),
    lat: toNumberOrNull(snapshot.lat) ?? toNumberOrNull(address.lat),
    lng: toNumberOrNull(snapshot.lng) ?? toNumberOrNull(address.lng),
    raw: data
  };
}

/* =========================
   FIRESTORE
========================= */
async function loadApprovalRequests() {
  try {
    const snap = await getDocs(collection(db, "approvalRequests"));

    STATE.approvalRequests = snap.docs
      .map(mapApprovalRequest)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));

    applyFilters();
  } catch (error) {
    console.error("Erro ao buscar approvalRequests:", error);

    if (els.pendingList) {
      els.pendingList.innerHTML = `
        <div class="empty-state">
          Erro ao carregar solicitações: ${safe(error.message)}
        </div>
      `;
    }
  }
}

async function approveRequest(requestId) {
  try {
    await updateDoc(doc(db, "approvalRequests", requestId), {
      status: "approved",
      active: false,
      resolvedAt: serverTimestamp(),
      resolvedBy: STATE.user?.uid || null,
      resolvedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null,
      updatedAt: serverTimestamp()
    });

    await loadApprovalRequests();
    closeModal();
  } catch (error) {
    console.error("Erro ao aprovar solicitação:", error);
    alert("Não foi possível aprovar a solicitação.");
  }
}

async function rejectRequest(requestId) {
  try {
    await updateDoc(doc(db, "approvalRequests", requestId), {
      status: "rejected",
      active: false,
      resolvedAt: serverTimestamp(),
      resolvedBy: STATE.user?.uid || null,
      resolvedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null,
      updatedAt: serverTimestamp()
    });

    await loadApprovalRequests();
    closeModal();
  } catch (error) {
    console.error("Erro ao rejeitar solicitação:", error);
    alert("Não foi possível rejeitar a solicitação.");
  }
}

/* =========================
   FILTROS
========================= */
function applyFilters() {
  const term = String(els.searchInput?.value || "").trim().toLowerCase();
  const status = String(els.statusFilter?.value || "all");
  const operation = String(els.operationFilter?.value || "all");

  STATE.filteredRequests = STATE.approvalRequests.filter((item) => {
    const matchesTerm =
      !term ||
      item.name.toLowerCase().includes(term) ||
      String(item.code).toLowerCase().includes(term) ||
      String(item.phone).toLowerCase().includes(term) ||
      String(item.email).toLowerCase().includes(term) ||
      String(item.cpf).toLowerCase().includes(term) ||
      String(item.address).toLowerCase().includes(term);

    const matchesStatus = status === "all" || item.status === status;
    const matchesOperation = operation === "all" || item.inOperation === operation;

    return matchesTerm && matchesStatus && matchesOperation;
  });

  renderAll();
}

/* =========================
   RENDER
========================= */
function renderKpis() {
  const total = STATE.filteredRequests.length;
  const pending = STATE.filteredRequests.filter((u) => u.status === "pendente").length;
  const active = STATE.filteredRequests.filter((u) => u.status === "aprovado").length;
  const geo = STATE.filteredRequests.filter((u) => isValidCoord(u.lat, u.lng)).length;

  if (els.kpiTotal) els.kpiTotal.textContent = String(total);
  if (els.kpiPending) els.kpiPending.textContent = String(pending);
  if (els.kpiActive) els.kpiActive.textContent = String(active);
  if (els.kpiGeo) els.kpiGeo.textContent = String(geo);

  if (els.pendingCountLabel) els.pendingCountLabel.textContent = `${pending} itens`;
  if (els.activeCountLabel) els.activeCountLabel.textContent = `${active} itens`;
  if (els.tableCountLabel) els.tableCountLabel.textContent = `${total} registros`;
}

function renderPendingList() {
  if (!els.pendingList) return;

  const pending = STATE.filteredRequests.filter((u) => u.status === "pendente");

  if (!pending.length) {
    els.pendingList.innerHTML = `
      <div class="empty-state">
        Nenhuma solicitação pendente no momento.
      </div>
    `;
    return;
  }

  els.pendingList.innerHTML = pending.map((u) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${safe(u.name)}</strong>
        <span>Código: ${safe(u.code)}</span>
        <span>Telefone: ${safe(u.phone)}</span>
        <span>${safe(u.address)}</span>
      </div>

      <div class="user-actions">
        <span class="${badgeClass(u.status)}">Pendente</span>
        <button class="btn btn-success" data-action="approve" data-id="${u.id}" type="button">Aprovar</button>
        <button class="btn btn-danger" data-action="reject" data-id="${u.id}" type="button">Rejeitar</button>
        <button class="btn btn-ghost" data-action="open" data-id="${u.id}" type="button">Abrir</button>
      </div>
    </article>
  `).join("");
}

function renderActiveList() {
  if (!els.activeList) return;

  const active = STATE.filteredRequests.filter((u) => u.status === "aprovado");

  if (!active.length) {
    els.activeList.innerHTML = `
      <div class="empty-state">
        Nenhum participante aprovado no momento.
      </div>
    `;
    return;
  }

  els.activeList.innerHTML = active.map((u) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${safe(u.name)}</strong>
        <span>${safe(u.address)}</span>
        <span>Telefone: ${safe(u.phone)}</span>
      </div>

      <div class="user-actions">
        <span class="${badgeClass(u.status)}">Aprovado</span>
        <button class="btn btn-ghost" data-action="open" data-id="${u.id}" type="button">Abrir</button>
      </div>
    </article>
  `).join("");
}

function renderTable() {
  if (!els.usersTableBody) return;

  if (!STATE.filteredRequests.length) {
    els.usersTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhuma solicitação encontrada.</td>
      </tr>
    `;
    return;
  }

  els.usersTableBody.innerHTML = STATE.filteredRequests.map((u) => `
    <tr>
      <td>
        <strong>${safe(u.name)}</strong><br>
        <small>${safe(u.code)}</small><br>
        <small>${safe(u.phone)}</small>
      </td>
      <td><span class="${badgeClass(u.status)}">${safe(u.status)}</span></td>
      <td>${u.inOperation === "sim" ? "Em operação" : "Fora da operação"}</td>
      <td>${safe(u.territoryLabel || u.territoryId)}</td>
      <td>${safe(u.address)}</td>
      <td>${isValidCoord(u.lat, u.lng) ? `${u.lat}, ${u.lng}` : "Sem coordenadas"}</td>
      <td>
        <div class="table-actions">
          ${u.status === "pendente" ? `<button class="btn btn-success" data-action="approve" data-id="${u.id}" type="button">Aprovar</button>` : ""}
          ${u.status === "pendente" ? `<button class="btn btn-danger" data-action="reject" data-id="${u.id}" type="button">Rejeitar</button>` : ""}
          <button class="btn btn-ghost" data-action="open" data-id="${u.id}" type="button">Abrir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderAll() {
  renderKpis();
  renderPendingList();
  renderActiveList();
  renderTable();
}

/* =========================
   MODAL
========================= */
function openModal(requestId) {
  const item = STATE.approvalRequests.find((r) => r.id === requestId);
  if (!item || !els.userModal) return;

  if (els.modalUserId) els.modalUserId.value = item.id;
  if (els.modalApprovalRequestId) els.modalApprovalRequestId.value = item.id;
  if (els.modalUserName) els.modalUserName.value = safe(item.name, "");
  if (els.modalUserCode) els.modalUserCode.value = safe(item.code, "");
  if (els.modalUserPhone) els.modalUserPhone.value = safe(item.phone, "");
  if (els.modalUserStatus) els.modalUserStatus.value = item.status;
  if (els.modalOperation) els.modalOperation.value = item.inOperation;
  if (els.modalTerritoryLabel) els.modalTerritoryLabel.value = safe(item.territoryLabel, "");
  if (els.modalAddress) els.modalAddress.value = safe(item.address, "");
  if (els.modalLat) els.modalLat.value = item.lat ?? "";
  if (els.modalLng) els.modalLng.value = item.lng ?? "";
  if (els.modalInOperationHint) els.modalInOperationHint.value = item.inOperation === "sim" ? "Na rota operacional" : "Fora da rota";
  if (els.modalRequestInfo) els.modalRequestInfo.textContent = `Solicitação vinculada: ${item.id}`;

  if (els.userModalStatusNote) {
    els.userModalStatusNote.textContent =
      item.status === "pendente"
        ? "Esta solicitação está aguardando decisão do administrador."
        : item.status === "aprovado"
          ? "Esta solicitação já foi aprovada."
          : "Esta solicitação foi rejeitada.";
  }

  els.userModal.classList.remove("hidden");
  els.userModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!els.userModal) return;
  els.userModal.classList.add("hidden");
  els.userModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* =========================
   AUTH
========================= */
async function loadCurrentUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function fillSidebar() {
  if (els.sidebarUserName) {
    els.sidebarUserName.textContent = STATE.userDoc?.name || STATE.userDoc?.nome || "Usuário";
  }

  if (els.sidebarTerritoryLabel) {
    els.sidebarTerritoryLabel.textContent =
      STATE.userDoc?.territoryLabel ||
      STATE.userDoc?.territoryId ||
      "Sem território";
  }
}

/* =========================
   EVENTOS
========================= */
function bindEvents() {
  els.searchInput?.addEventListener("input", applyFilters);
  els.statusFilter?.addEventListener("change", applyFilters);
  els.operationFilter?.addEventListener("change", applyFilters);
  els.btnReload?.addEventListener("click", loadApprovalRequests);

  els.btnLogout?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;
    if (!id) return;

    if (action === "approve") {
      await approveRequest(id);
      return;
    }

    if (action === "reject") {
      await rejectRequest(id);
      return;
    }

    if (action === "open") {
      openModal(id);
    }
  });

  els.closeUserModal?.addEventListener("click", closeModal);
  els.modalCloseBtn?.addEventListener("click", closeModal);
  els.userModalBackdrop?.addEventListener("click", closeModal);

  els.modalApproveBtn?.addEventListener("click", async () => {
    const id = els.modalApprovalRequestId?.value;
    if (id) await approveRequest(id);
  });

  els.modalRejectBtn?.addEventListener("click", async () => {
    const id = els.modalApprovalRequestId?.value;
    if (id) await rejectRequest(id);
  });

  els.userModalForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = els.modalApprovalRequestId?.value;
    const status = els.modalUserStatus?.value || "pendente";

    if (!id) return;

    if (status === "aprovado") {
      await approveRequest(id);
      return;
    }

    if (status === "inativo") {
      await rejectRequest(id);
      return;
    }

    closeModal();
  });
}

/* =========================
   INIT
========================= */
bindEvents();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  STATE.authUser = user;
  STATE.user = user;
  STATE.userDoc = await loadCurrentUser(user.uid);

  fillSidebar();
  await loadApprovalRequests();
});