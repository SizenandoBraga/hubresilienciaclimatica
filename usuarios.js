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
  serverTimestamp
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
  mergedUsers: [],
  filteredUsers: [],
  territoryBase: DEFAULT_BASE,
  unsubParticipants: null,
  unsubApprovals: null
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

  if (["pending", "pendente", "pending_review", "pending_approval"].includes(raw)) {
    return "pendente";
  }
  if (["approved", "aprovado", "active", "ativo"].includes(raw)) {
    return "aprovado";
  }
  if (["inactive", "inativo", "rejected", "rejeitado", "blocked"].includes(raw)) {
    return "inativo";
  }

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

function getMyTerritoryId() {
  return STATE.userDoc?.territoryId || null;
}

function filterVisibleUsers(items) {
  if (canViewAllTerritories()) return items;

  const myTerritoryId = getMyTerritoryId();
  if (!myTerritoryId) return items;

  return items.filter((item) => sameTerritory(item.territoryId, myTerritoryId));
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
    raw: data
  };
}

function mapApprovalRequestDoc(docSnap) {
  const data = docSnap.data() || {};

  return {
    id: docSnap.id,
    participantId: data.participantId || null,
    participantName: data.participantName || "",
    participantCode: data.participantCode || "",
    territoryId: data.territoryId || null,
    territoryLabel: data.territoryLabel || "",
    status: String(data.status || "pending").toLowerCase(),
    raw: data
  };
}

function mergeUsers() {
  const participantById = new Map();
  const participantByApprovalRequestId = new Map();

  STATE.participants.forEach((participant) => {
    participantById.set(participant.id, participant);
    if (participant.approvalRequestId) {
      participantByApprovalRequestId.set(participant.approvalRequestId, participant);
    }
  });

  const mergedFromRequests = STATE.approvalRequests.map((req) => {
    const participant =
      participantById.get(req.participantId) ||
      participantByApprovalRequestId.get(req.id) ||
      null;

    const snapshot = req.raw?.applicantSnapshot || {};
    const snapshotAddress = snapshot.address || {};

    const requestStatus = String(req.status || "pending").toLowerCase();

    let status = "pendente";
    if (requestStatus === "approved") status = "aprovado";
    if (requestStatus === "rejected") status = "inativo";

    return {
      id: participant?.id || req.participantId || `approval_${req.id}`,
      linkedApprovalRequestId: req.id,
      approvalRequestId: req.id,

      name:
        participant?.name ||
        req.participantName ||
        snapshot.name ||
        "Solicitação pendente",

      code:
        participant?.code ||
        req.participantCode ||
        snapshot.participantCode ||
        "—",

      phone:
        participant?.phone ||
        snapshot.phone ||
        "",

      email:
        participant?.email ||
        snapshot.email ||
        "",

      cpf:
        participant?.cpf ||
        snapshot.cpf ||
        "",

      territoryId:
        participant?.territoryId ||
        req.territoryId ||
        snapshot.territoryId ||
        null,

      territoryLabel:
        participant?.territoryLabel ||
        req.territoryLabel ||
        snapshot.territoryLabel ||
        "",

      status,
      rawStatus: participant?.rawStatus || status,
      approvalStatus: participant?.approvalStatus || requestStatus,

      inOperation:
        status === "aprovado"
          ? (participant?.inOperation || "sim")
          : "nao",

      inTerritory:
        participant?.inTerritory ||
        (req.territoryId || snapshot.territoryId ? "sim" : "nao"),

      address:
        participant?.address ||
        buildAddress(snapshot) ||
        buildAddress({ address: snapshotAddress }) ||
        "—",

      lat:
        participant?.lat ??
        toNumberOrNull(snapshot.lat) ??
        toNumberOrNull(snapshotAddress.lat),

      lng:
        participant?.lng ??
        toNumberOrNull(snapshot.lng) ??
        toNumberOrNull(snapshotAddress.lng),

      schedule: participant?.schedule || "A definir",
      raw: participant?.raw || req.raw
    };
  });

  const requestIds = new Set(STATE.approvalRequests.map((req) => req.id));
  const participantIdsAlreadyMerged = new Set(
    mergedFromRequests
      .map((item) => item.id)
      .filter(Boolean)
  );

  const standaloneParticipants = STATE.participants
    .filter((participant) => {
      if (participant.approvalRequestId && requestIds.has(participant.approvalRequestId)) {
        return false;
      }
      if (participantIdsAlreadyMerged.has(participant.id)) {
        return false;
      }
      return true;
    })
    .map((participant) => ({
      ...participant,
      linkedApprovalRequestId: participant.approvalRequestId || null
    }));

  STATE.mergedUsers = filterVisibleUsers(
    [...mergedFromRequests, ...standaloneParticipants].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
    )
  );

  applyFilters();
}

function applyFilters() {
  const term = String(els.searchInput?.value || "").trim().toLowerCase();
  const status = String(els.statusFilter?.value || "all");
  const operation = String(els.operationFilter?.value || "all");

  STATE.filteredUsers = STATE.mergedUsers.filter((user) => {
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
  const active = STATE.filteredUsers.filter((u) => u.status === "aprovado" && u.inOperation === "sim").length;
  const geo = STATE.filteredUsers.filter((u) => isValidCoord(u.lat, u.lng)).length;

  els.kpiTotal.textContent = String(total);
  els.kpiPending.textContent = String(pending);
  els.kpiActive.textContent = String(active);
  els.kpiGeo.textContent = String(geo);

  els.pendingCountLabel.textContent = `${pending} itens`;
  els.activeCountLabel.textContent = `${active} itens`;
  els.tableCountLabel.textContent = `${total} registros`;
}

function renderPendingList() {
  const pending = STATE.filteredUsers.filter((u) => u.linkedApprovalRequestId && u.status === "pendente");

  els.pendingCountLabel.textContent = `${pending.length} itens`;

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
        <button class="btn btn-success" data-action="approve" data-id="${user.id}" type="button">Aprovar</button>
        <button class="btn btn-danger" data-action="reject" data-id="${user.id}" type="button">Rejeitar</button>
        <button class="btn btn-ghost" data-action="open" data-id="${user.id}" type="button">Abrir</button>
      </div>
    </article>
  `).join("");
}

function renderActiveList() {
  const active = STATE.filteredUsers.filter((u) => u.status === "aprovado" && u.inOperation === "sim");

  if (!active.length) {
    els.activeList.innerHTML = `<div class="empty-state">Nenhum participante em operação.</div>`;
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
  if (!STATE.filteredUsers.length) {
    els.usersTableBody.innerHTML = `<tr><td colspan="7">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  els.usersTableBody.innerHTML = STATE.filteredUsers.map((user) => `
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
          ${user.status === "pendente" ? `<button class="btn btn-success" data-action="approve" data-id="${user.id}" type="button">Aprovar</button>` : ""}
          ${user.status === "pendente" ? `<button class="btn btn-danger" data-action="reject" data-id="${user.id}" type="button">Rejeitar</button>` : ""}
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

  if (mode === "allgeo") {
    return STATE.filteredUsers.filter((u) => isValidCoord(u.lat, u.lng));
  }

  return STATE.filteredUsers.filter(
    (u) => u.status === "aprovado" && u.inOperation === "sim" && isValidCoord(u.lat, u.lng)
  );
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

  map.fitBounds(bounds, { padding: [30, 30] });
  els.mapPointsCount.textContent = String(points.length);
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
  const base = STATE.territoryBase || DEFAULT_BASE;
  const points = getMapUsers();

  if (!map) return;

  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }

  if (points.length === 0) {
    els.routeStatus.textContent = "Não há pontos com coordenadas para montar a rota.";
    els.routeDistance.textContent = "0 km";
    els.routeDuration.textContent = "0 min";
    els.routeInfo.textContent = "Rota: sem pontos";
    return;
  }

  const ordered = nearestNeighborOrder(base, points);
  const coords = [
    [base.lng, base.lat],
    ...ordered.map((item) => [item.lng, item.lat])
  ];

  try {
    els.routeStatus.textContent = "Calculando rota da cooperativa até os pontos...";
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

    els.routeDistance.textContent = formatDistanceKm(route.distance);
    els.routeDuration.textContent = formatDuration(route.duration);
    els.routeInfo.textContent = `Rota: ${ordered.length} pontos`;
    els.routeStatus.textContent = `Rota calculada com ${ordered.length} ponto(s) saindo da base da cooperativa.`;
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

    els.routeDistance.textContent = "Estimativa";
    els.routeDuration.textContent = "Estimativa";
    els.routeInfo.textContent = `Rota: ${ordered.length} pontos`;
    els.routeStatus.textContent = "Rota real indisponível no momento. Exibindo traçado sequencial dos pontos.";
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
  els.baseInfo.textContent = `Base da cooperativa: ${safeText(base.label)} • ${base.lat}, ${base.lng}`;
}

function renderAll() {
  computeKpis();
  renderPendingList();
  renderActiveList();
  renderTable();
  renderMap();
}

async function approveUser(userId) {
  const user = STATE.mergedUsers.find((item) => item.id === userId);
  if (!user) return;

  const approvalRequestId = user.linkedApprovalRequestId || user.approvalRequestId || null;

  try {
    const batch = writeBatch(db);

    if (user.id && !String(user.id).startsWith("approval_")) {
      batch.update(doc(db, "participants", user.id), {
        status: "aprovado",
        approvalStatus: "approved",
        active: true,
        inOperation: "sim",
        inTerritory: "sim",
        schedule: user.raw?.schedule || "A definir",
        updatedAt: serverTimestamp(),
        updatedBy: STATE.authUser?.uid || null
      });
    }

    if (approvalRequestId) {
      batch.update(doc(db, "approvalRequests", approvalRequestId), {
        status: "approved",
        active: false,
        resolvedAt: serverTimestamp(),
        resolvedBy: STATE.authUser?.uid || null,
        resolvedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    closeUserModal();
  } catch (error) {
    console.error("Erro ao aprovar usuário:", error);
    alert("Não foi possível aprovar este usuário.");
  }
}

async function rejectUser(userId) {
  const user = STATE.mergedUsers.find((item) => item.id === userId);
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
        active: false,
        resolvedAt: serverTimestamp(),
        resolvedBy: STATE.authUser?.uid || null,
        resolvedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null,
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    closeUserModal();
  } catch (error) {
    console.error("Erro ao rejeitar usuário:", error);
    alert("Não foi possível rejeitar este usuário.");
  }
}

function focusUserOnMap(userId) {
  const user = STATE.mergedUsers.find((item) => item.id === userId);
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
  const user = STATE.mergedUsers.find((item) => item.id === userId);
  if (!user) return;

  els.modalUserId.value = user.id;
  els.modalApprovalRequestId.value = user.linkedApprovalRequestId || user.approvalRequestId || "";
  els.modalUserName.value = user.name || "";
  els.modalUserCode.value = user.code || "";
  els.modalUserPhone.value = user.phone || "";
  els.modalUserStatus.value = user.status || "pendente";
  els.modalOperation.value = user.inOperation || "nao";
  els.modalTerritoryLabel.value = user.territoryLabel || user.territoryId || "";
  els.modalAddress.value = user.address || "";
  els.modalLat.value = user.lat ?? "";
  els.modalLng.value = user.lng ?? "";
  els.modalInOperationHint.value = user.inOperation === "sim" ? "Na rota operacional" : "Fora da rota";

  els.userModalStatusNote.textContent =
    user.status === "pendente"
      ? "Esta solicitação está aguardando decisão do administrador."
      : user.status === "aprovado"
        ? "Este participante está aprovado e pode operar na rota."
        : "Este participante está inativo ou rejeitado.";

  els.modalRequestInfo.textContent = user.linkedApprovalRequestId
    ? `Solicitação vinculada: ${user.linkedApprovalRequestId}`
    : "Sem solicitação vinculada.";

  els.userModal.classList.remove("hidden");
  els.userModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeUserModal() {
  els.userModal.classList.add("hidden");
  els.userModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function saveModalUserChanges() {
  const userId = els.modalUserId.value;
  if (!userId) return;

  const user = STATE.mergedUsers.find((item) => item.id === userId);
  if (!user) return;

  const approvalRequestId =
    els.modalApprovalRequestId.value ||
    user.linkedApprovalRequestId ||
    user.approvalRequestId ||
    null;

  const chosenStatus = els.modalUserStatus.value;
  const chosenOperation = chosenStatus === "aprovado" ? els.modalOperation.value : "nao";

  try {
    const batch = writeBatch(db);

    if (userId && !String(userId).startsWith("approval_")) {
      batch.update(doc(db, "participants", userId), {
        name: els.modalUserName.value.trim(),
        participantCode: els.modalUserCode.value.trim(),
        phone: onlyDigits(els.modalUserPhone.value),
        territoryLabel: els.modalTerritoryLabel.value.trim() || user.territoryLabel || "",
        enderecoCompleto: els.modalAddress.value.trim() || null,
        lat: toNumberOrNull(els.modalLat.value),
        lng: toNumberOrNull(els.modalLng.value),
        inOperation: chosenOperation,
        inTerritory: "sim",
        schedule: user.raw?.schedule || "A definir",
        status:
          chosenStatus === "aprovado"
            ? "aprovado"
            : chosenStatus === "inativo"
              ? "inativo"
              : "pendente",
        approvalStatus:
          chosenStatus === "aprovado"
            ? "approved"
            : chosenStatus === "inativo"
              ? "rejected"
              : "pending",
        active: chosenStatus === "aprovado",
        updatedAt: serverTimestamp(),
        updatedBy: STATE.authUser?.uid || null
      });
    }

    if (approvalRequestId) {
      batch.update(doc(db, "approvalRequests", approvalRequestId), {
        status:
          chosenStatus === "aprovado"
            ? "approved"
            : chosenStatus === "inativo"
              ? "rejected"
              : "pending",
        active: chosenStatus === "pendente",
        resolvedAt: chosenStatus === "pendente" ? null : serverTimestamp(),
        resolvedBy: chosenStatus === "pendente" ? null : (STATE.authUser?.uid || null),
        resolvedByName: chosenStatus === "pendente" ? null : (STATE.userDoc?.name || STATE.userDoc?.nome || null),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    closeUserModal();
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
          snap = await getDocs(
            query(collection(db, "participants"), where("territoryId", "==", myTerritoryId))
          );
        } catch (error) {
          console.warn("Fallback participants sem filtro:", error);
          snap = await getDocs(collection(db, "participants"));
        }
      } else {
        snap = await getDocs(collection(db, "participants"));
      }
    }

    STATE.participants = snap.docs.map(mapParticipantDoc);
    mergeUsers();
  } catch (error) {
    console.error("Erro ao carregar participants:", error);
    alert("Não foi possível carregar os participantes.");
  }
}

async function loadApprovalsInitial() {
  try {
    let snap;

    if (canViewAllTerritories()) {
      snap = await getDocs(collection(db, "approvalRequests"));
    } else {
      const myTerritoryId = getMyTerritoryId();

      if (myTerritoryId) {
        try {
          snap = await getDocs(
            query(collection(db, "approvalRequests"), where("territoryId", "==", myTerritoryId))
          );
        } catch (error) {
          console.warn("Fallback approvals sem filtro:", error);
          snap = await getDocs(collection(db, "approvalRequests"));
        }
      } else {
        snap = await getDocs(collection(db, "approvalRequests"));
      }
    }

    STATE.approvalRequests = snap.docs.map(mapApprovalRequestDoc);
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
    const ref = canViewAllTerritories()
      ? collection(db, "participants")
      : query(collection(db, "participants"), where("territoryId", "==", getMyTerritoryId()));

    STATE.unsubParticipants = onSnapshot(
      ref,
      (snapshot) => {
        STATE.participants = snapshot.docs.map(mapParticipantDoc);
        mergeUsers();
      },
      async (error) => {
        console.error("Erro no listener participants:", error);
        await loadParticipantsInitial();
      }
    );
  } catch (error) {
    console.error("Erro ao iniciar listener participants:", error);
  }
}

function startApprovalsListener() {
  if (STATE.unsubApprovals) {
    STATE.unsubApprovals();
    STATE.unsubApprovals = null;
  }

  try {
    const ref = canViewAllTerritories()
      ? collection(db, "approvalRequests")
      : query(collection(db, "approvalRequests"), where("territoryId", "==", getMyTerritoryId()));

    STATE.unsubApprovals = onSnapshot(
      ref,
      (snapshot) => {
        STATE.approvalRequests = snapshot.docs.map(mapApprovalRequestDoc);
        mergeUsers();
      },
      async (error) => {
        console.error("Erro no listener approvalRequests:", error);
        await loadApprovalsInitial();
      }
    );
  } catch (error) {
    console.error("Erro ao iniciar listener approvalRequests:", error);
  }
}

async function loadCurrentUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    throw new Error("Usuário autenticado sem documento em /users.");
  }
  return { id: snap.id, ...snap.data() };
}

function fillSidebar() {
  els.sidebarUserName.textContent = STATE.userDoc?.name || STATE.userDoc?.nome || "Usuário";
  els.sidebarTerritoryLabel.textContent = STATE.userDoc?.territoryLabel || STATE.userDoc?.territoryId || "Sem território";
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

    if (action === "approve") {
      await approveUser(userId);
      return;
    }

    if (action === "reject") {
      await rejectUser(userId);
      return;
    }

    if (action === "focus") {
      focusUserOnMap(userId);
      return;
    }

    if (action === "open") {
      openUserModal(userId);
    }
  });

  els.closeUserModal?.addEventListener("click", closeUserModal);
  els.modalCloseBtn?.addEventListener("click", closeUserModal);
  els.userModalBackdrop?.addEventListener("click", closeUserModal);

  els.modalFocusMap?.addEventListener("click", () => {
    const userId = els.modalUserId.value;
    if (userId) {
      focusUserOnMap(userId);
      closeUserModal();
    }
  });

  els.modalApproveBtn?.addEventListener("click", async () => {
    const userId = els.modalUserId.value;
    if (userId) await approveUser(userId);
  });

  els.modalRejectBtn?.addEventListener("click", async () => {
    const userId = els.modalUserId.value;
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

    if (map) {
      map.setView([STATE.territoryBase.lat, STATE.territoryBase.lng], 13);
    }

    await loadApprovalsInitial();
    await loadParticipantsInitial();

    startApprovalsListener();
    startParticipantsListener();

    setTimeout(async () => {
      renderMap();
      await buildRoute();
    }, 1200);
  } catch (error) {
    console.error(error);
    alert("Não foi possível carregar a página de gestão de usuários.");
  }
});