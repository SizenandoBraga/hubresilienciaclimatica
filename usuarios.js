import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
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

const els = {
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
  routeStatus: document.getElementById("routeStatus")
};

const STATE = {
  authUser: null,
  userDoc: null,
  participants: [],
  approvalRequests: [],
  mergedUsers: [],
  filteredUsers: [],
  territoryBase: null,
  unsubParticipants: null,
  unsubApprovals: null
};

let map = null;
let baseMarker = null;
let userMarkers = [];
let routePolyline = null;

const DEFAULT_BASE = {
  label: "Base cooperativa",
  lat: -30.048729170292532,
  lng: -51.15652604283108
};

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

function statusBadge(status) {
  if (status === "aprovado") return "badge badge-approved";
  if (status === "inativo") return "badge badge-inactive";
  return "badge badge-pending";
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

  const line1 = [rua, numero].filter(Boolean).join(", ");
  const line2 = [bairro, cidade, uf].filter(Boolean).join(" - ");
  const line3 = cep ? `CEP ${cep}` : "";

  return [line1, line2, line3].filter(Boolean).join(" • ");
}

function canViewAllTerritories() {
  const role = String(STATE.userDoc?.role || "").toLowerCase();
  return ["governanca", "gestor", "superadmin", "admin_master"].includes(role);
}

function getMyTerritoryId() {
  return STATE.userDoc?.territoryId || null;
}

function makeScopedQuery(collectionName) {
  if (canViewAllTerritories()) {
    return collection(db, collectionName);
  }

  const territoryId = getMyTerritoryId();
  if (!territoryId) {
    throw new Error("Usuário sem territoryId definido.");
  }

  return query(collection(db, collectionName), where("territoryId", "==", territoryId));
}

function mapParticipantDoc(docSnap) {
  const data = docSnap.data() || {};

  const lat =
    toNumberOrNull(data.lat) ??
    toNumberOrNull(data.address?.lat) ??
    toNumberOrNull(data.geo?.lat);

  const lng =
    toNumberOrNull(data.lng) ??
    toNumberOrNull(data.address?.lng) ??
    toNumberOrNull(data.geo?.lng);

  return {
    id: docSnap.id,
    name: data.name || data.nome || "Sem nome",
    code: data.participantCode || "—",
    phone: data.phone || "",
    territoryId: data.territoryId || null,
    territoryLabel: data.territoryLabel || "",
    status: normalizeStatus(data.approvalStatus || data.status),
    inOperation: data.inOperation === "sim" || data.inOperation === true ? "sim" : "nao",
    approvalRequestId: data.approvalRequestId || null,
    address: buildAddress(data),
    lat,
    lng,
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
  const approvalsByParticipantId = new Map();
  const approvalsByRequestId = new Map();

  STATE.approvalRequests.forEach((req) => {
    if (req.participantId) approvalsByParticipantId.set(req.participantId, req);
    approvalsByRequestId.set(req.id, req);
  });

  const merged = STATE.participants.map((participant) => {
    const approval =
      approvalsByParticipantId.get(participant.id) ||
      approvalsByRequestId.get(participant.approvalRequestId);

    if (!approval) {
      return {
        ...participant,
        linkedApprovalRequestId: participant.approvalRequestId || null
      };
    }

    if (approval.status === "pending") {
      return {
        ...participant,
        status: "pendente",
        inOperation: "nao",
        linkedApprovalRequestId: approval.id
      };
    }

    if (approval.status === "approved") {
      return {
        ...participant,
        status: "aprovado",
        linkedApprovalRequestId: approval.id
      };
    }

    if (approval.status === "rejected") {
      return {
        ...participant,
        status: "inativo",
        inOperation: "nao",
        linkedApprovalRequestId: approval.id
      };
    }

    return {
      ...participant,
      linkedApprovalRequestId: approval.id
    };
  });

  const participantIds = new Set(merged.map((item) => item.id));

  const pendingOrphans = STATE.approvalRequests
    .filter((req) => req.status === "pending" && req.participantId && !participantIds.has(req.participantId))
    .map((req) => ({
      id: req.participantId,
      name: req.participantName || "Solicitação pendente",
      code: req.participantCode || "—",
      phone: req.raw?.applicantSnapshot?.phone || "",
      territoryId: req.territoryId || null,
      territoryLabel: req.territoryLabel || "",
      status: "pendente",
      inOperation: "nao",
      approvalRequestId: req.id,
      linkedApprovalRequestId: req.id,
      address: buildAddress(req.raw?.applicantSnapshot || {}),
      lat: toNumberOrNull(req.raw?.applicantSnapshot?.address?.lat),
      lng: toNumberOrNull(req.raw?.applicantSnapshot?.address?.lng),
      raw: req.raw
    }));

  STATE.mergedUsers = [...merged, ...pendingOrphans].sort((a, b) => {
    const nameA = String(a.name || "").toLowerCase();
    const nameB = String(b.name || "").toLowerCase();
    return nameA.localeCompare(nameB, "pt-BR");
  });

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
      String(user.address || "").toLowerCase().includes(term);

    const matchesStatus = status === "all" || user.status === status;
    const matchesOperation = operation === "all" || user.inOperation === operation;

    return matchesTerm && matchesStatus && matchesOperation;
  });

  renderAll();
}

function computeKpis() {
  const total = STATE.filteredUsers.length;
  const pending = STATE.filteredUsers.filter((u) => u.status === "pendente").length;
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
  const pending = STATE.filteredUsers.filter((u) => u.status === "pendente");

  if (!pending.length) {
    els.pendingList.innerHTML = `<div class="empty">Nenhuma solicitação pendente no momento.</div>`;
    return;
  }

  els.pendingList.innerHTML = pending.map((user) => `
    <article class="item">
      <div class="item-main">
        <strong>${safeText(user.name)}</strong>
        <span>Código: ${safeText(user.code)}</span>
        <span>Telefone: ${safeText(user.phone)}</span>
        <span>${safeText(user.address)}</span>
      </div>

      <div class="item-actions">
        <span class="${statusBadge(user.status)}">Pendente</span>
        <button class="btn btn-ok" data-action="approve" data-id="${user.id}">Aprovar</button>
        <button class="btn btn-danger" data-action="reject" data-id="${user.id}">Rejeitar</button>
        <button class="btn btn-soft" data-action="focus" data-id="${user.id}">Ver no mapa</button>
      </div>
    </article>
  `).join("");
}

function renderActiveList() {
  const active = STATE.filteredUsers.filter((u) => u.status === "aprovado" && u.inOperation === "sim");

  if (!active.length) {
    els.activeList.innerHTML = `<div class="empty">Nenhum participante em operação.</div>`;
    return;
  }

  els.activeList.innerHTML = active.map((user) => `
    <article class="item">
      <div class="item-main">
        <strong>${safeText(user.name)}</strong>
        <span>${safeText(user.address)}</span>
        <span>Telefone: ${safeText(user.phone)}</span>
      </div>

      <div class="item-actions">
        <span class="${statusBadge(user.status)}">Aprovado</span>
        <button class="btn btn-soft" data-action="focus" data-id="${user.id}">Ver no mapa</button>
      </div>
    </article>
  `).join("");
}

function renderTable() {
  if (!STATE.filteredUsers.length) {
    els.usersTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum usuário encontrado.</td>
      </tr>
    `;
    return;
  }

  els.usersTableBody.innerHTML = STATE.filteredUsers.map((user) => `
    <tr>
      <td>
        <strong>${safeText(user.name)}</strong><br>
        <small>${safeText(user.code)}</small><br>
        <small>${safeText(user.phone)}</small>
      </td>

      <td>
        <span class="${statusBadge(user.status)}">${safeText(user.status)}</span>
      </td>

      <td>${user.inOperation === "sim" ? "Em operação" : "Fora da operação"}</td>

      <td>${safeText(user.territoryLabel || user.territoryId)}</td>

      <td>${safeText(user.address)}</td>

      <td>
        ${isValidCoord(user.lat, user.lng) ? `${user.lat}, ${user.lng}` : "Sem coordenadas"}
      </td>

      <td>
        <div class="row-actions">
          ${user.status === "pendente" ? `<button class="btn btn-ok" data-action="approve" data-id="${user.id}">Aprovar</button>` : ""}
          ${user.status === "pendente" ? `<button class="btn btn-danger" data-action="reject" data-id="${user.id}">Rejeitar</button>` : ""}
          <button class="btn btn-soft" data-action="focus" data-id="${user.id}">Mapa</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function initMap() {
  if (!els.usersMap || typeof L === "undefined" || map) return;

  map = L.map("usersMap").setView([DEFAULT_BASE.lat, DEFAULT_BASE.lng], 13);

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
  baseMarker.bindPopup(`<strong>${safeText(base.label, "Base da cooperativa")}</strong>`);

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

  if (coords.length < 2) {
    els.routeStatus.textContent = "São necessários pelo menos dois pontos para desenhar a rota.";
    return;
  }

  const coordsParam = coords.map((pair) => `${pair[0]},${pair[1]}`).join(";");

  try {
    els.routeStatus.textContent = "Calculando rota da cooperativa até os pontos...";
    const url = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson`;
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
  const userDoc = STATE.userDoc || {};
  const userLat = toNumberOrNull(userDoc.cooperativeBaseLat);
  const userLng = toNumberOrNull(userDoc.cooperativeBaseLng);

  if (isValidCoord(userLat, userLng)) {
    STATE.territoryBase = {
      label: userDoc.cooperativeBaseLabel || "Base da cooperativa",
      lat: userLat,
      lng: userLng
    };
    updateBaseInfo();
    return;
  }

  const territoryId = userDoc.territoryId;
  if (!territoryId) {
    STATE.territoryBase = DEFAULT_BASE;
    updateBaseInfo();
    return;
  }

  try {
    const snap = await getDoc(doc(db, "territories", territoryId));

    if (snap.exists()) {
      const data = snap.data() || {};
      const lat =
        toNumberOrNull(data.baseLat) ??
        toNumberOrNull(data.lat) ??
        toNumberOrNull(data.location?.lat);

      const lng =
        toNumberOrNull(data.baseLng) ??
        toNumberOrNull(data.lng) ??
        toNumberOrNull(data.location?.lng);

      if (isValidCoord(lat, lng)) {
        STATE.territoryBase = {
          label: data.name || data.label || userDoc.territoryLabel || "Base da cooperativa",
          lat,
          lng
        };
        updateBaseInfo();
        return;
      }
    }
  } catch (error) {
    console.error("Erro ao carregar base do território:", error);
  }

  STATE.territoryBase = DEFAULT_BASE;
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

  const approvalRequestId =
    user.linkedApprovalRequestId ||
    user.approvalRequestId ||
    null;

  try {
    const batch = writeBatch(db);

    batch.update(doc(db, "participants", user.id), {
      status: "approved",
      approvalStatus: "approved",
      active: true,
      inOperation: "sim",
      updatedAt: serverTimestamp(),
      updatedBy: STATE.authUser?.uid || null
    });

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
  } catch (error) {
    console.error("Erro ao aprovar usuário:", error);
    alert("Não foi possível aprovar este usuário.");
  }
}

async function rejectUser(userId) {
  const user = STATE.mergedUsers.find((item) => item.id === userId);
  if (!user) return;

  const approvalRequestId =
    user.linkedApprovalRequestId ||
    user.approvalRequestId ||
    null;

  try {
    const batch = writeBatch(db);

    batch.update(doc(db, "participants", user.id), {
      status: "inactive",
      approvalStatus: "rejected",
      active: false,
      inOperation: "nao",
      updatedAt: serverTimestamp(),
      updatedBy: STATE.authUser?.uid || null
    });

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
    const latlng = marker.getLatLng();
    if (Math.abs(latlng.lat - user.lat) < 0.000001 && Math.abs(latlng.lng - user.lng) < 0.000001) {
      marker.openPopup();
    }
  });
}

function startParticipantsListener() {
  if (STATE.unsubParticipants) {
    STATE.unsubParticipants();
    STATE.unsubParticipants = null;
  }

  const ref = makeScopedQuery("participants");

  STATE.unsubParticipants = onSnapshot(
    ref,
    (snapshot) => {
      STATE.participants = snapshot.docs.map(mapParticipantDoc);
      mergeUsers();
    },
    (error) => {
      console.error("Erro ao ouvir participants:", error);
      alert("Não foi possível carregar os participantes.");
    }
  );
}

function startApprovalsListener() {
  if (STATE.unsubApprovals) {
    STATE.unsubApprovals();
    STATE.unsubApprovals = null;
  }

  const ref = makeScopedQuery("approvalRequests");

  STATE.unsubApprovals = onSnapshot(
    ref,
    (snapshot) => {
      STATE.approvalRequests = snapshot.docs.map(mapApprovalRequestDoc);
      mergeUsers();
    },
    (error) => {
      console.error("Erro ao ouvir approvalRequests:", error);
      alert("Não foi possível carregar as solicitações pendentes.");
    }
  );
}

function bindEvents() {
  els.searchInput?.addEventListener("input", applyFilters);
  els.statusFilter?.addEventListener("change", applyFilters);
  els.operationFilter?.addEventListener("change", applyFilters);
  els.routeMode?.addEventListener("change", () => {
    renderMap();
    buildRoute();
  });

  els.btnReload?.addEventListener("click", () => {
    mergeUsers();
    buildRoute();
  });

  els.btnCenterBase?.addEventListener("click", () => {
    const base = STATE.territoryBase || DEFAULT_BASE;
    if (map) {
      map.setView([base.lat, base.lng], 15);
      if (baseMarker) baseMarker.openPopup();
    }
  });

  els.btnBuildRoute?.addEventListener("click", async () => {
    await buildRoute();
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
    }
  });
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
    startParticipantsListener();
    startApprovalsListener();

    setTimeout(() => {
      buildRoute();
    }, 1200);
  } catch (error) {
    console.error(error);
    alert("Não foi possível carregar a página de gestão de usuários.");
  }
});