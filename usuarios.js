import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const els = {
  menuToggle: document.getElementById("menuToggle"),
  mobileMenu: document.getElementById("mobileMenu"),

  kpiTotalUsuarios: document.getElementById("kpiTotalUsuarios"),
  kpiPendentes: document.getElementById("kpiPendentes"),
  kpiOperacao: document.getElementById("kpiOperacao"),
  kpiSemGeo: document.getElementById("kpiSemGeo"),

  searchUser: document.getElementById("searchUser"),
  filterStatus: document.getElementById("filterStatus"),
  filterTerritory: document.getElementById("filterTerritory"),
  filterOperation: document.getElementById("filterOperation"),

  pendingUsersList: document.getElementById("pendingUsersList"),
  approvedUsersList: document.getElementById("approvedUsersList"),
  scheduleSummary: document.getElementById("scheduleSummary"),
  mappedUsersSummary: document.getElementById("mappedUsersSummary"),
  geoPendingSummary: document.getElementById("geoPendingSummary"),
  usersTableBody: document.getElementById("usersTableBody"),

  usersMap: document.getElementById("usersMap"),
  mappedUsersCount: document.getElementById("mappedUsersCount"),
  routeList: document.getElementById("routeList"),

  userModal: document.getElementById("userModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  userEditForm: document.getElementById("userEditForm"),
  editUserId: document.getElementById("editUserId"),
  editUserName: document.getElementById("editUserName"),
  editUserCode: document.getElementById("editUserCode"),
  editUserPhone: document.getElementById("editUserPhone"),
  editUserStatus: document.getElementById("editUserStatus"),
  editUserTerritory: document.getElementById("editUserTerritory"),
  editUserOperation: document.getElementById("editUserOperation"),
  editParticipantTerritoryId: document.getElementById("editParticipantTerritoryId"),
  editParticipantTerritoryLabel: document.getElementById("editParticipantTerritoryLabel"),
  editUserSchedule: document.getElementById("editUserSchedule"),
  editUserAddress: document.getElementById("editUserAddress"),
  editUserLat: document.getElementById("editUserLat"),
  editUserLng: document.getElementById("editUserLng"),
  editUserWasteKg: document.getElementById("editUserWasteKg"),
  deleteUserBtn: document.getElementById("deleteUserBtn"),
  btnBuscarCoordenadas: document.getElementById("btnBuscarCoordenadas"),
  geoSearchStatus: document.getElementById("geoSearchStatus")
};

const STATE = {
  user: null,
  userDoc: null,
  users: [],
  filteredUsers: [],
  unsubscribeParticipants: null,
  isSaving: false
};

let map = null;
let markers = [];
let routeLine = null;

/* =========================
   MENU
========================= */
function initMenu() {
  if (els.menuToggle && els.mobileMenu) {
    els.menuToggle.addEventListener("click", () => {
      els.mobileMenu.classList.toggle("show");
    });
  }
}

/* =========================
   HELPERS
========================= */
function normalizeStatus(value) {
  const v = String(value || "").toLowerCase().trim();

  if (["pending", "pendente", "aguardando", "analise", "análise"].includes(v)) {
    return "pendente";
  }

  if (["approved", "aprovado", "ativo", "active", "operacao", "operação"].includes(v)) {
    return "aprovado";
  }

  if (["inactive", "inativo", "blocked", "bloqueado", "desativado"].includes(v)) {
    return "inativo";
  }

  return "pendente";
}

function yesNo(value) {
  return value === true || value === "sim" || value === "yes" || value === "true" ? "sim" : "nao";
}

function statusClass(status) {
  if (status === "pendente") return "status-pendente";
  if (status === "aprovado") return "status-aprovado";
  return "status-inativo";
}

function statusLabel(status) {
  if (status === "pendente") return "Pendente";
  if (status === "aprovado") return "Aprovado";
  return "Inativo";
}

function territoryLabel(value) {
  return value === "sim" ? "No território" : "Não vinculado";
}

function operationLabel(value) {
  return value === "sim" ? "Em operação" : "Fora de operação";
}

function isValidCoord(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasValidGeo(user) {
  return !!user?.geo && isValidCoord(user.geo.lat) && isValidCoord(user.geo.lng);
}

function isVisibleOnMap(user) {
  return user.status === "aprovado" && user.inOperation === "sim" && hasValidGeo(user);
}

function formatKg(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")} kg`;
}

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function emptyCard(title, text) {
  return `
    <div class="empty-state">
      <strong>${title}</strong><br>
      <span>${text}</span>
    </div>
  `;
}

function buildAddress(data) {
  if (data.enderecoCompleto) return data.enderecoCompleto;

  const rua = data.rua || "";
  const numero = data.numero || "";
  const bairro = data.bairro || "";
  const cidade = data.cidade || "";
  const uf = data.uf || "";
  const cep = data.cep || "";

  const linha1 = [rua, numero].filter(Boolean).join(", ");
  const linha2 = [bairro, cidade, uf].filter(Boolean).join(" - ");
  const linha3 = cep ? `CEP ${cep}` : "";

  return [linha1, linha2, linha3].filter(Boolean).join(" • ");
}

function setGeoStatus(message, type = "info") {
  if (!els.geoSearchStatus) return;

  els.geoSearchStatus.style.display = "block";
  els.geoSearchStatus.textContent = message;

  if (type === "error") {
    els.geoSearchStatus.style.background = "rgba(216,78,78,.12)";
    els.geoSearchStatus.style.color = "#a52f2f";
  } else if (type === "success") {
    els.geoSearchStatus.style.background = "rgba(47,145,88,.12)";
    els.geoSearchStatus.style.color = "#1b6f40";
  } else {
    els.geoSearchStatus.style.background = "rgba(129,185,42,.10)";
    els.geoSearchStatus.style.color = "#3f5716";
  }
}

function clearGeoStatus() {
  if (!els.geoSearchStatus) return;
  els.geoSearchStatus.style.display = "none";
  els.geoSearchStatus.textContent = "";
}

function resetModalForm() {
  if (!els.userEditForm) return;
  els.userEditForm.reset();
  if (els.editUserId) els.editUserId.value = "";
  if (els.editParticipantTerritoryId) els.editParticipantTerritoryId.value = "";
  if (els.editParticipantTerritoryLabel) els.editParticipantTerritoryLabel.value = "";
  clearGeoStatus();
}

function getSortableTime(value) {
  if (!value) return 0;

  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "number") return value;

  return 0;
}

function sortParticipants(items) {
  return [...items].sort((a, b) => {
    const timeA =
      getSortableTime(a.raw?.createdAt) ||
      getSortableTime(a.raw?.updatedAt) ||
      getSortableTime(a.raw?.createdAtISO);

    const timeB =
      getSortableTime(b.raw?.createdAt) ||
      getSortableTime(b.raw?.updatedAt) ||
      getSortableTime(b.raw?.createdAtISO);

    return timeB - timeA;
  });
}

function getNextPendingUserId(excludeId = null) {
  const nextPending = STATE.users.find((user) => {
    if (excludeId && user.id === excludeId) return false;
    return user.status === "pendente";
  });

  return nextPending?.id || null;
}

async function buscarCoordenadasPorEndereco(address) {
  const cleanAddress = String(address || "").trim();

  if (!cleanAddress) {
    throw new Error("Informe um endereço para pesquisar.");
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(cleanAddress)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar o serviço de geocodificação.");
  }

  const results = await response.json();

  if (!Array.isArray(results) || !results.length) {
    throw new Error("Nenhuma coordenada encontrada para este endereço.");
  }

  const first = results[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("O serviço retornou coordenadas inválidas.");
  }

  return {
    lat,
    lng,
    displayName: first.display_name || cleanAddress
  };
}

async function preencherCoordenadasPeloEndereco() {
  try {
    const address = els.editUserAddress.value.trim();

    if (!address) {
      setGeoStatus("Informe o endereço antes de buscar as coordenadas.", "error");
      return;
    }

    setGeoStatus("Buscando coordenadas do endereço...", "info");

    const geo = await buscarCoordenadasPorEndereco(address);

    els.editUserLat.value = geo.lat;
    els.editUserLng.value = geo.lng;

    setGeoStatus("Coordenadas encontradas e preenchidas com sucesso.", "success");
  } catch (error) {
    console.error(error);
    setGeoStatus(error.message || "Não foi possível buscar as coordenadas.", "error");
  }
}

function mapParticipantDoc(docSnap) {
  const data = docSnap.data() || {};

  const lat =
    toNumberOrNull(data.lat) ??
    toNumberOrNull(data.latitude) ??
    toNumberOrNull(data.geo?.lat);

  const lng =
    toNumberOrNull(data.lng) ??
    toNumberOrNull(data.longitude) ??
    toNumberOrNull(data.geo?.lng);

  const status = normalizeStatus(data.status);

  const inTerritory =
    data.territoryId || data.territoryLabel
      ? "sim"
      : yesNo(data.inTerritory);

  const inOperation =
    yesNo(data.inOperation) === "sim" && status === "aprovado"
      ? "sim"
      : "nao";

  return {
    id: docSnap.id,
    name: data.name || data.nome || "Sem nome",
    code: data.participantCode || data.code || "—",
    phone: data.phone || data.telefone || "",
    status,
    inTerritory,
    inOperation,
    schedule: data.schedule || data.collectionSchedule || data.horarioColeta || "A definir",
    wasteKg: Number(data.wasteKg || data.totalWasteKg || 0),
    address: buildAddress(data),
    territoryId: data.territoryId || null,
    territoryLabel: data.territoryLabel || "",
    geo: { lat, lng },
    raw: data
  };
}

function canViewAllTerritories() {
  const role = String(STATE.userDoc?.role || "").toLowerCase();
  return ["governanca", "gestor", "admin_master", "superadmin"].includes(role);
}

function getMyTerritoryId() {
  return STATE.userDoc?.territoryId || null;
}

function getMyTerritoryLabel() {
  return STATE.userDoc?.territoryLabel || "";
}

function filterUsersByPermission(items) {
  if (canViewAllTerritories()) return items;

  const myTerritoryId = getMyTerritoryId();

  if (!myTerritoryId) return items;

  return items.filter((user) => {
    const userTerritoryId = user.territoryId || user.raw?.territoryId || null;
    return !userTerritoryId || userTerritoryId === myTerritoryId;
  });
}

function replaceLocalUser(serverUser) {
  const index = STATE.users.findIndex((u) => u.id === serverUser.id);

  if (index >= 0) {
    STATE.users[index] = serverUser;
  } else {
    STATE.users.unshift(serverUser);
  }

  STATE.users = sortParticipants(STATE.users);
}

function removeLocalUser(id) {
  STATE.users = STATE.users.filter((u) => u.id !== id);
}

async function refreshOneUserFromServer(id) {
  const snap = await getDoc(doc(db, "participants", id));
  if (!snap.exists()) return null;

  const mapped = mapParticipantDoc(snap);
  replaceLocalUser(mapped);
  return mapped;
}

/* =========================
   KPI / RENDER
========================= */
function computeKpis(items) {
  els.kpiTotalUsuarios.textContent = String(items.length);
  els.kpiPendentes.textContent = String(items.filter((u) => u.status === "pendente").length);
  els.kpiOperacao.textContent = String(items.filter((u) => u.status === "aprovado" && u.inOperation === "sim").length);
  els.kpiSemGeo.textContent = String(items.filter((u) => !hasValidGeo(u)).length);
}

function renderPendingUsers(items) {
  const pendentes = items.filter((u) => u.status === "pendente");

  if (!pendentes.length) {
    els.pendingUsersList.innerHTML = emptyCard(
      "Nenhuma solicitação pendente",
      "As novas solicitações aparecerão aqui automaticamente."
    );
    return;
  }

  els.pendingUsersList.innerHTML = pendentes.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${user.name}</strong>
        <span>${user.code}</span>
        <span>${safeText(user.address)}</span>
        <span>${safeText(user.phone)}</span>
      </div>
      <div class="user-side">
        <span class="status-badge ${statusClass(user.status)}">${statusLabel(user.status)}</span>
        <button class="action-btn edit" data-action="edit" data-id="${user.id}">Avaliar</button>
      </div>
    </article>
  `).join("");
}

function renderApprovedUsers(items) {
  const aprovadosOperando = items.filter(
    (u) => u.status === "aprovado" && u.inOperation === "sim"
  );

  if (!aprovadosOperando.length) {
    els.approvedUsersList.innerHTML = emptyCard(
      "Nenhum participante em operação",
      "Os participantes aprovados e em operação aparecerão aqui."
    );
    return;
  }

  els.approvedUsersList.innerHTML = aprovadosOperando.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${user.name}</strong>
        <span>${safeText(user.schedule, "Horário não definido")}</span>
        <span>${formatKg(user.wasteKg)} registrados</span>
        <span>${safeText(user.address)}</span>
      </div>
      <div class="user-side">
        <span class="status-badge ${statusClass(user.status)}">${statusLabel(user.status)}</span>
        <button class="action-btn edit" data-action="edit" data-id="${user.id}">Editar</button>
      </div>
    </article>
  `).join("");
}

function renderScheduleSummary(items) {
  const scheduled = items.filter(
    (u) => u.status === "aprovado" && u.inOperation === "sim"
  );

  if (!scheduled.length) {
    els.scheduleSummary.innerHTML = emptyCard(
      "Sem horários definidos",
      "Defina operação e horários para montar a agenda."
    );
    return;
  }

  els.scheduleSummary.innerHTML = scheduled.map((user) => `
    <article class="summary-item">
      <div>
        <strong>${user.name}</strong>
        <span>${safeText(user.schedule, "A definir")}</span>
      </div>
    </article>
  `).join("");
}

function renderMappedSummary(items) {
  const mapped = items.filter(isVisibleOnMap);

  if (!mapped.length) {
    els.mappedUsersSummary.innerHTML = emptyCard(
      "Nenhum participante exibido no mapa",
      "O mapa mostra apenas participantes aprovados, em operação e com coordenadas válidas."
    );
    return;
  }

  els.mappedUsersSummary.innerHTML = mapped.map((user) => `
    <article class="summary-item">
      <div>
        <strong>${user.name}</strong>
        <span>${safeText(user.address)}</span>
      </div>
    </article>
  `).join("");
}

function renderGeoPendingSummary(items) {
  const invalidGeo = items.filter((u) => !hasValidGeo(u));

  if (!invalidGeo.length) {
    els.geoPendingSummary.innerHTML = emptyCard(
      "Tudo certo com as coordenadas",
      "Nenhum participante com latitude/longitude pendente."
    );
    return;
  }

  els.geoPendingSummary.innerHTML = invalidGeo.map((user) => `
    <article class="summary-item">
      <div>
        <strong>${user.name}</strong>
        <span>${safeText(user.address)}</span>
        <span>Latitude/longitude precisam ser revisadas.</span>
      </div>
    </article>
  `).join("");
}

function coordBadge(user) {
  if (hasValidGeo(user)) {
    return `<span class="flag-badge flag-ok">Coordenada ok</span>`;
  }
  return `<span class="flag-badge flag-warn">Pendente</span>`;
}

function renderUsersTable(items) {
  if (!items.length) {
    els.usersTableBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum participante encontrado.</td>
      </tr>
    `;
    return;
  }

  els.usersTableBody.innerHTML = items.map((user) => `
    <tr>
      <td>
        <strong>${user.name}</strong><br>
        <small>${user.code}</small><br>
        <small>${safeText(user.phone)}</small><br>
        <small>${safeText(user.address)}</small>
      </td>

      <td>
        <span class="status-badge ${statusClass(user.status)}">${statusLabel(user.status)}</span>
      </td>

      <td>
        <span class="flag-badge ${user.inTerritory === "sim" ? "flag-ok" : "flag-no"}">
          ${territoryLabel(user.inTerritory)}
        </span><br>
        <small>${safeText(user.territoryId, "Sem territoryId")}</small>
      </td>

      <td>
        <span class="flag-badge ${user.inOperation === "sim" ? "flag-ok" : "flag-no"}">
          ${operationLabel(user.inOperation)}
        </span>
      </td>

      <td>${safeText(user.schedule, "A definir")}</td>

      <td>
        <div class="coord-text">
          ${coordBadge(user)}
          <span><strong>Lat:</strong> ${isValidCoord(user.geo?.lat) ? user.geo.lat : "—"}</span>
          <span><strong>Lng:</strong> ${isValidCoord(user.geo?.lng) ? user.geo.lng : "—"}</span>
        </div>
      </td>

      <td>
        <div class="user-actions">
          <button class="action-btn edit" data-action="edit" data-id="${user.id}">Editar</button>
          <button class="action-btn delete" data-action="delete" data-id="${user.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function renderAll() {
  computeKpis(STATE.filteredUsers);
  renderPendingUsers(STATE.filteredUsers);
  renderApprovedUsers(STATE.filteredUsers);
  renderScheduleSummary(STATE.filteredUsers);
  renderMappedSummary(STATE.filteredUsers);
  renderGeoPendingSummary(STATE.filteredUsers);
  renderUsersTable(STATE.filteredUsers);
  renderMap(STATE.filteredUsers);
}

/* =========================
   FILTROS
========================= */
function applyFilters() {
  const term = (els.searchUser.value || "").trim().toLowerCase();
  const status = els.filterStatus.value;
  const territory = els.filterTerritory.value;
  const operation = els.filterOperation.value;

  STATE.filteredUsers = STATE.users.filter((user) => {
    const matchTerm =
      !term ||
      user.name.toLowerCase().includes(term) ||
      user.code.toLowerCase().includes(term) ||
      String(user.phone || "").toLowerCase().includes(term) ||
      String(user.address || "").toLowerCase().includes(term) ||
      String(user.territoryId || "").toLowerCase().includes(term) ||
      String(user.territoryLabel || "").toLowerCase().includes(term);

    const matchStatus = status === "all" || user.status === status;
    const matchTerritory = territory === "all" || user.inTerritory === territory;
    const matchOperation = operation === "all" || user.inOperation === operation;

    return matchTerm && matchStatus && matchTerritory && matchOperation;
  });

  renderAll();
}

/* =========================
   MAPA
========================= */
function initMap() {
  if (!els.usersMap || typeof L === "undefined" || map) return;

  map = L.map("usersMap").setView([-30.0295, -51.1210], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
}

function clearMapLayers() {
  if (!map) return;

  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
}

function renderMap(items) {
  if (!map) return;

  clearMapLayers();

  const visibleUsers = items.filter(isVisibleOnMap);
  const bounds = [];
  const routeCoords = [];

  visibleUsers.forEach((user) => {
    const marker = L.marker([user.geo.lat, user.geo.lng]).addTo(map);

    marker.bindPopup(`
      <strong>${user.name}</strong><br>
      Código: ${user.code}<br>
      Endereço: ${safeText(user.address)}<br>
      Território: ${safeText(user.territoryLabel || user.territoryId, "Não definido")}<br>
      Horário: ${safeText(user.schedule, "A definir")}<br>
      Resíduos: ${formatKg(user.wasteKg)}
    `);

    markers.push(marker);
    bounds.push([user.geo.lat, user.geo.lng]);
    routeCoords.push([user.geo.lat, user.geo.lng]);
  });

  if (routeCoords.length >= 2) {
    routeLine = L.polyline(routeCoords, {
      weight: 4,
      opacity: 0.85
    }).addTo(map);
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 15);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    map.setView([-30.0295, -51.1210], 13);
  }

  if (els.mappedUsersCount) {
    els.mappedUsersCount.textContent = `${visibleUsers.length} usuários/pontos`;
  }

  if (!visibleUsers.length) {
    els.routeList.innerHTML = `
      <div class="route-item">
        <strong>Sem pontos operacionais</strong>
        <span>Não há participantes aptos para aparecer no mapa.</span>
      </div>
    `;
    return;
  }

  els.routeList.innerHTML = visibleUsers.map((user, index) => `
    <div class="route-item">
      <strong>${index + 1}. ${user.name}</strong>
      <span>${safeText(user.address)}</span>
      <span>${safeText(user.territoryLabel || user.territoryId, "Sem território")}</span>
    </div>
  `).join("");
}

/* =========================
   MODAL
========================= */
function openModal(userId) {
  const user = STATE.users.find((u) => u.id === userId);
  if (!user) return;

  els.editUserId.value = user.id;
  els.editUserName.value = safeText(user.name, "");
  els.editUserCode.value = safeText(user.code, "");
  els.editUserPhone.value = safeText(user.phone, "");
  els.editUserStatus.value = user.status;
  els.editUserTerritory.value = user.inTerritory;
  els.editUserOperation.value = user.inOperation;
  els.editParticipantTerritoryId.value = safeText(user.territoryId, "");
  els.editParticipantTerritoryLabel.value = safeText(user.territoryLabel, "");
  els.editUserSchedule.value = safeText(user.schedule, "");
  els.editUserAddress.value = safeText(user.address, "");
  els.editUserLat.value = isValidCoord(user.geo?.lat) ? user.geo.lat : "";
  els.editUserLng.value = isValidCoord(user.geo?.lng) ? user.geo.lng : "";
  els.editUserWasteKg.value = Number(user.wasteKg || 0);

  clearGeoStatus();

  els.userModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  resetModalForm();
  els.userModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

/* =========================
   FIREBASE / AUTH
========================= */
async function loadCurrentUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Usuário autenticado sem documento em /users.");
  }

  return { id: snap.id, ...snap.data() };
}

async function saveUserForm(event) {
  event.preventDefault();

  if (STATE.isSaving) return;
  STATE.isSaving = true;

  const id = els.editUserId.value;
  if (!id) {
    STATE.isSaving = false;
    alert("Participante inválido para edição.");
    return;
  }

  const previousUser = STATE.users.find((u) => u.id === id);
  if (!previousUser) {
    STATE.isSaving = false;
    alert("Participante não encontrado na lista local.");
    return;
  }

  const status = els.editUserStatus.value;
  const inTerritory = els.editUserTerritory.value;
  let inOperation = els.editUserOperation.value;

  if (status === "aprovado") {
    inOperation = "sim";
  } else {
    inOperation = "nao";
  }

  let lat = toNumberOrNull(els.editUserLat.value.trim());
  let lng = toNumberOrNull(els.editUserLng.value.trim());
  const address = els.editUserAddress.value.trim();

  try {
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && address) {
      setGeoStatus("Coordenadas não informadas. Buscando automaticamente pelo endereço...", "info");

      const geo = await buscarCoordenadasPorEndereco(address);
      lat = geo.lat;
      lng = geo.lng;

      els.editUserLat.value = lat;
      els.editUserLng.value = lng;

      setGeoStatus("Coordenadas encontradas automaticamente.", "success");
    }
  } catch (geoError) {
    console.warn("Falha ao buscar coordenadas:", geoError);
    setGeoStatus(
      "Não foi possível localizar automaticamente. Você pode preencher latitude e longitude manualmente.",
      "error"
    );
  }

  const manualTerritoryId = els.editParticipantTerritoryId?.value.trim() || "";
  const manualTerritoryLabel = els.editParticipantTerritoryLabel?.value.trim() || "";

  const payload = {
    name: els.editUserName.value.trim(),
    participantCode: els.editUserCode.value.trim(),
    phone: els.editUserPhone.value.trim(),
    status,
    inTerritory,
    inOperation,
    schedule: els.editUserSchedule.value.trim() || "A definir",
    enderecoCompleto: address || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    wasteKg: Number(els.editUserWasteKg.value || 0),
    updatedAt: serverTimestamp(),
    updatedBy: STATE.user?.uid || null
  };

  if (inTerritory === "sim") {
    payload.territoryId = manualTerritoryId || getMyTerritoryId() || null;
    payload.territoryLabel = manualTerritoryLabel || getMyTerritoryLabel() || "";
  } else {
    payload.territoryId = null;
    payload.territoryLabel = "";
  }

  const optimisticUser = {
    ...previousUser,
    name: payload.name,
    code: payload.participantCode,
    phone: payload.phone,
    status: normalizeStatus(payload.status),
    inTerritory: yesNo(payload.inTerritory),
    inOperation: yesNo(payload.inOperation),
    territoryId: payload.territoryId,
    territoryLabel: payload.territoryLabel,
    schedule: payload.schedule,
    wasteKg: Number(payload.wasteKg || 0),
    address: payload.enderecoCompleto || previousUser.address,
    geo: {
      lat: toNumberOrNull(payload.lat),
      lng: toNumberOrNull(payload.lng)
    },
    raw: {
      ...previousUser.raw,
      ...payload
    }
  };

  try {
    replaceLocalUser(optimisticUser);
    applyFilters();

    await updateDoc(doc(db, "participants", id), payload);

    await refreshOneUserFromServer(id);
    applyFilters();

    const nextPendingId = getNextPendingUserId(id);

    closeModal();

    if (nextPendingId) {
      setTimeout(() => {
        openModal(nextPendingId);
      }, 120);
    }

    alert("Participante atualizado com sucesso.");
  } catch (error) {
    console.error("Erro ao salvar participante:", error);

    replaceLocalUser(previousUser);
    applyFilters();

    let msg = "Não foi possível salvar o participante.";

    if (error?.code === "permission-denied") {
      msg = "O Firestore recusou a gravação. Verifique as regras da coleção participants.";
    } else if (error?.code === "not-found") {
      msg = "O documento do participante não foi encontrado para atualização.";
    } else if (error?.message) {
      msg = `Erro ao salvar: ${error.message}`;
    }

    alert(msg);
  } finally {
    STATE.isSaving = false;
  }
}

async function handleDeleteUser(id) {
  const confirmed = window.confirm("Deseja realmente excluir este participante?");
  if (!confirmed) return;

  const previousUsers = [...STATE.users];

  try {
    removeLocalUser(id);
    applyFilters();

    await deleteDoc(doc(db, "participants", id));
    alert("Participante excluído com sucesso.");
  } catch (error) {
    console.error("Erro ao excluir participante:", error);

    STATE.users = previousUsers;
    applyFilters();

    let msg = "Não foi possível excluir o participante.";

    if (error?.code === "permission-denied") {
      msg = "O Firestore recusou a exclusão. Verifique as regras da coleção participants.";
    } else if (error?.message) {
      msg = `Erro ao excluir: ${error.message}`;
    }

    alert(msg);
  }
}

function startParticipantsListener() {
  if (STATE.unsubscribeParticipants) {
    STATE.unsubscribeParticipants();
    STATE.unsubscribeParticipants = null;
  }

  const ref = collection(db, "participants");

  STATE.unsubscribeParticipants = onSnapshot(
    ref,
    (snapshot) => {
      const allDocs = snapshot.docs.map(mapParticipantDoc);
      const sortedDocs = sortParticipants(allDocs);

      STATE.users = filterUsersByPermission(sortedDocs);
      applyFilters();

      console.log("Participantes carregados:", STATE.users.length, STATE.users);
    },
    (error) => {
      console.error("Erro ao ouvir participants:", error);
      alert("Não foi possível carregar os participantes em tempo real.");
    }
  );
}

/* =========================
   EVENTOS
========================= */
function bindEvents() {
  els.searchUser?.addEventListener("input", applyFilters);
  els.filterStatus?.addEventListener("change", applyFilters);
  els.filterTerritory?.addEventListener("change", applyFilters);
  els.filterOperation?.addEventListener("change", applyFilters);

  els.btnBuscarCoordenadas?.addEventListener("click", async () => {
    await preencherCoordenadasPeloEndereco();
  });

  document.addEventListener("click", async (event) => {
    const editBtn = event.target.closest('[data-action="edit"]');
    const deleteBtn = event.target.closest('[data-action="delete"]');

    try {
      if (editBtn) {
        openModal(editBtn.dataset.id);
        return;
      }

      if (deleteBtn) {
        await handleDeleteUser(deleteBtn.dataset.id);
      }
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao executar a ação.");
    }
  });

  els.closeModalBtn?.addEventListener("click", closeModal);

  els.userModal?.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) {
      closeModal();
    }
  });

  els.userEditForm?.addEventListener("submit", async (event) => {
    await saveUserForm(event);
  });

  els.deleteUserBtn?.addEventListener("click", async () => {
    const id = els.editUserId.value;
    if (!id) return;

    closeModal();
    await handleDeleteUser(id);
  });

  document.getElementById("btnExportarLista")?.addEventListener("click", () => {
    alert("Próximo passo: exportar a lista em CSV.");
  });
}

/* =========================
   INIT
========================= */
initMenu();
initMap();
bindEvents();

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }

    STATE.user = user;
    STATE.userDoc = await loadCurrentUserProfile(user.uid);

    startParticipantsListener();
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar a gestão de usuários.");
  }
});