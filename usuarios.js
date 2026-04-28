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
  setDoc,
  query,
  where
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
  coopUsers: [],
  territoryBase: DEFAULT_BASE,
  unsubParticipants: null,
  unsubApprovals: null,
  unsubCoopUsers: null,
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
  modalRouteShift: document.getElementById("modalRouteShift"),
  labelStatusFilter: document.getElementById("labelStatusFilter"),
  labelRouteFilter: document.getElementById("labelRouteFilter"),
  labelSearchInput: document.getElementById("labelSearchInput"),
  labelAddressInput: document.getElementById("labelAddressInput"),
  modalRequestInfo: document.getElementById("modalRequestInfo"),
  userModalStatusNote: document.getElementById("userModalStatusNote"),
  modalFocusMap: document.getElementById("modalFocusMap"),
  modalRejectBtn: document.getElementById("modalRejectBtn"),
  modalApproveBtn: document.getElementById("modalApproveBtn"),
  debugStatus: document.getElementById("debugStatus"),

  coopUsersSection: document.getElementById("coopUsersSection"),
  coopUserCreateCard: document.getElementById("coopUserCreateCard"),
  coopUserForm: document.getElementById("coopUserForm"),
  coopUserName: document.getElementById("coopUserName"),
  coopUserDisplayName: document.getElementById("coopUserDisplayName"),
  coopUserEmail: document.getElementById("coopUserEmail"),
  coopUserPassword: document.getElementById("coopUserPassword"),
  coopUserRole: document.getElementById("coopUserRole"),
  coopUserTerritory: document.getElementById("coopUserTerritory"),
  btnCreateCoopUser: document.getElementById("btnCreateCoopUser"),
  coopUsersList: document.getElementById("coopUsersList"),
  coopUsersCountLabel: document.getElementById("coopUsersCountLabel"),

  permDashboard: document.getElementById("permDashboard"),
  permColetas: document.getElementById("permColetas"),
  permParticipants: document.getElementById("permParticipants"),
  permConteudos: document.getElementById("permConteudos"),
  permDocumentos: document.getElementById("permDocumentos"),
  permMapa: document.getElementById("permMapa"),
  permAprovarCadastros: document.getElementById("permAprovarCadastros"),
  permGerenciarUsuarios: document.getElementById("permGerenciarUsuarios")
};

let map = null;
let baseMarker = null;
let userMarkers = [];
let routePolyline = null;
let toastEl = null;

/* =========================
UTILS
========================= */

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  let raw = String(value).trim().replace(",", ".");
  let n = Number(raw);

  if (!Number.isFinite(n)) return null;

  if (Math.abs(n) > 180) {
    const sign = n < 0 ? -1 : 1;
    const digits = String(Math.abs(Math.trunc(n)));

    if (digits.length >= 4) {
      const fixed = Number(digits.slice(0, 2) + "." + digits.slice(2));
      n = sign * fixed;
    }
  }

  return Number.isFinite(n) ? n : null;
}

function isValidCoord(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
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

  const rua = data?.rua || data?.street || data?.address?.street || "";
  const numero = data?.numero || data?.address?.number || "";
  const bairro = data?.bairro || data?.neighborhood || data?.address?.neighborhood || "";
  const cidade = data?.cidade || data?.city || data?.address?.city || "";
  const uf = data?.uf || data?.state || data?.address?.state || "";
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

function roleName() {
  return String(STATE.userDoc?.role || "").toLowerCase();
}

function canViewAllTerritories() {
  return ["governanca", "gestor", "superadmin", "admin_master"].includes(roleName());
}

function canManageApprovals() {
  return ["admin", "governanca", "gestor", "superadmin", "admin_master"].includes(roleName());
}

function canManageCoopUsers() {
  return ["admin", "governanca", "gestor", "superadmin", "admin_master"].includes(roleName());
}

function getMyTerritoryId() {
  return STATE.userDoc?.territoryId || null;
}

function getMyTerritoryLabel() {
  return STATE.userDoc?.territoryLabel || null;
}

function canViewUserFromSameTerritory(targetUser) {
  if (!STATE.userDoc || !targetUser) return false;
  if (canViewAllTerritories()) return true;
  return sameTerritory(getMyTerritoryId(), targetUser.territoryId);
}

function getTerritoryLabelById(territoryId) {
  const normalized = normalizeTerritory(territoryId);
  if (normalized === "vila-pinto") return "Centro de Triagem Vila Pinto";
  if (normalized === "cooadesc" || normalized === "coadesc") return "COOADESC";
  if (normalized === "padre-cacique") return "Padre Cacique";
  return territoryId || "Território";
}

function routeShiftLabel(value) {
  const normalized = String(value || "").trim();

  const map = {
    segunda_manha: "Segunda-feira • Manhã",
    segunda_tarde: "Segunda-feira • Tarde",
    terca_manha: "Terça-feira • Manhã",
    terca_tarde: "Terça-feira • Tarde",
    quarta_manha: "Quarta-feira • Manhã",
    quarta_tarde: "Quarta-feira • Tarde",
    quinta_manha: "Quinta-feira • Manhã",
    quinta_tarde: "Quinta-feira • Tarde",
    sexta_manha: "Sexta-feira • Manhã",
    sexta_tarde: "Sexta-feira • Tarde"
  };

  return map[normalized] || "Rota não definida";
}

function getTerritoryPageUrl(user) {
  const territory = normalizeTerritory(user?.territoryId || getMyTerritoryId());
  const code = encodeURIComponent(user?.code || user?.participantCode || "");

  if (territory === "vila-pinto") {
    return `${window.location.origin}/cadastro-coletas-vila-pinto.html?participantCode=${code}`;
  }

  if (territory === "cooadesc" || territory === "coadesc") {
    return `${window.location.origin}/cadastro-coletas-cooadesc.html?participantCode=${code}`;
  }

  if (territory === "padre-cacique") {
    return `${window.location.origin}/cadastro-coletas-padre-cacique.html?participantCode=${code}`;
  }

  return `${window.location.origin}/cadastro-coletas-vila-pinto.html?participantCode=${code}`;
}

function ensureBaseGeneralFilters() {
  const table = els.usersTableBody?.closest("table");
  const panel = table?.closest(".panel-card");

  if (!panel || panel.querySelector("#labelFiltersCard")) return;

  const filters = document.createElement("div");
  filters.id = "labelFiltersCard";
  filters.className = "filters-grid";
  filters.style.margin = "16px 0";

  filters.innerHTML = `
    <div class="field">
      <label for="labelStatusFilter">Status</label>
      <select id="labelStatusFilter">
        <option value="all">Todos</option>
        <option value="pendente">Pendentes</option>
        <option value="aprovado">Aprovados</option>
        <option value="inativo">Inativos</option>
      </select>
    </div>

    <div class="field">
      <label for="labelRouteFilter">Rota</label>
      <select id="labelRouteFilter">
        <option value="all">Todas as rotas</option>
        <option value="">Sem rota definida</option>
        <option value="segunda_manha">Segunda-feira • Manhã</option>
        <option value="segunda_tarde">Segunda-feira • Tarde</option>
        <option value="terca_manha">Terça-feira • Manhã</option>
        <option value="terca_tarde">Terça-feira • Tarde</option>
        <option value="quarta_manha">Quarta-feira • Manhã</option>
        <option value="quarta_tarde">Quarta-feira • Tarde</option>
        <option value="quinta_manha">Quinta-feira • Manhã</option>
        <option value="quinta_tarde">Quinta-feira • Tarde</option>
        <option value="sexta_manha">Sexta-feira • Manhã</option>
        <option value="sexta_tarde">Sexta-feira • Tarde</option>
      </select>
    </div>

    <div class="field">
      <label for="labelSearchInput">Participante</label>
      <input id="labelSearchInput" type="text" placeholder="Nome, código ou telefone" />
    </div>

    <div class="field">
      <label for="labelAddressInput">Endereço</label>
      <input id="labelAddressInput" type="text" placeholder="Rua, bairro, cidade ou CEP" />
    </div>
  `;

  const tableWrap = panel.querySelector(".table-wrap");
  panel.insertBefore(filters, tableWrap || table);

  els.labelStatusFilter = document.getElementById("labelStatusFilter");
  els.labelRouteFilter = document.getElementById("labelRouteFilter");
  els.labelSearchInput = document.getElementById("labelSearchInput");
  els.labelAddressInput = document.getElementById("labelAddressInput");

  els.labelStatusFilter?.addEventListener("change", renderTable);
  els.labelRouteFilter?.addEventListener("change", renderTable);
  els.labelSearchInput?.addEventListener("input", renderTable);
  els.labelAddressInput?.addEventListener("input", renderTable);
}

function ensureTableHeaderForLabels() {
  const table = els.usersTableBody?.closest("table");
  const headRow = table?.querySelector("thead tr");

  if (!headRow) return;

  headRow.innerHTML = `
    <th>Participante</th>
    <th>Status</th>
    <th>Operação</th>
    <th>Rota</th>
    <th>Endereço</th>
    <th>Ações</th>
  `;
}

function loadQRCodeLib() {
  return Promise.resolve();
}

function generateLabelHtml(user, qrUrl, targetUrl) {
  return `
    <section class="label-card">
      <div class="label-top">
        <strong>NSRU</strong>
        <span>Etiqueta do participante</span>
      </div>

      <div class="label-content">
        <h1>${safeText(user.name)}</h1>

        <div class="label-row">
          <span>Código do participante</span>
          <strong>${safeText(user.code)}</strong>
        </div>

        <div class="label-row">
          <span>Rota de coleta</span>
          <strong>${routeShiftLabel(user.routeShift || user.schedule)}</strong>
        </div>

        <div class="label-qr">
          <img src="${qrUrl}" alt="QR Code do participante" />
        </div>

        <p>Escaneie o QR Code para abrir a página de coleta da cooperativa.</p>
        <small>${safeText(targetUrl)}</small>
      </div>
    </section>
  `;
}

async function printParticipantLabel(userId) {
  const user = STATE.users.find((item) => item.id === userId);
  if (!user) return;

  try {
    await loadQRCodeLib();

    const targetUrl = getTerritoryPageUrl(user);
    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=" +
      encodeURIComponent(targetUrl);

    const printWindow = window.open("", "_blank", "width=460,height=680");

    if (!printWindow) {
      alert("O navegador bloqueou a abertura da etiqueta. Permita pop-ups para esta página.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Etiqueta ${safeText(user.code)}</title>
        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 24px;
            font-family: Arial, sans-serif;
            background: #f4f7ef;
            color: #1f2a18;
          }

          .label-card {
            width: 360px;
            min-height: 500px;
            margin: 0 auto;
            background: #fff;
            border: 2px solid #1f2a18;
            border-radius: 22px;
            overflow: hidden;
            box-shadow: 0 18px 50px rgba(0, 0, 0, .12);
          }

          .label-top {
            background: #81B92A;
            padding: 18px;
            text-align: center;
            color: #1f2a18;
          }

          .label-top strong {
            display: block;
            font-size: 32px;
            letter-spacing: 1px;
          }

          .label-top span {
            display: block;
            margin-top: 4px;
            font-size: 14px;
            font-weight: 700;
          }

          .label-content {
            padding: 20px;
            text-align: center;
          }

          .label-content h1 {
            margin: 0 0 16px;
            font-size: 22px;
            line-height: 1.1;
          }

          .label-row {
            margin-bottom: 12px;
            padding: 12px;
            border: 1px solid #d8e8c0;
            border-radius: 14px;
            text-align: left;
            background: #fbfdf7;
          }

          .label-row span {
            display: block;
            font-size: 11px;
            color: #61704f;
            text-transform: uppercase;
            letter-spacing: .04em;
          }

          .label-row strong {
            display: block;
            margin-top: 4px;
            font-size: 18px;
          }

          .label-qr {
            margin: 18px 0 10px;
          }

          .label-qr img {
            width: 190px;
            height: 190px;
          }

          p {
            margin: 8px 0 6px;
            color: #536044;
            font-size: 13px;
          }

          small {
            display: block;
            word-break: break-all;
            color: #7d8872;
            font-size: 10px;
          }

          @media print {
            body {
              padding: 0;
              background: #fff;
            }

            .label-card {
              width: 100%;
              min-height: auto;
              margin: 0;
              border-radius: 0;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        ${generateLabelHtml(user, qrUrl, targetUrl)}
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  } catch (error) {
    console.error("Erro ao gerar etiqueta:", error);
    alert("Não foi possível gerar a etiqueta do participante.");
  }
}

function setDebug(message, strong = "Status do sistema.") {
  if (!els.debugStatus) return;
  els.debugStatus.classList.remove("hidden");
  els.debugStatus.innerHTML = `<strong>${strong}</strong><span>${message}</span>`;
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
    background: "rgba(33,42,24,.95)",
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
  }, 3200);
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

/* =========================
USUÁRIOS INTERNOS DA COOP
========================= */

function getCoopPermissionsPayload() {
  return {
    dashboard: !!els.permDashboard?.checked,
    coletas: !!els.permColetas?.checked,
    participants: !!els.permParticipants?.checked,
    conteudos: !!els.permConteudos?.checked,
    documentos: !!els.permDocumentos?.checked,
    mapa: !!els.permMapa?.checked,
    aprovarCadastros: !!els.permAprovarCadastros?.checked,
    gerenciarUsuarios: !!els.permGerenciarUsuarios?.checked
  };
}

function getCoopRolesPayload() {
  return {
    cooperativa: true,
    dashboard: !!els.permDashboard?.checked,
    coletas: !!els.permColetas?.checked,
    participants: !!els.permParticipants?.checked,
    conteudos: !!els.permConteudos?.checked,
    documentos: !!els.permDocumentos?.checked,
    mapa: !!els.permMapa?.checked,
    aprovarCadastros: !!els.permAprovarCadastros?.checked,
    gerenciarUsuarios: !!els.permGerenciarUsuarios?.checked
  };
}

function usersRef() {
  if (canViewAllTerritories()) {
    return collection(db, "users");
  }

  const territoryId = getMyTerritoryId();
  if (!territoryId) {
    throw new Error("Usuário sem territoryId em /users.");
  }

  return query(collection(db, "users"), where("territoryId", "==", territoryId));
}

function mapInternalUserDoc(docSnap) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    uid: data.uid || docSnap.id,
    name: data.name || data.displayName || "Usuário",
    displayName: data.displayName || data.name || "Usuário",
    email: data.email || "",
    role: String(data.role || "").toLowerCase(),
    status: String(data.status || "").toLowerCase(),
    territoryId: data.territoryId || null,
    territoryLabel: data.territoryLabel || "",
    permissions: data.permissions || {},
    raw: data
  };
}

function internalUserRoleLabel(role) {
  if (role === "admin") return "Administrador";
  if (role === "cooperativa") return "Cooperativa";
  if (role === "operador") return "Operador";
  if (role === "usuario") return "Usuário";
  return role || "Perfil";
}

function renderCoopUsersList() {
  if (!els.coopUsersList) return;

  const list = STATE.coopUsers.filter((item) => {
    if (canViewAllTerritories()) {
      return ["admin", "cooperativa", "operador", "usuario"].includes(item.role);
    }

    return ["admin", "cooperativa", "operador", "usuario"].includes(item.role)
      && canViewUserFromSameTerritory(item);
  });

  if (els.coopUsersCountLabel) {
    els.coopUsersCountLabel.textContent = `${list.length} itens`;
  }

  if (!list.length) {
    els.coopUsersList.innerHTML = `<div class="empty-state">Nenhum usuário interno da cooperativa encontrado.</div>`;
    return;
  }

  els.coopUsersList.innerHTML = list.map((item) => {
    const permissions = item.permissions || {};
    const permissionLabels = [];
    if (permissions.dashboard) permissionLabels.push("Dashboard");
    if (permissions.coletas) permissionLabels.push("Coletas");
    if (permissions.participants) permissionLabels.push("Participantes");
    if (permissions.conteudos) permissionLabels.push("Conteúdos");
    if (permissions.documentos) permissionLabels.push("Documentos");
    if (permissions.mapa) permissionLabels.push("Mapa");
    if (permissions.aprovarCadastros) permissionLabels.push("Aprovar cadastros");
    if (permissions.gerenciarUsuarios) permissionLabels.push("Gerenciar usuários");

    return `
      <article class="coop-user-card">
        <div class="coop-user-card-top">
          <div>
            <strong>${safeText(item.displayName || item.name)}</strong>
            <span>${safeText(item.email)}</span>
          </div>
        </div>

        <div class="coop-user-badges">
          <span class="coop-user-badge">${safeText(internalUserRoleLabel(item.role))}</span>
          <span class="coop-user-badge">${safeText(item.territoryLabel || item.territoryId)}</span>
          <span class="coop-user-badge">${safeText(item.status || "active")}</span>
        </div>

        <div class="coop-user-permissions">
          ${permissionLabels.length
            ? permissionLabels.map((label) => `<span class="coop-user-permission">${safeText(label)}</span>`).join("")
            : `<span class="coop-user-permission">Sem permissões extras</span>`
          }
        </div>
      </article>
    `;
  }).join("");
}

async function createCoopUserRecord() {
  if (!canManageCoopUsers()) {
    alert("Seu perfil não tem permissão para criar usuários da cooperativa.");
    return;
  }

  const name = els.coopUserName?.value?.trim();
  const displayName = els.coopUserDisplayName?.value?.trim() || name;
  const email = els.coopUserEmail?.value?.trim().toLowerCase();
  const password = els.coopUserPassword?.value?.trim();
  const role = els.coopUserRole?.value || "cooperativa";
  const territoryId = canViewAllTerritories()
    ? (els.coopUserTerritory?.value || getMyTerritoryId())
    : getMyTerritoryId();
  const territoryLabel = getTerritoryLabelById(territoryId);

  if (!name || !email || !password) {
    alert("Preencha nome, e-mail e senha provisória.");
    return;
  }

  try {
    if (els.btnCreateCoopUser) {
      els.btnCreateCoopUser.disabled = true;
      els.btnCreateCoopUser.textContent = "Criando...";
    }

    const existingQuery = query(collection(db, "users"), where("email", "==", email));
    const existingSnap = await getDocs(existingQuery);

    if (!existingSnap.empty) {
      throw new Error("Já existe um usuário cadastrado com este e-mail.");
    }

    const userDocRef = doc(collection(db, "users"));
    const payload = {
      uid: userDocRef.id,
      name,
      displayName,
      email,
      role,
      status: "active",
      territoryId,
      territoryLabel,
      onboardingCompleted: true,
      permissions: getCoopPermissionsPayload(),
      roles: getCoopRolesPayload(),
      publicCode: `RB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: STATE.authUser?.uid || null,
      createdByName: STATE.userDoc?.name || STATE.userDoc?.displayName || "Administrador",
      provisionalPassword: password
    };

    await setDoc(userDocRef, payload);

    showToast("Usuário da cooperativa criado com sucesso.");
    els.coopUserForm?.reset();

    if (els.permDashboard) els.permDashboard.checked = true;
    if (els.permColetas) els.permColetas.checked = true;
    if (els.permParticipants) els.permParticipants.checked = true;
    if (els.permConteudos) els.permConteudos.checked = true;
    if (els.permDocumentos) els.permDocumentos.checked = true;
    if (els.permMapa) els.permMapa.checked = true;

    if (!canViewAllTerritories() && els.coopUserTerritory) {
      els.coopUserTerritory.value = getMyTerritoryId() || "vila-pinto";
    }
  } catch (error) {
    console.error("Erro ao criar usuário da cooperativa:", error);
    alert(`Não foi possível criar o usuário.\n${error?.message || ""}`);
  } finally {
    if (els.btnCreateCoopUser) {
      els.btnCreateCoopUser.disabled = false;
      els.btnCreateCoopUser.textContent = "Criar usuário da cooperativa";
    }
  }
}

function applyCoopUserPermissionsUI() {
  if (!els.coopUsersSection) return;

  if (!canManageCoopUsers()) {
    els.coopUsersSection.classList.add("hidden");
    return;
  }

  els.coopUsersSection.classList.remove("hidden");

  if (!canViewAllTerritories() && els.coopUserTerritory) {
    els.coopUserTerritory.value = getMyTerritoryId() || "vila-pinto";
    els.coopUserTerritory.disabled = true;
  }
}

function startUsersListener() {
  if (STATE.unsubCoopUsers) {
    STATE.unsubCoopUsers();
    STATE.unsubCoopUsers = null;
  }

  try {
    STATE.unsubCoopUsers = onSnapshot(
      usersRef(),
      (snapshot) => {
        STATE.coopUsers = snapshot.docs.map(mapInternalUserDoc);
        renderCoopUsersList();
      },
      async (error) => {
        console.warn("Listener users falhou:", error);
        try {
          const snap = await getDocs(usersRef());
          STATE.coopUsers = snap.docs.map(mapInternalUserDoc);
          renderCoopUsersList();
        } catch (fallbackError) {
          console.error("Erro ao carregar users:", fallbackError);
          if (els.coopUsersList) {
            els.coopUsersList.innerHTML = `<div class="empty-state">Não foi possível carregar os usuários da cooperativa.</div>`;
          }
        }
      }
    );
  } catch (error) {
    console.warn("Erro ao iniciar listener users:", error);
  }
}

/* =========================
QUERIES
========================= */

function participantsRef() {
  if (canViewAllTerritories()) {
    return collection(db, "participants");
  }

  const territoryId = getMyTerritoryId();
  if (!territoryId) {
    throw new Error("Usuário sem territoryId em /users.");
  }

  return query(collection(db, "participants"), where("territoryId", "==", territoryId));
}

function approvalRequestsRefs() {
  if (canViewAllTerritories()) {
    return [collection(db, "approvalRequests")];
  }

  const territoryId = getMyTerritoryId();
  if (!territoryId) {
    throw new Error("Usuário sem territoryId em /users.");
  }

  return [
    query(collection(db, "approvalRequests"), where("territoryId", "==", territoryId)),
    query(collection(db, "approvalRequests"), where("payloadSnapshot.territoryId", "==", territoryId))
  ];
}

function dedupeApprovalDocs(docs) {
  const mapDocs = new Map();

  docs.forEach((docSnap) => {
    if (!mapDocs.has(docSnap.id)) {
      mapDocs.set(docSnap.id, docSnap);
    }
  });

  return Array.from(mapDocs.values());
}

/* =========================
MAPEAMENTO DOS DOCS
========================= */

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
    routeShift: data.routeShift || data.rota || data.schedule || "",
    wasteKg: Number(data.wasteKg || 0),
    raw: data
  };
}

function mapApprovalRequestDoc(docSnap) {
  const data = docSnap.data() || {};
  const snapshot = data.payloadSnapshot || {};

  return {
    id: docSnap.id,
    participantId: data.targetId || data.participantId || null,
    participantName: data.participantName || snapshot.name || "Solicitação pendente",
    participantCode: data.participantCode || snapshot.participantCode || "—",
    participantPhone: data.participantPhone || snapshot.phone || "",
    participantEmail: data.participantEmail || snapshot.email || "",
    participantCpf: data.participantCpf || snapshot.cpf || "",
    territoryId: data.territoryId || snapshot.territoryId || null,
    territoryLabel: data.territoryLabel || snapshot.territoryLabel || "",
    status: String(data.status || "pending").toLowerCase().trim(),
    raw: data
  };
}

/* =========================
MERGE SEM DUPLICAÇÃO
========================= */

function mergeUsers() {
  const participantById = new Map();
  const participantByApprovalRequestId = new Map();
  const participantByCode = new Map();
  const participantByCpf = new Map();
  const participantByPhone = new Map();

  STATE.participants.forEach((participant) => {
    participantById.set(participant.id, participant);

    if (participant.approvalRequestId) {
      participantByApprovalRequestId.set(participant.approvalRequestId, participant);
    }
    if (participant.code && participant.code !== "—") {
      participantByCode.set(String(participant.code).toLowerCase(), participant);
    }
    if (participant.cpf) {
      participantByCpf.set(String(participant.cpf).replace(/\D/g, ""), participant);
    }
    if (participant.phone) {
      participantByPhone.set(onlyDigits(participant.phone), participant);
    }
  });

  const pendingFromRequests = STATE.approvalRequests
    .filter((req) => !["approved", "rejected"].includes(String(req.status || "").toLowerCase().trim()))
    .map((req) => {
      const raw = req.raw || {};
      const snapshot = raw.payloadSnapshot || {};

      const participant =
        participantById.get(req.participantId) ||
        participantByApprovalRequestId.get(req.id) ||
        participantByCode.get(String(req.participantCode || snapshot.participantCode || "").toLowerCase()) ||
        participantByCpf.get(String(req.participantCpf || snapshot.cpf || "").replace(/\D/g, "")) ||
        participantByPhone.get(onlyDigits(req.participantPhone || snapshot.phone || "")) ||
        null;

      return {
        id: participant?.id || req.participantId || `approval_${req.id}`,
        linkedApprovalRequestId: req.id,
        approvalRequestId: req.id,
        name: participant?.name || req.participantName || snapshot.name || "Solicitação pendente",
        code: participant?.code || req.participantCode || snapshot.participantCode || "—",
        phone: participant?.phone || req.participantPhone || snapshot.phone || "",
        email: participant?.email || req.participantEmail || snapshot.email || "",
        cpf: participant?.cpf || req.participantCpf || snapshot.cpf || "",
        territoryId: participant?.territoryId || req.territoryId || snapshot.territoryId || null,
        territoryLabel: participant?.territoryLabel || req.territoryLabel || snapshot.territoryLabel || "",
        status: "pendente",
        rawStatus: "pendente",
        approvalStatus: "pending",
        inOperation: "nao",
        inTerritory: "sim",
        address: participant?.address || buildAddress(snapshot) || "—",
        lat: participant?.lat ?? toNumberOrNull(snapshot.lat),
        lng: participant?.lng ?? toNumberOrNull(snapshot.lng),
        schedule: participant?.schedule || "A definir",
        routeShift: participant?.routeShift || snapshot.routeShift || snapshot.rota || snapshot.schedule || "",
        wasteKg: Number(participant?.wasteKg || 0),
        raw: participant?.raw || raw
      };
    });

  const standaloneParticipants = STATE.participants
    .filter((participant) => participant.status !== "inativo")
    .map((participant) => {
      const isPendingParticipant =
        participant.status === "pendente" ||
        String(participant.approvalStatus || "").toLowerCase().trim() === "pending";

      return {
        ...participant,
        status: isPendingParticipant ? "pendente" : participant.status,
        linkedApprovalRequestId: participant.approvalRequestId || null
      };
    });

  const allItems = [...pendingFromRequests, ...standaloneParticipants];

  function identityKey(item) {
    const code = String(item.code || "").trim().toLowerCase();
    const cpf = String(item.cpf || "").replace(/\D/g, "");
    const phone = onlyDigits(item.phone || "");
    const name = String(item.name || "").trim().toLowerCase();

    return [code, cpf, phone, name].join("|");
  }

  const grouped = new Map();

  allItems.forEach((item) => {
    const key = identityKey(item);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });

  const finalUsers = [];

  grouped.forEach((items) => {
    const approved = items.find((i) => i.status === "aprovado");
    if (approved) {
      finalUsers.push(approved);
      return;
    }

    const pending = items.filter((i) => i.status === "pendente");

    if (pending.length) {
      pending.sort((a, b) => {
        const aDate = a.raw?.createdAt?.seconds || 0;
        const bDate = b.raw?.createdAt?.seconds || 0;
        return bDate - aDate;
      });

      finalUsers.push(pending[0]);
      return;
    }

    const inactive = items.find((i) => i.status === "inativo");
    if (inactive) {
      finalUsers.push(inactive);
    }
  });

  STATE.users = finalUsers.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
  );

  emitPendingNotifications();
  applyFilters();
}

function emitPendingNotifications() {
  const currentPendingIds = new Set(
    STATE.users
      .filter((u) => u.status === "pendente")
      .map((u) => u.linkedApprovalRequestId || u.approvalRequestId || u.id)
  );

  currentPendingIds.forEach((id) => {
    if (!STATE.lastPendingIds.has(id)) {
      const user = STATE.users.find(
        (u) => (u.linkedApprovalRequestId || u.approvalRequestId || u.id) === id
      );
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

/* =========================
RENDER
========================= */

function computeKpis() {
  const total = STATE.filteredUsers.length;
  const pending = STATE.filteredUsers.filter((u) => u.status === "pendente").length;
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

function renderApprovedList() {
  if (!els.activeList) return;

  const active = STATE.filteredUsers.filter((u) => u.status === "aprovado");

  if (!active.length) {
    els.activeList.innerHTML = `<div class="empty-state">Nenhum usuário aprovado encontrado.</div>`;
    return;
  }

  els.activeList.innerHTML = active.map((user) => `
    <article class="user-item">
      <div class="user-main">
        <strong>${safeText(user.name)}</strong>
        <span>Código: ${safeText(user.code)}</span>
        <span>Telefone: ${safeText(user.phone)}</span>
        <span>${safeText(user.address)}</span>
      </div>

      <div class="user-actions">
        <span class="${badgeClass(user.status)}">Aprovado</span>
        <button class="btn btn-ghost" data-action="focus" data-id="${user.id}" type="button">Ver no mapa</button>
        <button class="btn btn-ghost" data-action="open" data-id="${user.id}" type="button">Abrir</button>
      </div>
    </article>
  `).join("");
}

function renderPendingList() {
  if (!els.pendingList) return;

  const pending = STATE.filteredUsers.filter((u) => u.status === "pendente");

  if (!pending.length) {
    els.pendingList.innerHTML = `<div class="empty-state">Nenhum usuário pendente de aprovação.</div>`;
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

function renderTable() {
  if (!els.usersTableBody) return;

  ensureBaseGeneralFilters();
  ensureTableHeaderForLabels();

  const statusFilter = String(els.labelStatusFilter?.value || "all");
  const routeFilter = String(els.labelRouteFilter?.value ?? "all");
  const participantTerm = String(els.labelSearchInput?.value || "").trim().toLowerCase();
  const addressTerm = String(els.labelAddressInput?.value || "").trim().toLowerCase();

  const allUsers = STATE.filteredUsers
    .filter((u) => {
      if (statusFilter === "all") return u.status !== "inativo";
      return u.status === statusFilter;
    })
    .filter((user) => {
      const routeValue = String(user.routeShift || user.schedule || "").trim();

      const matchesRoute =
        routeFilter === "all" ||
        (routeFilter === "" && routeValue === "") ||
        routeValue === routeFilter;

      const matchesParticipant =
        !participantTerm ||
        String(user.name || "").toLowerCase().includes(participantTerm) ||
        String(user.code || "").toLowerCase().includes(participantTerm) ||
        String(user.phone || "").toLowerCase().includes(participantTerm) ||
        String(user.email || "").toLowerCase().includes(participantTerm) ||
        String(user.cpf || "").toLowerCase().includes(participantTerm);

      const matchesAddress =
        !addressTerm ||
        String(user.address || "").toLowerCase().includes(addressTerm);

      return matchesRoute && matchesParticipant && matchesAddress;
    });

  if (!allUsers.length) {
    els.usersTableBody.innerHTML = `<tr><td colspan="6">Nenhum participante encontrado.</td></tr>`;
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
      <td>${routeShiftLabel(user.routeShift || user.schedule)}</td>
      <td>${safeText(user.address)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-dark" data-action="print-label" data-id="${user.id}" type="button">Etiqueta</button>
          ${canManageApprovals() && user.status === "pendente" ? `<button class="btn btn-success" data-action="approve" data-id="${user.id}" type="button">Aprovar</button>` : ""}
          ${canManageApprovals() && user.status === "pendente" ? `<button class="btn btn-danger" data-action="reject" data-id="${user.id}" type="button">Rejeitar</button>` : ""}
          <button class="btn btn-ghost" data-action="focus" data-id="${user.id}" type="button">Mapa</button>
          <button class="btn btn-ghost" data-action="open" data-id="${user.id}" type="button">Abrir</button>
        </div>
      </td>
    </tr>
  `).join("");
}

/* =========================
MAPA
========================= */

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

/* =========================
MODAL
========================= */

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
  if (els.modalRouteShift) {
    els.modalRouteShift.value = user.routeShift || "";
  }

  if (els.modalRequestInfo) {
    els.modalRequestInfo.textContent = user.linkedApprovalRequestId
      ? `Solicitação vinculada: ${user.linkedApprovalRequestId}`
      : "Sem solicitação vinculada.";
  }

  if (els.userModalStatusNote) {
    els.userModalStatusNote.textContent =
      user.status === "pendente"
        ? "Este usuário está aguardando aprovação."
        : user.status === "aprovado"
          ? "Este usuário está aprovado."
          : "Este usuário está inativo.";
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

/* =========================
APROVAÇÃO / REJEIÇÃO
========================= */

function isSameRequestIdentity(req, user) {
  const sameCode =
    String(req.participantCode || "").trim().toLowerCase() ===
    String(user.code || "").trim().toLowerCase();

  const sameCpf =
    String(req.participantCpf || "").replace(/\D/g, "") ===
    String(user.cpf || "").replace(/\D/g, "");

  const samePhone =
    onlyDigits(req.participantPhone || "") ===
    onlyDigits(user.phone || "");

  return sameCode || (sameCpf && sameCpf !== "") || (samePhone && samePhone !== "");
}

async function upsertParticipantFromApprovedRequest(user) {
  const participantId =
    user.id && !String(user.id).startsWith("approval_")
      ? user.id
      : (user.code
          ? user.code.replace(/[^a-zA-Z0-9_-]/g, "_")
          : "participant_" + user.linkedApprovalRequestId);

  const snapshot = user.raw?.payloadSnapshot || {};
  const isApproved = user.status === "aprovado";

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
    inOperation: user.inOperation || (isApproved ? "sim" : "nao"),
    schedule: user.routeShift || user.schedule || "A definir",
    routeShift: user.routeShift || "",
    status: user.status || "pendente",
    approvalStatus: isApproved ? "approved" : "pending",
    active: isApproved,
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

  try {
    const batch = writeBatch(db);

    const sameRequests = STATE.approvalRequests.filter((req) => isSameRequestIdentity(req, user));

    sameRequests.forEach((req) => {
      batch.update(doc(db, "approvalRequests", req.id), {
        status: "approved",
        decision: "approved",
        reviewedAt: serverTimestamp(),
        reviewedBy: STATE.authUser?.uid || null,
        reviewedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null
      });
    });

    await batch.commit();

    const modalIsCurrentUser = els.modalUserId?.value === userId;
    const selectedRouteShift = modalIsCurrentUser ? (els.modalRouteShift?.value || user.routeShift || "") : (user.routeShift || "");

    await upsertParticipantFromApprovedRequest({
      ...user,
      status: "aprovado",
      inOperation: "sim",
      routeShift: selectedRouteShift,
      schedule: selectedRouteShift || user.schedule || "A definir"
    });

    closeUserModal();
    showToast("Usuário aprovado com sucesso.");
    await reloadAll();
  } catch (error) {
    console.error("Erro ao aprovar usuário:", error);
    alert(`Não foi possível aprovar este usuário.\n${error?.message || ""}`);
  }
}

async function rejectUser(userId) {
  if (!canManageApprovals()) {
    alert("Seu perfil não tem permissão para rejeitar participantes.");
    return;
  }

  const user = STATE.users.find((item) => item.id === userId);
  if (!user) return;

  try {
    const batch = writeBatch(db);

    const sameRequests = STATE.approvalRequests.filter((req) => isSameRequestIdentity(req, user));

    sameRequests.forEach((req) => {
      batch.update(doc(db, "approvalRequests", req.id), {
        status: "rejected",
        decision: "rejected",
        reviewedAt: serverTimestamp(),
        reviewedBy: STATE.authUser?.uid || null,
        reviewedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null
      });
    });

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

    await batch.commit();

    closeUserModal();
    showToast("Solicitação rejeitada.");
    await reloadAll();
  } catch (error) {
    console.error("Erro ao rejeitar usuário:", error);
    alert(`Não foi possível rejeitar este usuário.\n${error?.message || ""}`);
  }
}

async function saveModalUserChanges() {
  const userId = els.modalUserId?.value;
  if (!userId) return;

  const user = STATE.users.find((item) => item.id === userId);
  if (!user) return;

  const chosenStatus = els.modalUserStatus?.value || user.status;
  const chosenOperation = chosenStatus === "aprovado" ? (els.modalOperation?.value || "sim") : "nao";
  const chosenRouteShift = els.modalRouteShift?.value || "";

  try {
    if (chosenStatus === "inativo") {
      await rejectUser(userId);
      return;
    }

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
      status: chosenStatus,
      routeShift: chosenRouteShift,
      schedule: chosenRouteShift || user.schedule || "A definir"
    });

    if (chosenStatus === "aprovado") {
      const batch = writeBatch(db);

      const sameRequests = STATE.approvalRequests.filter((req) => isSameRequestIdentity(req, user));

      sameRequests.forEach((req) => {
        batch.update(doc(db, "approvalRequests", req.id), {
          status: "approved",
          decision: "approved",
          reviewedAt: serverTimestamp(),
          reviewedBy: STATE.authUser?.uid || null,
          reviewedByName: STATE.userDoc?.name || STATE.userDoc?.nome || null
        });
      });

      await batch.commit();
    }

    closeUserModal();
    showToast("Alterações salvas.");
    await reloadAll();
  } catch (error) {
    console.error("Erro ao salvar alterações:", error);
    alert("Não foi possível salvar as alterações do participante.");
  }
}

/* =========================
LOAD
========================= */

async function loadParticipantsInitial() {
  try {
    const snap = await getDocs(participantsRef());
    STATE.participants = snap.docs.map(mapParticipantDoc);
    mergeUsers();
  } catch (error) {
    console.error("Erro ao carregar participants:", error);
    setDebug(`Erro ao carregar participants: ${error?.message || "desconhecido"}`);
  }
}

async function loadApprovalsInitial() {
  try {
    const refs = approvalRequestsRefs();

    if (canViewAllTerritories()) {
      const snap = await getDocs(refs[0]);
      STATE.approvalRequests = snap.docs.map(mapApprovalRequestDoc);
      mergeUsers();
      return;
    }

    const snaps = await Promise.all(refs.map((ref) => getDocs(ref)));
    const mergedDocs = dedupeApprovalDocs(snaps.flatMap((snap) => snap.docs));

    STATE.approvalRequests = mergedDocs.map(mapApprovalRequestDoc);
    mergeUsers();
  } catch (error) {
    console.error("Erro ao carregar approvalRequests:", error);
    setDebug(`Erro ao carregar approvalRequests: ${error?.message || "desconhecido"}`);
  }
}

async function reloadAll() {
  await loadApprovalsInitial();
  await loadParticipantsInitial();

  try {
    const snap = await getDocs(usersRef());
    STATE.coopUsers = snap.docs.map(mapInternalUserDoc);
    renderCoopUsersList();
  } catch (_error) {}
}

function startParticipantsListener() {
  if (STATE.unsubParticipants) {
    STATE.unsubParticipants();
    STATE.unsubParticipants = null;
  }

  try {
    STATE.unsubParticipants = onSnapshot(
      participantsRef(),
      (snapshot) => {
        STATE.participants = snapshot.docs.map(mapParticipantDoc);
        mergeUsers();
      },
      async (error) => {
        console.warn("Listener participants falhou:", error);
        await loadParticipantsInitial();
      }
    );
  } catch (error) {
    console.warn("Erro ao iniciar listener participants:", error);
  }
}

function startApprovalsListener() {
  if (STATE.unsubApprovals) {
    if (Array.isArray(STATE.unsubApprovals)) {
      STATE.unsubApprovals.forEach((fn) => fn && fn());
    } else {
      STATE.unsubApprovals();
    }
    STATE.unsubApprovals = null;
  }

  try {
    const refs = approvalRequestsRefs();

    if (canViewAllTerritories()) {
      STATE.unsubApprovals = onSnapshot(
        refs[0],
        (snapshot) => {
          STATE.approvalRequests = snapshot.docs.map(mapApprovalRequestDoc);
          mergeUsers();
        },
        async (error) => {
          console.warn("Listener approvalRequests falhou:", error);
          await loadApprovalsInitial();
        }
      );
      return;
    }

    const store = { a: [], b: [] };

    const rebuild = () => {
      const mergedDocs = dedupeApprovalDocs([...store.a, ...store.b]);
      STATE.approvalRequests = mergedDocs.map(mapApprovalRequestDoc);
      mergeUsers();
    };

    const unsubA = onSnapshot(
      refs[0],
      (snapshot) => {
        store.a = snapshot.docs;
        rebuild();
      },
      async (error) => {
        console.warn("Listener approvalRequests raiz falhou:", error);
        await loadApprovalsInitial();
      }
    );

    const unsubB = onSnapshot(
      refs[1],
      (snapshot) => {
        store.b = snapshot.docs;
        rebuild();
      },
      async (error) => {
        console.warn("Listener approvalRequests payloadSnapshot falhou:", error);
        await loadApprovalsInitial();
      }
    );

    STATE.unsubApprovals = [unsubA, unsubB];
  } catch (error) {
    console.warn("Erro ao iniciar listener approvalRequests:", error);
  }
}

async function loadCurrentUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário autenticado sem documento em /users.");
  return { id: snap.id, ...snap.data() };
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

function fillSidebar() {
  if (els.sidebarUserName) {
    els.sidebarUserName.textContent = STATE.userDoc?.name || STATE.userDoc?.nome || "Usuário";
  }
  if (els.sidebarTerritoryLabel) {
    els.sidebarTerritoryLabel.textContent = STATE.userDoc?.territoryLabel || STATE.userDoc?.territoryId || "Sem território";
  }

  const pills = document.querySelectorAll(".topbar-right .status-pill");
  const role = String(STATE.userDoc?.role || "usuario").toLowerCase();
  const territory = STATE.userDoc?.territoryLabel || STATE.userDoc?.territoryId || "Sem território";
  const seesAll = canViewAllTerritories();

  if (pills[0]) pills[0].textContent = seesAll ? "🟢 Todos os territórios" : `🟢 ${territory}`;
  if (pills[1]) pills[1].textContent = seesAll ? "🏢 Todas as cooperativas" : `🏢 ${territory}`;
  if (pills[2]) pills[2].textContent = canManageApprovals() ? "🔐 Administrador" : "🔐 Leitura";
  if (pills[3]) pills[3].textContent = `👤 ${role}`;
}

function renderAll() {
  computeKpis();
  renderApprovedList();
  renderPendingList();
  renderTable();
  renderMap();
  renderCoopUsersList();

  setDebug(
    `Participants: ${STATE.participants.length} • ApprovalRequests: ${STATE.approvalRequests.length} • Visíveis: ${STATE.filteredUsers.length} • Usuários internos: ${STATE.coopUsers.length}`,
    "Dados carregados."
  );
}

/* =========================
MENU LATERAL RESPONSIVO
========================= */

function openSidebarMenu() {
  document.querySelector(".sidebar")?.classList.add("open");
  document.getElementById("mobileOverlay")?.classList.add("show");
  document.body.classList.add("sidebar-open");
}

function closeSidebarMenu() {
  document.querySelector(".sidebar")?.classList.remove("open");
  document.getElementById("mobileOverlay")?.classList.remove("show");
  document.body.classList.remove("sidebar-open");
}

/* =========================
EVENTOS
========================= */

function bindEvents() {
  document.getElementById("menuBtn")?.addEventListener("click", openSidebarMenu);
  document.getElementById("sidebarClose")?.addEventListener("click", closeSidebarMenu);
  document.getElementById("mobileOverlay")?.addEventListener("click", closeSidebarMenu);

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1180) closeSidebarMenu();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) closeSidebarMenu();
  });

  els.searchInput?.addEventListener("input", applyFilters);
  els.statusFilter?.addEventListener("change", applyFilters);
  els.operationFilter?.addEventListener("change", applyFilters);

  els.routeMode?.addEventListener("change", async () => {
    renderMap();
    await buildRoute();
  });

  els.btnReload?.addEventListener("click", async () => {
    await reloadAll();
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
    if (action === "print-label") return printParticipantLabel(userId);
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

  els.coopUserForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createCoopUserRecord();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebarMenu();
      closeUserModal();
    }
  });
}

/* =========================
INIT
========================= */

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
    applyCoopUserPermissionsUI();
    await loadTerritoryBase();
    await maybeRequestNotificationPermission();

    if (map) {
      map.setView([STATE.territoryBase.lat, STATE.territoryBase.lng], 13);
    }

    await loadApprovalsInitial();
    await loadParticipantsInitial();

    try {
      const snap = await getDocs(usersRef());
      STATE.coopUsers = snap.docs.map(mapInternalUserDoc);
      renderCoopUsersList();
    } catch (error) {
      console.error("Erro ao carregar usuários da cooperativa:", error);
    }

    startApprovalsListener();
    startParticipantsListener();
    startUsersListener();

    setTimeout(async () => {
      renderMap();
      await buildRoute();
    }, 600);
  } catch (error) {
    console.error(error);
    setDebug(`Não foi possível carregar a página: ${error?.message || "erro desconhecido"}`, "Erro.");
    alert("Não foi possível carregar a página de gestão de usuários.");
  }
});