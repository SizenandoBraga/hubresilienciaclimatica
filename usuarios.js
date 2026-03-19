const els = {
  menuToggle: document.getElementById("menuToggle"),
  mobileMenu: document.getElementById("mobileMenu"),

  kpiTotalUsuarios: document.getElementById("kpiTotalUsuarios"),
  kpiPendentes: document.getElementById("kpiPendentes"),
  kpiAprovados: document.getElementById("kpiAprovados"),
  kpiResiduos: document.getElementById("kpiResiduos"),

  searchUser: document.getElementById("searchUser"),
  filterStatus: document.getElementById("filterStatus"),
  filterRoute: document.getElementById("filterRoute"),

  pendingUsersList: document.getElementById("pendingUsersList"),
  approvedUsersList: document.getElementById("approvedUsersList"),
  scheduleSummary: document.getElementById("scheduleSummary"),
  mappedUsersSummary: document.getElementById("mappedUsersSummary"),
  usersTableBody: document.getElementById("usersTableBody"),

  usersMap: document.getElementById("usersMap"),
  mappedUsersCount: document.getElementById("mappedUsersCount"),
  routeList: document.getElementById("routeList"),

  userModal: document.getElementById("userModal"),
  closeModalBtn: document.getElementById("closeModalBtn"),
  userEditForm: document.getElementById("userEditForm"),
  editUserId: document.getElementById("editUserId"),
  editUserName: document.getElementById("editUserName"),
  editUserPhone: document.getElementById("editUserPhone"),
  editUserStatus: document.getElementById("editUserStatus"),
  editUserRoute: document.getElementById("editUserRoute"),
  editUserSchedule: document.getElementById("editUserSchedule"),
  deleteUserBtn: document.getElementById("deleteUserBtn")
};

let users = [
  {
    id: "u1",
    name: "Sizenando da Rosa Braga",
    code: "RB-636236",
    phone: "51983061200",
    status: "pendente",
    route: "nao",
    schedule: "A definir",
    wasteKg: 0,
    address: "Rua Zeferino Dias, 131",
    mapped: false,
    geo: { lat: -30.0244, lng: -51.1198 }
  },
  {
    id: "u2",
    name: "Maria da Silva",
    code: "RB-882341",
    phone: "51999990001",
    status: "aprovado",
    route: "sim",
    schedule: "Terça • 14h às 16h",
    wasteKg: 18,
    address: "Rua Bom Jesus, 220",
    mapped: true,
    geo: { lat: -30.0298, lng: -51.1179 }
  },
  {
    id: "u3",
    name: "Condomínio Esperança",
    code: "COND-102233",
    phone: "51999990002",
    status: "aprovado",
    route: "sim",
    schedule: "Quinta • 9h às 11h",
    wasteKg: 42,
    address: "Av. Comunitária, 80",
    mapped: true,
    geo: { lat: -30.0328, lng: -51.1225 }
  },
  {
    id: "u4",
    name: "João Ferreira",
    code: "RB-771204",
    phone: "51999990003",
    status: "inativo",
    route: "nao",
    schedule: "Sem horário",
    wasteKg: 7,
    address: "Rua da Reciclagem, 55",
    mapped: false,
    geo: { lat: -30.0273, lng: -51.1251 }
  }
];

let filteredUsers = [...users];
let map = null;
let markers = [];
let routeLine = null;

if (els.menuToggle && els.mobileMenu) {
  els.menuToggle.addEventListener("click", () => {
    els.mobileMenu.classList.toggle("show");
  });
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

function computeKpis(items) {
  const total = items.length;
  const pendentes = items.filter((u) => u.status === "pendente").length;
  const aprovados = items.filter((u) => u.status === "aprovado").length;
  const residuos = items.reduce((sum, u) => sum + Number(u.wasteKg || 0), 0);

  els.kpiTotalUsuarios.textContent = String(total);
  els.kpiPendentes.textContent = String(pendentes);
  els.kpiAprovados.textContent = String(aprovados);
  els.kpiResiduos.textContent = `${residuos.toFixed(1).replace(".", ",")} kg`;
}

function renderPendingUsers(items) {
  const pendentes = items.filter((u) => u.status === "pendente");

  if (!pendentes.length) {
    els.pendingUsersList.innerHTML = `<div class="summary-item"><div><strong>Nenhuma solicitação pendente</strong><span>Tudo em dia no momento.</span></div></div>`;
    return;
  }

  els.pendingUsersList.innerHTML = pendentes.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${user.name}</strong>
        <span>${user.code}</span>
        <span>${user.address}</span>
      </div>
      <div class="user-side">
        <span class="status-badge ${statusClass(user.status)}">${statusLabel(user.status)}</span>
        <button class="action-btn edit" data-action="edit" data-id="${user.id}">Avaliar</button>
      </div>
    </article>
  `).join("");
}

function renderApprovedUsers(items) {
  const aprovados = items.filter((u) => u.status === "aprovado");

  if (!aprovados.length) {
    els.approvedUsersList.innerHTML = `<div class="summary-item"><div><strong>Nenhum usuário aprovado</strong><span>Os aprovados aparecerão aqui.</span></div></div>`;
    return;
  }

  els.approvedUsersList.innerHTML = aprovados.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${user.name}</strong>
        <span>${user.schedule}</span>
        <span>${user.wasteKg.toFixed(1).replace(".", ",")} kg registrados</span>
      </div>
      <div class="user-side">
        <span class="status-badge ${statusClass(user.status)}">${statusLabel(user.status)}</span>
        <button class="action-btn edit" data-action="edit" data-id="${user.id}">Editar</button>
      </div>
    </article>
  `).join("");
}

function renderScheduleSummary(items) {
  const withSchedule = items.filter((u) => u.route === "sim");

  if (!withSchedule.length) {
    els.scheduleSummary.innerHTML = `<div class="summary-item"><div><strong>Sem horários definidos</strong><span>Defina rotas e horários para os usuários.</span></div></div>`;
    return;
  }

  els.scheduleSummary.innerHTML = withSchedule.map((user) => `
    <article class="summary-item">
      <div>
        <strong>${user.name}</strong>
        <span>${user.schedule}</span>
      </div>
    </article>
  `).join("");
}

function renderMappedSummary(items) {
  const mapped = items.filter((u) => u.mapped);

  if (!mapped.length) {
    els.mappedUsersSummary.innerHTML = `<div class="summary-item"><div><strong>Nenhum usuário no mapa</strong><span>Os usuários aprovados podem ser inseridos no mapa de coleta.</span></div></div>`;
    return;
  }

  els.mappedUsersSummary.innerHTML = mapped.map((user) => `
    <article class="summary-item">
      <div>
        <strong>${user.name}</strong>
        <span>${user.address}</span>
      </div>
    </article>
  `).join("");
}

function renderUsersTable(items) {
  if (!items.length) {
    els.usersTableBody.innerHTML = `<tr><td colspan="6">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  els.usersTableBody.innerHTML = items.map((user) => `
    <tr>
      <td>
        <strong>${user.name}</strong><br>
        <small>${user.code}</small><br>
        <small>${user.phone}</small>
      </td>
      <td><span class="status-badge ${statusClass(user.status)}">${statusLabel(user.status)}</span></td>
      <td>${user.route === "sim" ? "Em rota" : "Sem rota"}</td>
      <td>${user.schedule}</td>
      <td>${user.wasteKg.toFixed(1).replace(".", ",")} kg</td>
      <td>
        <div class="user-actions">
          <button class="action-btn edit" data-action="edit" data-id="${user.id}">Editar</button>
          <button class="action-btn delete" data-action="delete" data-id="${user.id}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function initMap() {
  if (!els.usersMap || typeof L === "undefined") return;
  if (map) return;

  map = L.map("usersMap").setView([-30.0295, -51.1210], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
}

function clearMapLayers() {
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

  const mappedUsers = items.filter((u) => u.mapped && u.geo && Number.isFinite(u.geo.lat) && Number.isFinite(u.geo.lng));
  const bounds = [];
  const routeCoords = [];

  mappedUsers.forEach((user, index) => {
    const marker = L.marker([user.geo.lat, user.geo.lng]).addTo(map);
    marker.bindPopup(`
      <strong>${user.name}</strong><br>
      ${user.address}<br>
      Horário: ${user.schedule}<br>
      Resíduos: ${user.wasteKg.toFixed(1).replace(".", ",")} kg
    `);

    markers.push(marker);
    bounds.push([user.geo.lat, user.geo.lng]);
    routeCoords.push([user.geo.lat, user.geo.lng]);
  });

  if (routeCoords.length >= 2) {
    routeLine = L.polyline(routeCoords, {
      weight: 4,
      opacity: 0.8
    }).addTo(map);
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 15);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  if (els.mappedUsersCount) {
    els.mappedUsersCount.textContent = `${mappedUsers.length} usuários/pontos`;
  }

  if (els.routeList) {
    if (!mappedUsers.length) {
      els.routeList.innerHTML = `<div class="route-item"><strong>Sem rota mapeada</strong><span>Os pontos aprovados aparecerão aqui.</span></div>`;
    } else {
      els.routeList.innerHTML = mappedUsers.map((user, index) => `
        <div class="route-item">
          <strong>${index + 1}. ${user.name}</strong>
          <span>${user.address}</span>
        </div>
      `).join("");
    }
  }
}

function renderAll() {
  computeKpis(filteredUsers);
  renderPendingUsers(filteredUsers);
  renderApprovedUsers(filteredUsers);
  renderScheduleSummary(filteredUsers);
  renderMappedSummary(filteredUsers);
  renderUsersTable(filteredUsers);
  renderMap(filteredUsers);
}

function applyFilters() {
  const term = (els.searchUser.value || "").trim().toLowerCase();
  const status = els.filterStatus.value;
  const route = els.filterRoute.value;

  filteredUsers = users.filter((user) => {
    const matchTerm =
      !term ||
      user.name.toLowerCase().includes(term) ||
      user.code.toLowerCase().includes(term) ||
      user.phone.toLowerCase().includes(term);

    const matchStatus = status === "all" || user.status === status;
    const matchRoute = route === "all" || user.route === route;

    return matchTerm && matchStatus && matchRoute;
  });

  renderAll();
}

function openModal(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  els.editUserId.value = user.id;
  els.editUserName.value = user.name;
  els.editUserPhone.value = user.phone;
  els.editUserStatus.value = user.status;
  els.editUserRoute.value = user.route;
  els.editUserSchedule.value = user.schedule;

  els.userModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  els.userModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function bindEvents() {
  els.searchUser.addEventListener("input", applyFilters);
  els.filterStatus.addEventListener("change", applyFilters);
  els.filterRoute.addEventListener("change", applyFilters);

  document.addEventListener("click", (event) => {
    const editBtn = event.target.closest('[data-action="edit"]');
    const deleteBtn = event.target.closest('[data-action="delete"]');

    if (editBtn) openModal(editBtn.dataset.id);

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      users = users.filter((u) => u.id !== id);
      applyFilters();
    }
  });

  els.closeModalBtn.addEventListener("click", closeModal);

  els.userModal.addEventListener("click", (event) => {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });

  els.userEditForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = els.editUserId.value;
    const index = users.findIndex((u) => u.id === id);
    if (index === -1) return;

    users[index] = {
      ...users[index],
      name: els.editUserName.value.trim(),
      phone: els.editUserPhone.value.trim(),
      status: els.editUserStatus.value,
      route: els.editUserRoute.value,
      schedule: els.editUserSchedule.value.trim() || "A definir",
      mapped: els.editUserRoute.value === "sim"
    };

    closeModal();
    applyFilters();
  });

  els.deleteUserBtn.addEventListener("click", () => {
    const id = els.editUserId.value;
    users = users.filter((u) => u.id !== id);
    closeModal();
    applyFilters();
  });

  document.getElementById("btnExportarLista")?.addEventListener("click", () => {
    alert("Próximo passo: exportar lista em CSV/PDF.");
  });
}

initMap();
bindEvents();
renderAll();