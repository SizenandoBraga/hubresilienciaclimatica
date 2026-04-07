import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const DEFAULT_BASE = {
  label: "Base da cooperativa",
  lat: -30.048729170292532,
  lng: -51.15652604283108
};

const STATE = {
  authUser: null,
  userDoc: null,
  participants: [],
  approvalRequests: [],
  users: [],
  filteredUsers: [],
  territoryBase: DEFAULT_BASE,
  unsubParticipants: null,
  unsubApprovals: null,
  lastPendingIds: new Set(),
  notificationPermissionAsked: false
};

const els = {
  btnLogout: document.getElementById("btnLogout"),
  sidebarUserName: document.getElementById("sidebarUserName"),
  sidebarTerritoryLabel: document.getElementById("sidebarTerritoryLabel"),
  baseInfo: document.getElementById("baseInfo"),
  routeInfo: document.getElementById("routeInfo"),
  kpiTotal: document.getElementById("kpiTotal"),
  kpiPending: document.getElementById("kpiPending"),
  kpiActive: document.getElementById("kpiActive"),
  kpiGeo: document.getElementById("kpiGeo"),
  searchInput: document.getElementById("searchInput"),
  statusFilter: document.getElementById("statusFilter"),
  operationFilter: document.getElementById("operationFilter"),
  routeMode: document.getElementById("routeMode"),
  btnReload: document.getElementById("btnReload"),
  pendingList: document.getElementById("pendingList"),
  activeList: document.getElementById("activeList"),
  pendingCountLabel: document.getElementById("pendingCountLabel"),
  activeCountLabel: document.getElementById("activeCountLabel"),
  usersTableBody: document.getElementById("usersTableBody"),
  tableCountLabel: document.getElementById("tableCountLabel"),
  usersMap: document.getElementById("usersMap"),
  btnCenterBase: document.getElementById("btnCenterBase"),
  btnBuildRoute: document.getElementById("btnBuildRoute"),
  mapPointsCount: document.getElementById("mapPointsCount"),
  routeDistance: document.getElementById("routeDistance"),
  routeDuration: document.getElementById("routeDuration"),
  routeStatus: document.getElementById("routeStatus"),
  userModal: document.getElementById("userModal"),
  userModalBackdrop: document.getElementById("userModalBackdrop"),
  closeUserModal: document.getElementById("closeUserModal"),
  modalCloseBtn: document.getElementById("modalCloseBtn"),
  userModalForm: document.getElementById("userModalForm"),
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
  modalFocusMap: document.getElementById("modalFocusMap"),
  modalRejectBtn: document.getElementById("modalRejectBtn"),
  modalApproveBtn: document.getElementById("modalApproveBtn")
};

let map = null;
let baseMarker = null;
let userMarkers = [];
let routePolyline = null;
let toastEl = null;

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function normalizeStatus(value) {
  const raw = String(value || "").toLowerCase().trim();

  if (["pending", "pendente", "pending_review", "pending_approval"].includes(raw)) return "pendente";
  if (["approved", "aprovado", "active", "ativo"].includes(raw)) return "aprovado";
  if (["inactive", "inativo", "rejected", "rejeitado", "blocked"].includes(raw)) return "inativo";

  return "pendente";
}

function badgeClass(status) {
  if (status === "aprovado") return "badge badge-aprovado";
  if (status === "inativo") return "badge badge-inativo";
  return "badge badge-pendente";
}

function formatDistanceKm(meters) {
  if (!Number.isFinite(meters)) return "0 km";
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "0 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min`;
}

function buildAddress(data) {
  if (data?.enderecoCompleto) return data.enderecoCompleto;
  if (data?.address?.addressLine) return data.address.addressLine;

  const rua = data?.rua || data?.address?.street || "";
  const numero = data?.numero || data?.address?.number || "";
  const bairro = data?.bairro || data?.address?.neighborhood || "";
  const cidade = data?.cidade || data?.address?.city || "";
  const uf = data?.uf || data?.address?.state || "";
  const cep = data?.cep || data?.address?.cep || "";

  return [
    [rua, numero].filter(Boolean).join(", "),
    [bairro, cidade, uf].filter(Boolean).join(" - "),
    cep ? `CEP ${cep}` : ""
  ].filter(Boolean).join(" • ");
}

function normalizeTerritory(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-")
    .trim();
}

function sameTerritory(a, b) {
  const x = normalizeTerritory(a);
  const y = normalizeTerritory(b);
  return x && y && x === y;
}

function canViewAllTerritories() {
  const role = String(STATE.userDoc?.role || "").toLowerCase();
  return ["governanca", "gestor", "superadmin", "admin_master"].includes(role);
}

function canManageApprovals() {
  const role = String(STATE.userDoc?.role || "").toLowerCase();
  return ["admin", "governanca", "gestor", "superadmin", "admin_master"].includes(role);
}

function getMyTerritoryId() {
  return STATE.userDoc?.territoryId || null;
}

function getMyTerritoryLabel() {
  return STATE.userDoc?.territoryLabel || null;
}

function getTerritoryIdFromAny(data) {
  return (
    data?.territoryId ||
    data?.payloadSnapshot?.territoryId ||
    data?.applicantSnapshot?.territoryId ||
    null
  );
}

function getTerritoryLabelFromAny(data) {
  return (
    data?.territoryLabel ||
    data?.payloadSnapshot?.territoryLabel ||
    data?.applicantSnapshot?.territoryLabel ||
    null
  );
}

function ensureToast() {
  if (toastEl) return toastEl;

  toastEl = document.createElement("div");
  Object.assign(toastEl.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "99999",
    padding: "14px 18px",
    borderRadius: "16px",
    background: "rgba(60,58,57,.94)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(0,0,0,.18)",
    fontFamily: '"Archivo Condensed", Arial, sans-serif',
    fontSize: "16px",
    maxWidth: "360px",
    opacity: "0",
    transform: "translateY(8px)",
    transition: "all .22s ease"
  });

  document.body.appendChild(toastEl);
  return toastEl;
}

function showToast(message) {
  const el = ensureToast();
  el.textContent = message;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
  }, 3500);
}

async function maybeRequestNotificationPermission() {
  if (STATE.notificationPermissionAsked) return;
  STATE.notificationPermissionAsked = true;

  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (_err) {}
  }
}

function notifyNewRequest(user) {
  showToast(`Nova solicitação: ${safeText(user.name)} • ${safeText(user.code)}`);

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("Nova solicitação de participação", {
        body: `${safeText(user.name)} • ${safeText(user.territoryLabel || user.territoryId)}`
      });
    } catch (_err) {}
  }
}

function patchTopbarLabels() {
  const pills = document.querySelectorAll(".topbar-right .status-pill");
  if (!pills.length) return;

  const role = String(STATE.userDoc?.role || "usuario").toLowerCase();
  const territory = STATE.userDoc?.territoryLabel || STATE.userDoc?.territoryId || "Sem território";
  const seesAll = canViewAllTerritories();

  if (pills[0]) pills[0].textContent = seesAll ? "🟢 Todos os territórios" : `🟢 ${territory}`;
  if (pills[1]) pills[1].textContent = "🏢 Cooperativa";
  if (pills[2]) pills[2].textContent = canManageApprovals() ? "🔐 Pode aprovar" : "🔐 Somente leitura";
  if (pills[3]) pills[3].textContent = `👤 ${role}`;
}

function filterVisibleUsers(items) {
  if (canViewAllTerritories()) return items;

  const myTerritoryId = getMyTerritoryId();
  const myTerritoryLabel = getMyTerritoryLabel();

  if (!myTerritoryId && !myTerritoryLabel) return items;

  return items.filter((item) => {
    const territoryId = getTerritoryIdFromAny(item.raw || item);
    const territoryLabel = getTerritoryLabelFromAny(item.raw || item);

    if (myTerritoryId && territoryId && sameTerritory(territoryId, myTerritoryId)) return true;
    if (myTerritoryLabel && territoryLabel && sameTerritory(territoryLabel, myTerritoryLabel)) return true;

    return false;
  });
}

function filterVisibleApprovalRequests(items) {
  if (canViewAllTerritories()) return items;

  const myTerritoryId = getMyTerritoryId();
  const myTerritoryLabel = getMyTerritoryLabel();

  if (!myTerritoryId && !myTerritoryLabel) return items;

  return items.filter((item) => {
    const reqTerritoryId = getTerritoryIdFromAny(item.raw || item);
    const reqTerritoryLabel = getTerritoryLabelFromAny(item.raw || item);

    if (myTerritoryId && reqTerritoryId && sameTerritory(reqTerritoryId, myTerritoryId)) return true;
    if (myTerritoryLabel && reqTerritoryLabel && sameTerritory(reqTerritoryLabel, myTerritoryLabel)) return true;

    return false;
  });
}

function mapParticipantDoc(docSnap) {
  const data = docSnap.data() || {};

  return {
    id: docSnap.id,
    name: data.name || data.nome || "Sem nome",
    code: data.participantCode || "—",
    phone: data.phone || "",
    email: data.email || "",
    cpf: data.cpf || "",
    territoryId: data.territoryId || null,
    territoryLabel: data.territoryLabel || "",
    status: normalizeStatus(data.status || data.approvalStatus),
    rawStatus: data.status || "",
    approvalStatus: data.approvalStatus || "",
    inOperation: data.inOperation === "sim" || data.inOperation === true ? "sim" : "nao",
    inTerritory: data.inTerritory === "sim" || data.inTerritory === true ? "sim" : "nao",
    approvalRequestId: data.approvalRequestId || null,
    address: buildAddress(data),
    lat: toNumberOrNull(data.lat) ?? toNumberOrNull(data.address?.lat),
    lng: toNumberOrNull(data.lng) ?? toNumberOrNull(data.address?.lng),
    schedule: data.schedule || "A definir",
    wasteKg: Number(data.wasteKg || 0),
    raw: data
  };
}

function mapApprovalRequestDoc(docSnap) {
  const data = docSnap.data() || {};
  const snapshot = data.payloadSnapshot || data.applicantSnapshot || {};

  return {
    id: docSnap.id,
    participantId: data.participantId || snapshot.participantId || data.targetId || null,
    participantName: data.participantName || data.name || snapshot.name || "Solicitação pendente",
    participantCode: data.participantCode || snapshot.participantCode || "—",
    territoryId: data.territoryId || snapshot.territoryId || null,
    territoryLabel: data.territoryLabel || snapshot.territoryLabel || "",
    status: String(data.status || data.approvalStatus || "pending").toLowerCase().trim(),
    raw: data
  };
}

function buildUserDedupKey(user) {
  return [
    user.linkedApprovalRequestId || user.approvalRequestId || "",
    user.id || "",
    user.code || "",
    user.cpf || "",
    onlyDigits(user.phone || "")
  ].join("|").toLowerCase();
}

function mergeUsers() {
  const participantById = new Map();
  const participantByApprovalRequestId = new Map();
  const participantByCode = new Map();
  const participantByCpf = new Map();
  const participantByPhone = new Map();

  STATE.participants.forEach((participant) => {
    participantById.set(participant.id, participant);
    if (participant.approvalRequestId) participantByApprovalRequestId.set(participant.approvalRequestId, participant);
    if (participant.code && participant.code !== "—") participantByCode.set(String(participant.code).toLowerCase(), participant);
    if (participant.cpf) participantByCpf.set(String(participant.cpf).replace(/\D/g, ""), participant);
    if (participant.phone) participantByPhone.set(onlyDigits(participant.phone), participant);
  });

  const mergedFromRequests = STATE.approvalRequests
    .filter((req) => {
      const status = String(req.status || "").toLowerCase().trim();
      return !["approved", "rejected"].includes(status);
    })
    .map((req) => {
      const raw = req.raw || {};
      const snapshot = raw.payloadSnapshot || raw.applicantSnapshot || {};
      const participant =
        participantById.get(req.participantId) ||
        participantByApprovalRequestId.get(req.id) ||
        participantByCode.get(String(req.participantCode || snapshot.participantCode || "").toLowerCase()) ||
        participantByCpf.get(String(raw.participantCpf || snapshot.cpf || "").replace(/\D/g, "")) ||
        participantByPhone.get(onlyDigits(raw.participantPhone || snapshot.phone || "")) ||
        null;

      return {
        id: participant?.id || req.participantId || `approval_${req.id}`,
        linkedApprovalRequestId: req.id,
        approvalRequestId: req.id,
        name: participant?.name || req.participantName || snapshot.name || "Solicitação pendente",
        code: participant?.code || req.participantCode || snapshot.participantCode || "—",
        phone: participant?.phone || raw.participantPhone || snapshot.phone || "",
        email: participant?.email || raw.participantEmail || snapshot.email || "",
        cpf: participant?.cpf || raw.participantCpf || snapshot.cpf || "",
        territoryId: participant?.territoryId || req.territoryId || snapshot.territoryId || null,
        territoryLabel: participant?.territoryLabel || req.territoryLabel || snapshot.territoryLabel || "",
        status: "pendente",
        rawStatus: participant?.rawStatus || "pendente",
        approvalStatus: participant?.approvalStatus || "pending",
        inOperation: "nao",
        inTerritory: participant?.inTerritory || ((req.territoryId || snapshot.territoryId) ? "sim" : "nao"),
        address: participant?.address || buildAddress(snapshot) || "—",
        lat: participant?.lat ?? toNumberOrNull(snapshot.lat),
        lng: participant?.lng ?? toNumberOrNull(snapshot.lng),
        schedule: participant?.schedule || "A definir",
        wasteKg: Number(participant?.wasteKg || 0),
        raw
      };
    });

  const pendingRequestIds = new Set(
    STATE.approvalRequests
      .filter((req) => {
        const status = String(req.status || "").toLowerCase().trim();
        return !["approved", "rejected"].includes(status);
      })
      .map((req) => req.id)
  );

  const standaloneParticipants = STATE.participants
    .filter((participant) => {
      if (participant.status === "inativo") return false;
      if (participant.approvalRequestId && pendingRequestIds.has(participant.approvalRequestId)) return false;
      return true;
    })
    .map((participant) => ({
      ...participant,
      linkedApprovalRequestId: participant.approvalRequestId || null
    }));

  const dedupMap = new Map();

  [...mergedFromRequests, ...standaloneParticipants]
    .filter((item) => item.status !== "inativo")
    .forEach((item) => {
      const key = buildUserDedupKey(item);
      const existing = dedupMap.get(key);

      if (!existing) {
        dedupMap.set(key, item);
        return;
      }

      const existingIsPending = existing.status === "pendente";
      const currentIsApproved = item.status === "aprovado";

      if (existingIsPending && currentIsApproved) {
        dedupMap.set(key, item);
      }
    });

  STATE.users = filterVisibleUsers(
    Array.from(dedupMap.values()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
    )
  );

  emitPendingNotifications();
  applyFilters();
}

function emitPendingNotifications() {
  const currentPendingIds = new Set(
    STATE.users
      .filter((u) => u.linkedApprovalRequestId && u.status === "pendente")
      .map((u) => u.linkedApprovalRequestId)
  );

  currentPendingIds.forEach((id) => {
    if (!STATE.lastPendingIds.has(id)) {
      const user = STATE.users.find((u) => u.linkedApprovalRequestId === id);
      if (user) notifyNewRequest(user);
    }
  });

  STATE.lastPendingIds = currentPendingIds;
}

function applyFilters() {
  const term = String(els.searchInput?.value || "").trim().toLowerCase();
  const status = String(els.statusFilter?.value || "all");
  const operation = String(els.operationFilter?.value || "all");

  STATE.filteredUsers = STATE.users.filter((user) => {
    const matchesTerm =
      !term ||
      String(user.name || "").toLowerCase().includes(term) ||
      String(user.code || "").toLowerCase().includes(term) ||
      String(user.phone || "").toLowerCase().includes(term) ||
      String(user.email || "").toLowerCase().includes(term) ||
      String(user.cpf || "").toLowerCase().includes(term) ||
      String(user.address || "").toLowerCase().includes(term);

    const matchesStatus = status === "all" || user.status === status;
    const matchesOperation = operation === "all" || user.inOperation === operation;

    return matchesTerm && matchesStatus && matchesOperation;
  });

  renderAll();
}

function computeKpis() {
  const total = STATE.filteredUsers.length;
  const pending = STATE.filteredUsers.filter((u) => u.linkedApprovalRequestId && u.status === "pendente").length;
  const active = STATE.filteredUsers.filter((u) => u.status === "aprovado").length;
  const geo = STATE.filteredUsers.filter((u) => isValidCoord(u.lat, u.lng)).length;

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

  const pending = STATE.filteredUsers.filter((u) => u.linkedApprovalRequestId && u.status === "pendente");

  if (!pending.length) {
    els.pendingList.innerHTML = `<div class="empty-state">Nenhuma solicitação pendente no momento.</div>`;
    return;
  }

  els.pendingList.innerHTML = pending.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${safeText(user.name)}</strong>
        <span>Código: ${safeText(user.code)}</span>
        <span>Telefone: ${safeText(user.phone)}</span>
        <span>${safeText(user.address)}</span>
      </div>
      <div class="user-actions">
        <span class="${badgeClass(user.status)}">Pendente</span>
        ${canManageApprovals() ? `<button class="btn btn-success" data-action="approve" data-id="${user.id}" type="button">Aprovar</button>` : ""}
        ${canManageApprovals() ? `<button class="btn btn-danger" data-action="reject" data-id="${user.id}" type="button">Rejeitar</button>` : ""}
        <button class="btn btn-ghost" data-action="open" data-id="${user.id}" type="button">Abrir</button>
      </div>
    </article>
  `).join("");
}

function renderActiveList() {
  if (!els.activeList) return;

  const active = STATE.filteredUsers.filter((u) => u.status === "aprovado");

  if (!active.length) {
    els.activeList.innerHTML = `<div class="empty-state">Nenhum participante aprovado no momento.</div>`;
    return;
  }

  els.activeList.innerHTML = active.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${safeText(user.name)}</strong>
        <span>${safeText(user.address)}</span>
        <span>Telefone: ${safeText(user.phone)}</span>
      </div>
      <div class="user-actions">
        <span class="${badgeClass(user.status)}">Aprovado</span>
        <button class="btn btn-ghost" data-action="focus" data-id="${user.id}" type="button">Ver no mapa</button>
        <button class="btn btn-ghost" data-action="open" data-id="${user.id}" type="button">Abrir</button>
      </div>
    </article>
  `).join("");
}

function renderTable() {
  if (!els.usersTableBody) return;

  const allUsers = STATE.filteredUsers.filter((u) => u.status !== "inativo");

  if (!allUsers.length) {
    els.usersTableBody.innerHTML = `<tr><td colspan="7">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  els.usersTableBody.innerHTML = allUsers.map((user) => `
    <tr>
      <td>
        <strong>${safeText(user.name)}</strong><br>
        <small>${safeText(user.code)}</small><br>
        <small>${safeText(user.phone)}</small>
      </td>
      <td><span class="${badgeClass(user.status)}">${safeText(user.status)}</span></td>
      <td>${user.inOperation === "sim" ? "Em operação" : "Fora da operação"}</td>
      <td>${safeText(user.territoryLabel || user.territoryId)}</td>
      <td>${safeText(user.address)}</td>
      <td>${isValidCoord(user.lat, user.lng) ? `${user.lat}, ${user.lng}` : "Sem coordenadas"}</td>
      <td>
        <div class="table-actions">
          ${canManageApprovals() && user.status === "pendente" ? `<button class="btn btn-success" data-action="approve" data-id="${user.id}" type="button">Aprovar</button>` : ""}
          ${canManageApprovals() && user.status === "pendente" ? `<button class="btn btn-danger" data-action="reject" data-id="${user.id}" type="button">Rejeitar</button>` : ""}
          <button class="btn btn-ghost" data-action="focus" data-id="${user.id}" type="button">Mapa</button>
          <button class="btn btn-ghost" data-action="open" data-id="${user.id}" type="button">Abrir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function initMap() {
  if (!els.usersMap || typeof L === "undefined" || map) return;

  map = L.map("usersMap").setView([STATE.territoryBase.lat, STATE.territoryBase.lng], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
}

function clearMap() {
  if (!map) return;

  userMarkers.forEach((marker) => map.removeLayer(marker));
  userMarkers = [];

  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }

  if (baseMarker) {
    map.removeLayer(baseMarker);
    baseMarker = null;
  }
}

function getMapUsers() {
  const mode = String(els.routeMode?.value || "approved");
  const source = STATE.filteredUsers.filter((u) => u.status !== "inativo" && isValidCoord(u.lat, u.lng));
  if (mode === "allgeo") return source;
  return source.filter((u) => u.status === "aprovado");
}

function renderMap() {
  if (!map) return;

  clearMap();

  const base = STATE.territoryBase || DEFAULT_BASE;
  const points = getMapUsers();

  baseMarker = L.marker([base.lat, base.lng]).addTo(map);
  baseMarker.bindPopup(`<strong>${safeText(base.label)}</strong>`);

  const bounds = [[base.lat, base.lng]];

  points.forEach((user) => {
    const marker = L.marker([user.lat, user.lng]).addTo(map);
    marker.bindPopup(`
      <strong>${safeText(user.name)}</strong><br>
      Código: ${safeText(user.code)}<br>
      Endereço: ${safeText(user.address)}<br>
      Status: ${safeText(user.status)}<br>
      Operação: ${user.inOperation === "sim" ? "Sim" : "Não"}
    `);

    userMarkers.push(marker);
    bounds.push([user.lat, user.lng]);
  });

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([base.lat, base.lng], 13);
  }

  if (els.mapPointsCount) els.mapPointsCount.textContent = String(points.length);
}

function nearestNeighborOrder(base, users) {
  const remaining = [...users];
  const ordered = [];
  let current = { lat: base.lat, lng: base.lng };

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    remaining.forEach((user, index) => {
      const dx = current.lat - user.lat;
      const dy = current.lng - user.lng;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = index;
      }
    });

    const next = remaining.splice(bestIndex, 1)[0];
    ordered.push(next);
    current = next;
  }

  return ordered;
}

async function buildRoute() {
  if (!map) return;

  const base = STATE.territoryBase || DEFAULT_BASE;
  const points = getMapUsers();

  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }

  if (!points.length) {
    if (els.routeStatus) els.routeStatus.textContent = "Não há pontos com coordenadas para montar a rota.";
    if (els.routeDistance) els.routeDistance.textContent = "0 km";
    if (els.routeDuration) els.routeDuration.textContent = "0 min";
    if (els.routeInfo) els.routeInfo.textContent = "Rota: sem pontos";
    return;
  }

  const ordered = nearestNeighborOrder(base, points);
  const coords = [
    [base.lng, base.lat],
    ...ordered.map((item) => [item.lng, item.lat])
  ];

  try {
    if (els.routeStatus) els.routeStatus.textContent = "Calculando rota da cooperativa até os pontos...";
    const url = `https://router.project-osrm.org/route/v1/driving/${coords.map((p) => `${p[0]},${p[1]}`).join(";")}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || !data?.routes?.length) {
      throw new Error("Falha ao calcular rota real.");
    }

    const route = data.routes[0];
    const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    routePolyline = L.polyline(latlngs, {
      weight: 5,
      opacity: 0.85
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });

    if (els.routeDistance) els.routeDistance.textContent = formatDistanceKm(route.distance);
    if (els.routeDuration) els.routeDuration.textContent = formatDuration(route.duration);
    if (els.routeInfo) els.routeInfo.textContent = `Rota: ${ordered.length} pontos`;
    if (els.routeStatus) els.routeStatus.textContent = `Rota calculada com ${ordered.length} ponto(s) saindo da base da cooperativa.`;
  } catch (error) {
    console.error("Erro ao calcular rota:", error);

    const fallback = [
      [base.lat, base.lng],
      ...ordered.map((item) => [item.lat, item.lng])
    ];

    routePolyline = L.polyline(fallback, {
      weight: 5,
      opacity: 0.85,
      dashArray: "10, 8"
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });

    if (els.routeDistance) els.routeDistance.textContent = "Estimativa";
    if (els.routeDuration) els.routeDuration.textContent = "Estimativa";
    if (els.routeInfo) els.routeInfo.textContent = `Rota: ${ordered.length} pontos`;
    if (els.routeStatus) els.routeStatus.textContent = "Rota real indisponível no momento. Exibindo traçado sequencial dos pontos.";
  }
}

async function loadTerritoryBase() {
  const userLat = toNumberOrNull(STATE.userDoc?.cooperativeBaseLat);
  const userLng = toNumberOrNull(STATE.userDoc?.cooperativeBaseLng);

  if (isValidCoord(userLat, userLng)) {
    STATE.territoryBase = {
      label: STATE.userDoc?.cooperativeBaseLabel || "Base da cooperativa",
      lat: userLat,
      lng: userLng
    };
  } else {
    STATE.territoryBase = DEFAULT_BASE;
  }

  updateBaseInfo();
}

function updateBaseInfo() {
  const base = STATE.territoryBase || DEFAULT_BASE;
  if (els.baseInfo) {
    els.baseInfo.textContent = `Base da cooperativa: ${safeText(base.label)} • ${base.lat}, ${base.lng}`;
  }
}

function renderAll() {
  computeKpis();
  renderPendingList();
  renderActiveList();
  renderTable();
  renderMap();
}

async function upsertParticipantFromApprovedRequest(user) {
  const participantId =
    user.id && !String(user.id).startsWith("approval_")
      ? user.id
      : (user.code ? user.code.replace(/[^a-zA-Z0-9_-]/g, "_") : `participant_${user.linkedApprovalRequestId}`);

  const snapshot = user.raw?.payloadSnapshot || user.raw?.applicantSnapshot || {};

  const payload = {
    name: user.name || snapshot.name || "Sem nome",
    nameLower: String(user.name || snapshot.name || "").toLowerCase(),
    participantCode: user.code || snapshot.participantCode || "—",
    participantType: snapshot.participantType || "participante",
    localType: snapshot.localType || user.raw?.localType || "casa",
    phone: user.phone || snapshot.phone || null,
    email: user.email || snapshot.email || null,
    cpf: user.cpf || snapshot.cpf || null,
    territoryId: user.territoryId || snapshot.territoryId || null,
    territoryLabel: user.territoryLabel || snapshot.territoryLabel || "",
    inTerritory: "sim",
    inOperation: user.inOperation || "sim",
    schedule: user.schedule || "A definir",
    status: "aprovado",
    approvalStatus: "approved",
    active: true,
    approvalRequestId: user.linkedApprovalRequestId || null,
    source: user.raw?.source || "approval_request",
    address: snapshot.address || null,
    enderecoCompleto: user.address || snapshot.enderecoCompleto || null,
    lat: isValidCoord(user.lat, user.lng) ? user.lat : (toNumberOrNull(snapshot.lat) ?? null),
    lng: isValidCoord(user.lat, user.lng) ? user.lng : (toNumberOrNull(snapshot.lng) ?? null),
    updatedAt: serverTimestamp(),
    updatedBy: STATE.authUser?.uid || null
  };

  await setDoc(doc(db, "participants", participantId), payload, { merge: true });
}

async function approveUser(userId) {
  if (!canManageApprovals()) {
    alert("Seu perfil não tem permissão para aprovar participantes.");
    return;
  }

  const user = STATE.users.find((item) => item.id === userId);
  if (!user) return;

  const approvalRequestId = user.linkedApprovalRequestId || user.approvalRequestId || null;

  try {
    const batch = writeBatch(db);

    if (approvalRequestId) {
      batch.update(doc(db, "approvalRequests", approvalRequestId), {
        status: "approved",
        decision: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: STATE.authUser?.uid || null,
        reviewedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null
      });
    }

    await batch.commit();

    await upsertParticipantFromApprovedRequest({
      ...user,
      status: "aprovado",
      inOperation: "sim"
    });

    closeUserModal();
    showToast("Participante aprovado com sucesso.");

    await loadApprovalsInitial();
    await loadParticipantsInitial();
  } catch (error) {
    console.error("Erro ao aprovar usuário:", error);
    alert(`Não foi possível aprovar este usuário.\n${error?.message || "Verifique as regras do Firestore."}`);
  }
}

async function rejectUser(userId) {
  if (!canManageApprovals()) {
    alert("Seu perfil não tem permissão para rejeitar participantes.");
    return;
  }

  const user = STATE.users.find((item) => item.id === userId);
  if (!user) return;

  const approvalRequestId = user.linkedApprovalRequestId || user.approvalRequestId || null;

  try {
    const batch = writeBatch(db);

    if (user.id && !String(user.id).startsWith("approval_")) {
      batch.update(doc(db, "participants", user.id), {
        status: "inativo",
        approvalStatus: "rejected",
        active: false,
        inOperation: "nao",
        inTerritory: "sim",
        updatedAt: serverTimestamp(),
        updatedBy: STATE.authUser?.uid || null
      });
    }

    if (approvalRequestId) {
      batch.update(doc(db, "approvalRequests", approvalRequestId), {
        status: "rejected",
        decision: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: STATE.authUser?.uid || null,
        reviewedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null
      });
    }

    await batch.commit();
    closeUserModal();
    showToast("Solicitação rejeitada.");

    await loadApprovalsInitial();
    await loadParticipantsInitial();
  } catch (error) {
    console.error("Erro ao rejeitar usuário:", error);
    alert(`Não foi possível rejeitar este usuário.\n${error?.message || "Verifique as regras do Firestore."}`);
  }
}

function focusUserOnMap(userId) {
  const user = STATE.users.find((item) => item.id === userId);
  if (!user || !isValidCoord(user.lat, user.lng) || !map) return;

  map.setView([user.lat, user.lng], 16);

  userMarkers.forEach((marker) => {
    const pos = marker.getLatLng();
    if (Math.abs(pos.lat - user.lat) < 0.000001 && Math.abs(pos.lng - user.lng) < 0.000001) {
      marker.openPopup();
    }
  });
}

function openUserModal(userId) {
  const user = STATE.users.find((item) => item.id === userId);
  if (!user || !els.userModal) return;

  if (els.modalUserId) els.modalUserId.value = user.id;
  if (els.modalApprovalRequestId) els.modalApprovalRequestId.value = user.linkedApprovalRequestId || user.approvalRequestId || "";
  if (els.modalUserName) els.modalUserName.value = user.name || "";
  if (els.modalUserCode) els.modalUserCode.value = user.code || "";
  if (els.modalUserPhone) els.modalUserPhone.value = user.phone || "";
  if (els.modalUserStatus) els.modalUserStatus.value = user.status || "pendente";
  if (els.modalOperation) els.modalOperation.value = user.inOperation || "nao";
  if (els.modalTerritoryLabel) els.modalTerritoryLabel.value = user.territoryLabel || user.territoryId || "";
  if (els.modalAddress) els.modalAddress.value = user.address || "";
  if (els.modalLat) els.modalLat.value = user.lat ?? "";
  if (els.modalLng) els.modalLng.value = user.lng ?? "";
  if (els.modalInOperationHint) els.modalInOperationHint.value = user.inOperation === "sim" ? "Na rota operacional" : "Fora da rota";

  if (els.modalRequestInfo) {
    els.modalRequestInfo.textContent = user.linkedApprovalRequestId
      ? `Solicitação vinculada: ${user.linkedApprovalRequestId}`
      : "Sem solicitação vinculada.";
  }

  if (els.userModalStatusNote) {
    els.userModalStatusNote.textContent =
      user.status === "pendente"
        ? "Esta solicitação está aguardando decisão do administrador."
        : user.status === "aprovado"
          ? "Este participante está aprovado e pode operar na rota."
          : "Este participante está inativo ou rejeitado.";
  }

  if (els.modalApproveBtn) els.modalApproveBtn.style.display = canManageApprovals() ? "" : "none";
  if (els.modalRejectBtn) els.modalRejectBtn.style.display = canManageApprovals() ? "" : "none";

  els.userModal.classList.remove("hidden");
  els.userModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeUserModal() {
  if (!els.userModal) return;
  els.userModal.classList.add("hidden");
  els.userModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function saveModalUserChanges() {
  const userId = els.modalUserId?.value;
  if (!userId) return;

  const user = STATE.users.find((item) => item.id === userId);
  if (!user) return;

  const approvalRequestId =
    els.modalApprovalRequestId?.value ||
    user.linkedApprovalRequestId ||
    user.approvalRequestId ||
    null;

  const chosenStatus = els.modalUserStatus?.value || user.status;
  const chosenOperation = chosenStatus === "aprovado" ? (els.modalOperation?.value || "sim") : "nao";

  try {
    if (approvalRequestId && canManageApprovals()) {
      const batch = writeBatch(db);
      batch.update(doc(db, "approvalRequests", approvalRequestId), {
        status: chosenStatus === "aprovado" ? "approved" : chosenStatus === "inativo" ? "rejected" : "pending"
      });
      await batch.commit();
    }

    if (chosenStatus === "aprovado") {
      await upsertParticipantFromApprovedRequest({
        ...user,
        name: els.modalUserName?.value?.trim() || user.name,
        code: els.modalUserCode?.value?.trim() || user.code,
        phone: onlyDigits(els.modalUserPhone?.value || user.phone),
        territoryLabel: els.modalTerritoryLabel?.value?.trim() || user.territoryLabel,
        address: els.modalAddress?.value?.trim() || user.address,
        lat: toNumberOrNull(els.modalLat?.value) ?? user.lat,
        lng: toNumberOrNull(els.modalLng?.value) ?? user.lng,
        inOperation: chosenOperation,
        status: "aprovado"
      });
    }

    closeUserModal();
    showToast("Alterações salvas.");

    await loadApprovalsInitial();
    await loadParticipantsInitial();
  } catch (error) {
    console.error("Erro ao salvar alterações:", error);
    alert("Não foi possível salvar as alterações do participante.");
  }
}

async function loadParticipantsInitial() {
  try {
    let snap;

    if (canViewAllTerritories()) {
      snap = await getDocs(collection(db, "participants"));
    } else {
      const myTerritoryId = getMyTerritoryId();

      if (myTerritoryId) {
        try {
          snap = await getDocs(query(collection(db, "participants"), where("territoryId", "==", myTerritoryId)));
        } catch (_err) {
          snap = await getDocs(collection(db, "participants"));
        }
      } else {
        snap = await getDocs(collection(db, "participants"));
      }
    }

    STATE.participants = filterVisibleUsers(snap.docs.map(mapParticipantDoc));
    mergeUsers();
  } catch (error) {
    console.error("Erro ao carregar participants:", error);
  }
}

async function loadApprovalsInitial() {
  try {
    const snap = await getDocs(collection(db, "approvalRequests"));
    const allApprovals = snap.docs.map(mapApprovalRequestDoc);

    STATE.approvalRequests = filterVisibleApprovalRequests(allApprovals).filter((req) => {
      const status = String(req.status || "").toLowerCase().trim();
      return !["approved", "rejected"].includes(status);
    });

    mergeUsers();
  } catch (error) {
    console.error("Erro ao carregar approvalRequests:", error);
  }
}

function startParticipantsListener() {
  if (STATE.unsubParticipants) {
    STATE.unsubParticipants();
    STATE.unsubParticipants = null;
  }

  try {
    const myTerritoryId = getMyTerritoryId();
    const ref = canViewAllTerritories() || !myTerritoryId
      ? collection(db, "participants")
      : query(collection(db, "participants"), where("territoryId", "==", myTerritoryId));

    STATE.unsubParticipants = onSnapshot(
      ref,
      async (snapshot) => {
        let items = snapshot.docs.map(mapParticipantDoc);

        if (!canViewAllTerritories()) {
          items = filterVisibleUsers(items);

          if (!items.length && myTerritoryId) {
            try {
              const fallbackSnap = await getDocs(collection(db, "participants"));
              items = filterVisibleUsers(fallbackSnap.docs.map(mapParticipantDoc));
            } catch (err) {
              console.warn("Fallback de participants falhou:", err);
            }
          }
        }

        STATE.participants = items;
        mergeUsers();
      },
      async () => {
        await loadParticipantsInitial();
      }
    );
  } catch (_error) {}
}

function startApprovalsListener() {
  if (STATE.unsubApprovals) {
    STATE.unsubApprovals();
    STATE.unsubApprovals = null;
  }

  try {
    STATE.unsubApprovals = onSnapshot(
      collection(db, "approvalRequests"),
      (snapshot) => {
        const allItems = snapshot.docs.map(mapApprovalRequestDoc);

        STATE.approvalRequests = filterVisibleApprovalRequests(allItems).filter((req) => {
          const status = String(req.status || "").toLowerCase().trim();
          return !["approved", "rejected"].includes(status);
        });

        mergeUsers();
      },
      async () => {
        await loadApprovalsInitial();
      }
    );
  } catch (error) {
    console.warn("Erro ao iniciar listener de approvalRequests:", error);
  }
}

async function loadCurrentUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário autenticado sem documento em /users.");
  return { id: snap.id, ...snap.data() };
}

function fillSidebar() {
  if (els.sidebarUserName) {
    els.sidebarUserName.textContent = STATE.userDoc?.name || STATE.userDoc?.nome || "Usuário";
  }
  if (els.sidebarTerritoryLabel) {
    els.sidebarTerritoryLabel.textContent = STATE.userDoc?.territoryLabel || STATE.userDoc?.territoryId || "Sem território";
  }
  patchTopbarLabels();
}

function bindEvents() {
  els.searchInput?.addEventListener("input", applyFilters);
  els.statusFilter?.addEventListener("change", applyFilters);
  els.operationFilter?.addEventListener("change", applyFilters);

  els.routeMode?.addEventListener("change", async () => {
    renderMap();
    await buildRoute();
  });

  els.btnReload?.addEventListener("click", async () => {
    await loadApprovalsInitial();
    await loadParticipantsInitial();
    await buildRoute();
    showToast("Dados atualizados.");
  });

  els.btnCenterBase?.addEventListener("click", () => {
    const base = STATE.territoryBase || DEFAULT_BASE;
    if (!map) return;
    map.setView([base.lat, base.lng], 15);
    if (baseMarker) baseMarker.openPopup();
  });

  els.btnBuildRoute?.addEventListener("click", async () => {
    await buildRoute();
  });

  els.btnLogout?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "/login.html";
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const userId = button.dataset.id;
    if (!userId) return;

    if (action === "approve") return approveUser(userId);
    if (action === "reject") return rejectUser(userId);
    if (action === "focus") return focusUserOnMap(userId);
    if (action === "open") return openUserModal(userId);
  });

  els.closeUserModal?.addEventListener("click", closeUserModal);
  els.modalCloseBtn?.addEventListener("click", closeUserModal);
  els.userModalBackdrop?.addEventListener("click", closeUserModal);

  els.modalFocusMap?.addEventListener("click", () => {
    const userId = els.modalUserId?.value;
    if (userId) {
      focusUserOnMap(userId);
      closeUserModal();
    }
  });

  els.modalApproveBtn?.addEventListener("click", async () => {
    const userId = els.modalUserId?.value;
    if (userId) await approveUser(userId);
  });

  els.modalRejectBtn?.addEventListener("click", async () => {
    const userId = els.modalUserId?.value;
    if (userId) await rejectUser(userId);
  });

  els.userModalForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveModalUserChanges();
  });
}

initMap();
bindEvents();

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    STATE.authUser = user;
    STATE.userDoc = await loadCurrentUser(user.uid);

    fillSidebar();
    await loadTerritoryBase();
    await maybeRequestNotificationPermission();

    if (map) map.setView([STATE.territoryBase.lat, STATE.territoryBase.lng], 13);

    await loadApprovalsInitial();
    await loadParticipantsInitial();

    startApprovalsListener();
    startParticipantsListener();

    setTimeout(async () => {
      renderMap();
      await buildRoute();
    }, 600);
  } catch (error) {
    console.error(error);
    alert("Não foi possível carregar a página de gestão de usuários.");
  }
});