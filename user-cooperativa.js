import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
STATE
========================= */

const STATE = {
  authUser: null,
  userDoc: null,
  users: [],
  filtered: [],
  editingId: null,
  viewingId: null,
  unsubUsers: null
};

/* =========================
ELEMENTOS
========================= */

const els = {
  btnLogout: document.getElementById("btnLogout"),
  sidebarUserName: document.getElementById("sidebarUserName"),
  sidebarTerritoryLabel: document.getElementById("sidebarTerritoryLabel"),

  territoryPill: document.getElementById("territoryPill"),
  coopPill: document.getElementById("coopPill"),
  permissionPill: document.getElementById("permissionPill"),
  rolePill: document.getElementById("rolePill"),

  form: document.getElementById("coopUserForm"),
  formTitle: document.getElementById("formTitle"),
  editingUserId: document.getElementById("editingUserId"),
  name: document.getElementById("coopUserName"),
  displayName: document.getElementById("coopUserDisplayName"),
  email: document.getElementById("coopUserEmail"),
  password: document.getElementById("coopUserPassword"),
  passwordField: document.getElementById("passwordField"),
  role: document.getElementById("coopUserRole"),
  territory: document.getElementById("coopUserTerritory"),
  btnSubmit: document.getElementById("btnCreateCoopUser"),
  btnCancelEdit: document.getElementById("btnCancelEdit"),

  permDashboard: document.getElementById("permDashboard"),
  permColetas: document.getElementById("permColetas"),
  permParticipants: document.getElementById("permParticipants"),
  permConteudos: document.getElementById("permConteudos"),
  permDocumentos: document.getElementById("permDocumentos"),
  permMapa: document.getElementById("permMapa"),
  permAprovarCadastros: document.getElementById("permAprovarCadastros"),
  permGerenciarUsuarios: document.getElementById("permGerenciarUsuarios"),

  list: document.getElementById("coopUsersList"),
  count: document.getElementById("coopUsersCountLabel"),
  search: document.getElementById("coopUsersSearch"),
  statusFilter: document.getElementById("coopUsersStatusFilter"),

  btnDownload: document.getElementById("btnDownloadCoopUsers"),
  btnDownloadPDF: document.getElementById("btnDownloadPDF"),
  csvCountLabel: document.getElementById("csvCountLabel"),
  pdfCountLabel: document.getElementById("pdfCountLabel"),

  viewModal: document.getElementById("coopUserViewModal"),
  viewBackdrop: document.getElementById("coopUserViewBackdrop"),
  closeViewModal: document.getElementById("closeViewModal"),
  viewUserName: document.getElementById("viewUserName"),
  viewUserBody: document.getElementById("viewUserBody"),
  viewEditBtn: document.getElementById("viewEditBtn"),
  viewDeleteBtn: document.getElementById("viewDeleteBtn"),

  debugStatus: document.getElementById("debugStatus")
};

/* =========================
UTILS
========================= */

function safeText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getRole() {
  return String(STATE.userDoc?.role || "").toLowerCase();
}

function canSeeAll() {
  const role = getRole();
  const roles = STATE.userDoc?.roles || {};

  return (
    ["admin_master", "superadmin", "governanca", "gestor"].includes(role) ||
    roles.governanca === true
  );
}

function canManageUsers() {
  const role = getRole();
  const permissions = STATE.userDoc?.permissions || {};
  const roles = STATE.userDoc?.roles || {};

  return (
    canSeeAll() ||
    role === "admin" ||
    permissions.gerenciarUsuarios === true ||
    roles.gerenciarUsuarios === true
  );
}

function getMyTerritoryId() {
  return STATE.userDoc?.territoryId || "";
}

function getMyTerritoryLabel() {
  return STATE.userDoc?.territoryLabel || getTerritoryLabelById(getMyTerritoryId());
}

function getTerritoryLabelById(id) {
  const territory = normalize(id).replaceAll("_", "-");

  if (territory === "vila-pinto") return "Centro de Triagem Vila Pinto";
  if (territory === "cooadesc" || territory === "coadesc") return "COOADESC";
  if (territory === "padre-cacique") return "Padre Cacique";

  return id || "Cooperativa";
}

function getSelectedTerritoryId() {
  if (canSeeAll()) {
    return els.territory?.value || getMyTerritoryId();
  }

  return getMyTerritoryId();
}

function getSelectedTerritoryLabel() {
  return getTerritoryLabelById(getSelectedTerritoryId());
}

function setDebug(message, title = "Status do sistema.") {
  if (!els.debugStatus) return;
  els.debugStatus.classList.remove("hidden");
  els.debugStatus.innerHTML = `<strong>${escapeHTML(title)}</strong><span>${escapeHTML(message)}</span>`;
}

/* =========================
PERMISSÕES
========================= */

function getPermissionsPayload() {
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

function getRolesPayload(role) {
  return {
    user: true,
    cooperativa: role === "cooperativa" || role === "admin",
    operador: role === "operador",
    admin: role === "admin",
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

function setPermissionsForm(permissions = {}) {
  if (els.permDashboard) els.permDashboard.checked = permissions.dashboard !== false;
  if (els.permColetas) els.permColetas.checked = permissions.coletas !== false;
  if (els.permParticipants) els.permParticipants.checked = permissions.participants !== false;
  if (els.permConteudos) els.permConteudos.checked = permissions.conteudos !== false;
  if (els.permDocumentos) els.permDocumentos.checked = permissions.documentos !== false;
  if (els.permMapa) els.permMapa.checked = permissions.mapa !== false;
  if (els.permAprovarCadastros) els.permAprovarCadastros.checked = permissions.aprovarCadastros === true;
  if (els.permGerenciarUsuarios) els.permGerenciarUsuarios.checked = permissions.gerenciarUsuarios === true;
}

/* =========================
FIREBASE AUTH REST
========================= */

async function createFirebaseAuthUser(email, password, displayName) {
  const apiKey = auth.app.options.apiKey;

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        password,
        displayName,
        returnSecureToken: true
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "Erro ao criar usuário no Firebase Authentication.";

    if (message === "EMAIL_EXISTS") throw new Error("Este e-mail já existe no Firebase Authentication.");
    if (message.includes("WEAK_PASSWORD")) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    if (message === "INVALID_EMAIL") throw new Error("E-mail inválido.");
    if (message === "OPERATION_NOT_ALLOWED") throw new Error("Login por e-mail/senha não está ativado no Firebase Authentication.");

    throw new Error(message);
  }

  return {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken
  };
}

/* =========================
CARREGAR USUÁRIOS
========================= */

function getUsersRef() {
  if (canSeeAll()) return collection(db, "users");

  return query(
    collection(db, "users"),
    where("territoryId", "==", getMyTerritoryId())
  );
}

function mapUserDoc(docSnap) {
  const data = docSnap.data() || {};

  return {
    id: docSnap.id,
    uid: data.uid || docSnap.id,
    name: data.name || data.displayName || "Usuário",
    displayName: data.displayName || data.name || "Usuário",
    email: data.email || "",
    role: String(data.role || "usuario").toLowerCase(),
    status: String(data.status || "active").toLowerCase(),
    territoryId: data.territoryId || "",
    territoryLabel: data.territoryLabel || getTerritoryLabelById(data.territoryId),
    permissions: data.permissions || {},
    roles: data.roles || {},
    raw: data
  };
}

function startUsersListener() {
  if (STATE.unsubUsers) {
    STATE.unsubUsers();
    STATE.unsubUsers = null;
  }

  STATE.unsubUsers = onSnapshot(
    getUsersRef(),
    (snapshot) => {
      STATE.users = snapshot.docs
        .map(mapUserDoc)
        .filter((user) => {
          if (canSeeAll()) return true;
          return normalize(user.territoryId) === normalize(getMyTerritoryId());
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));

      applyFilter();
    },
    (error) => {
      console.error("Erro ao carregar usuários:", error);
      if (els.list) {
        els.list.innerHTML = `<div class="empty-state">Não foi possível carregar os usuários.</div>`;
      }
    }
  );
}

/* =========================
FILTRO E RENDER
========================= */

function applyFilter() {
  const term = normalize(els.search?.value);
  const status = String(els.statusFilter?.value || "all");

  STATE.filtered = STATE.users.filter((user) => {
    const userStatus = String(user.status || "active");

    const matchesTerm =
      !term ||
      normalize(user.name).includes(term) ||
      normalize(user.displayName).includes(term) ||
      normalize(user.email).includes(term) ||
      normalize(user.role).includes(term) ||
      normalize(user.territoryLabel).includes(term);

    const matchesStatus =
      status === "all" ||
      userStatus === status;

    return matchesTerm && matchesStatus;
  });

  if (els.csvCountLabel) els.csvCountLabel.textContent = `${STATE.filtered.length} registros`;
  if (els.pdfCountLabel) els.pdfCountLabel.textContent = `${STATE.filtered.length} registros`;

  renderUsers();
}

function roleLabel(role) {
  if (role === "admin") return "Administrador";
  if (role === "cooperativa") return "Cooperativa";
  if (role === "operador") return "Operador";
  if (role === "usuario") return "Usuário";
  return role || "Usuário";
}

function renderUsers() {
  if (!els.list) return;

  if (els.count) {
    els.count.textContent = `${STATE.filtered.length} itens`;
  }

  if (!STATE.filtered.length) {
    els.list.innerHTML = `<div class="empty-state">Nenhum usuário encontrado.</div>`;
    return;
  }

  els.list.innerHTML = STATE.filtered.map((user) => {
    const name = user.displayName || user.name || "Usuário";
    const statusActive = user.status === "active" || user.status === "aprovado";

    return `
      <article class="coop-user-card">
        <div class="coop-user-avatar">${escapeHTML(name.charAt(0).toUpperCase())}</div>

        <div class="coop-user-info">
          <strong>${escapeHTML(name)}</strong>
          <span>${escapeHTML(user.email || "Sem e-mail")}</span>

          <div class="coop-user-meta">
            <small>${escapeHTML(roleLabel(user.role))}</small>
            <small>${escapeHTML(user.territoryLabel || user.territoryId || "Sem território")}</small>
            <small class="${statusActive ? "status-active" : "status-inactive"}">
              ${statusActive ? "Ativo" : "Inativo"}
            </small>
          </div>
        </div>

        <div class="coop-user-actions">
          <button type="button" data-action="view" data-id="${escapeHTML(user.id)}" title="Visualizar">👁</button>
          <button type="button" data-action="edit" data-id="${escapeHTML(user.id)}" title="Editar">✏️</button>
          <button type="button" data-action="delete" data-id="${escapeHTML(user.id)}" title="Excluir">🗑</button>
        </div>
      </article>
    `;
  }).join("");
}

/* =========================
CRIAR / EDITAR
========================= */

async function createUser() {
  const name = safeText(els.name?.value, "").trim();
  const displayName = safeText(els.displayName?.value, "").trim() || name;
  const email = safeText(els.email?.value, "").trim().toLowerCase();
  const password = safeText(els.password?.value, "").trim();
  const role = els.role?.value || "usuario";

  if (!name || !email || !password) {
    alert("Preencha nome, e-mail e senha.");
    return;
  }

  const territoryId = getSelectedTerritoryId();
  const territoryLabel = getTerritoryLabelById(territoryId);

  if (!territoryId) {
    alert("Não foi possível identificar o território da cooperativa.");
    return;
  }

  try {
    if (els.btnSubmit) els.btnSubmit.disabled = true;

    const authUser = await createFirebaseAuthUser(email, password, displayName);

    await setDoc(doc(db, "users", authUser.uid), {
      uid: authUser.uid,
      name,
      displayName,
      email,
      role,
      status: "active",
      active: true,

      territoryId,
      territoryLabel,

      cooperative: {
        id: territoryId,
        label: territoryLabel
      },

      onboardingCompleted: true,
      permissions: getPermissionsPayload(),
      roles: getRolesPayload(role),

      publicCode: `RB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: STATE.authUser?.uid || null,
      createdByName: STATE.userDoc?.name || STATE.userDoc?.displayName || "Administrador"
    });

    alert("Usuário criado com sucesso!");
    resetForm();
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    alert(error?.message || "Não foi possível criar o usuário.");
  } finally {
    if (els.btnSubmit) els.btnSubmit.disabled = false;
  }
}

async function updateUser() {
  const id = STATE.editingId;
  if (!id) return;

  const name = safeText(els.name?.value, "").trim();
  const displayName = safeText(els.displayName?.value, "").trim() || name;
  const email = safeText(els.email?.value, "").trim().toLowerCase();
  const role = els.role?.value || "usuario";

  if (!name || !email) {
    alert("Preencha nome e e-mail.");
    return;
  }

  const territoryId = getSelectedTerritoryId();
  const territoryLabel = getTerritoryLabelById(territoryId);

  try {
    if (els.btnSubmit) els.btnSubmit.disabled = true;

    await updateDoc(doc(db, "users", id), {
      name,
      displayName,
      email,
      role,

      territoryId,
      territoryLabel,

      cooperative: {
        id: territoryId,
        label: territoryLabel
      },

      permissions: getPermissionsPayload(),
      roles: getRolesPayload(role),

      updatedAt: serverTimestamp(),
      updatedBy: STATE.authUser?.uid || null,
      updatedByName: STATE.userDoc?.name || STATE.userDoc?.displayName || "Administrador"
    });

    alert("Usuário atualizado com sucesso!");
    resetForm();
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    alert("Não foi possível atualizar o usuário.");
  } finally {
    if (els.btnSubmit) els.btnSubmit.disabled = false;
  }
}

function startEditUser(id) {
  const user = STATE.users.find((item) => item.id === id);
  if (!user) return;

  STATE.editingId = id;

  if (els.editingUserId) els.editingUserId.value = id;
  if (els.formTitle) els.formTitle.textContent = "Editar usuário da cooperativa";
  if (els.btnSubmit) els.btnSubmit.textContent = "Salvar alterações";
  if (els.btnCancelEdit) els.btnCancelEdit.style.display = "";
  if (els.passwordField) els.passwordField.style.display = "none";
  if (els.password) {
    els.password.required = false;
    els.password.value = "";
  }

  if (els.name) els.name.value = user.name || "";
  if (els.displayName) els.displayName.value = user.displayName || "";
  if (els.email) els.email.value = user.email || "";
  if (els.role) els.role.value = user.role || "usuario";
  if (els.territory) els.territory.value = user.territoryId || getMyTerritoryId();

  setPermissionsForm(user.permissions || {});

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  STATE.editingId = null;

  els.form?.reset();

  if (els.editingUserId) els.editingUserId.value = "";
  if (els.formTitle) els.formTitle.textContent = "Criar usuário da cooperativa";
  if (els.btnSubmit) els.btnSubmit.textContent = "Criar usuário da cooperativa";
  if (els.btnCancelEdit) els.btnCancelEdit.style.display = "none";
  if (els.passwordField) els.passwordField.style.display = "";
  if (els.password) {
    els.password.required = true;
    els.password.value = "";
  }

  setPermissionsForm();

  if (!canSeeAll() && els.territory) {
    els.territory.value = getMyTerritoryId();
    els.territory.disabled = true;
  }
}

/* =========================
VISUALIZAR / EXCLUIR
========================= */

function openViewModal(id) {
  const user = STATE.users.find((item) => item.id === id);
  if (!user || !els.viewModal) return;

  STATE.viewingId = id;

  if (els.viewUserName) {
    els.viewUserName.textContent = user.displayName || user.name || "Usuário";
  }

  if (els.viewUserBody) {
    els.viewUserBody.innerHTML = `
      <div class="user-view-grid">
        <div class="user-view-row">
          <small>Nome completo</small>
          <strong>${escapeHTML(user.name)}</strong>
        </div>

        <div class="user-view-row">
          <small>E-mail</small>
          <strong>${escapeHTML(user.email)}</strong>
        </div>

        <div class="user-view-row">
          <small>Perfil</small>
          <strong>${escapeHTML(roleLabel(user.role))}</strong>
        </div>

        <div class="user-view-row">
          <small>Status</small>
          <strong>${escapeHTML(user.status || "active")}</strong>
        </div>

        <div class="user-view-row">
          <small>Cooperativa / território</small>
          <strong>${escapeHTML(user.territoryLabel || user.territoryId)}</strong>
        </div>
      </div>
    `;
  }

  els.viewModal.classList.remove("hidden");
  els.viewModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeViewModal() {
  if (!els.viewModal) return;

  STATE.viewingId = null;
  els.viewModal.classList.add("hidden");
  els.viewModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function deleteUser(id) {
  const user = STATE.users.find((item) => item.id === id);

  if (!user) {
    alert("Usuário não encontrado.");
    return;
  }

  const ok = confirm(`Deseja excluir o usuário ${user.displayName || user.name || user.email}?`);

  if (!ok) return;

  try {
    await deleteDoc(doc(db, "users", id));
    closeViewModal();
    alert("Usuário removido da lista com sucesso.");
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    alert(
      "Não foi possível excluir este usuário.\n\n" +
      "Verifique se sua regra do Firestore permite delete em /users."
    );
  }
}

/* =========================
EXPORTAR CSV / PDF
========================= */

function getExportUsers() {
  return STATE.filtered.length ? STATE.filtered : STATE.users;
}

function escapeCSV(value) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

function downloadCSV() {
  const users = getExportUsers();

  if (!users.length) {
    alert("Nenhum usuário para baixar.");
    return;
  }

  const header = ["Nome", "Email", "Perfil", "Status", "Território"];

  const rows = users.map((user) => [
    user.displayName || user.name || "",
    user.email || "",
    roleLabel(user.role),
    user.status || "active",
    user.territoryLabel || user.territoryId || ""
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCSV).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = "usuarios-cooperativa.csv";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadPDF() {
  const users = getExportUsers();

  if (!users.length) {
    alert("Nenhum usuário para baixar.");
    return;
  }

  const rows = users.map((user) => `
    <tr>
      <td>${escapeHTML(user.displayName || user.name || "")}</td>
      <td>${escapeHTML(user.email || "")}</td>
      <td>${escapeHTML(roleLabel(user.role))}</td>
      <td>${escapeHTML(user.status || "active")}</td>
      <td>${escapeHTML(user.territoryLabel || user.territoryId || "")}</td>
    </tr>
  `).join("");

  const win = window.open("", "_blank", "width=1000,height=700");

  if (!win) {
    alert("O navegador bloqueou a geração do PDF. Permita pop-ups para esta página.");
    return;
  }

  win.document.write(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Usuários da cooperativa</title>
      <style>
        * { box-sizing: border-box; }

        body {
          margin: 0;
          padding: 32px;
          font-family: Arial, sans-serif;
          color: #1f2a18;
          background: #ffffff;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 28px;
          border-bottom: 3px solid #81b92a;
          padding-bottom: 18px;
        }

        .header h1 {
          margin: 0;
          font-size: 28px;
        }

        .header p {
          margin: 6px 0 0;
          color: #5d6b4f;
          font-size: 14px;
        }

        .badge {
          padding: 10px 14px;
          border-radius: 999px;
          background: #eef7df;
          color: #3f6f12;
          font-weight: bold;
          white-space: nowrap;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th {
          background: #81b92a;
          color: #1f2a18;
          text-align: left;
          padding: 10px;
          border: 1px solid #6fa020;
        }

        td {
          padding: 9px 10px;
          border: 1px solid #d8e8c0;
          vertical-align: top;
        }

        tr:nth-child(even) td {
          background: #f8fbf3;
        }

        .footer {
          margin-top: 24px;
          font-size: 12px;
          color: #6b755d;
        }

        .no-print {
          margin-bottom: 20px;
          padding: 10px 16px;
          border: 0;
          border-radius: 10px;
          background: #81b92a;
          color: #1f2a18;
          font-weight: bold;
          cursor: pointer;
        }

        @media print {
          body { padding: 18px; }
          .no-print { display: none; }
        }
      </style>
    </head>

    <body>
      <button class="no-print" onclick="window.print()">Imprimir / salvar em PDF</button>

      <div class="header">
        <div>
          <h1>Usuários da cooperativa</h1>
          <p>Lista gerada pela plataforma NSRU</p>
          <p>${new Date().toLocaleString("pt-BR")}</p>
        </div>

        <div class="badge">${users.length} usuários</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Status</th>
            <th>Território</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="footer">
        Documento gerado automaticamente pela NSRU.
      </div>
    </body>
    </html>
  `);

  win.document.close();
  win.focus();
}

/* =========================
UI GERAL
========================= */

function fillUserUI() {
  const name = STATE.userDoc?.displayName || STATE.userDoc?.name || STATE.authUser?.email || "Usuário";
  const territory = getMyTerritoryLabel();
  const role = getRole() || "usuario";

  if (els.sidebarUserName) els.sidebarUserName.textContent = name;
  if (els.sidebarTerritoryLabel) els.sidebarTerritoryLabel.textContent = territory;

  if (els.territoryPill) {
    els.territoryPill.textContent = canSeeAll() ? "🟢 Todos os territórios" : `🟢 ${territory}`;
  }

  if (els.coopPill) {
    els.coopPill.textContent = canSeeAll() ? "🏢 Todas as cooperativas" : `🏢 ${territory}`;
  }

  if (els.permissionPill) {
    els.permissionPill.textContent = canManageUsers() ? "🔐 Gestão liberada" : "🔐 Sem gestão";
  }

  if (els.rolePill) {
    els.rolePill.textContent = `👤 ${role}`;
  }

  if (!canSeeAll() && els.territory) {
    els.territory.value = getMyTerritoryId();
    els.territory.disabled = true;
  }
}

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

  els.btnLogout?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });

  els.search?.addEventListener("input", applyFilter);
  els.statusFilter?.addEventListener("change", applyFilter);
  els.btnDownload?.addEventListener("click", downloadCSV);
  els.btnDownloadPDF?.addEventListener("click", downloadPDF);

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!canManageUsers()) {
      alert("Você não tem permissão para gerenciar usuários.");
      return;
    }

    if (STATE.editingId) {
      await updateUser();
    } else {
      await createUser();
    }
  });

  els.btnCancelEdit?.addEventListener("click", resetForm);

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "view") openViewModal(id);
    if (action === "edit") startEditUser(id);
    if (action === "delete") await deleteUser(id);
  });

  els.closeViewModal?.addEventListener("click", closeViewModal);
  els.viewBackdrop?.addEventListener("click", closeViewModal);

  els.viewEditBtn?.addEventListener("click", () => {
    if (!STATE.viewingId) return;
    const id = STATE.viewingId;
    closeViewModal();
    startEditUser(id);
  });

  els.viewDeleteBtn?.addEventListener("click", async () => {
    if (!STATE.viewingId) return;
    await deleteUser(STATE.viewingId);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSidebarMenu();
      closeViewModal();
    }
  });
}

/* =========================
AUTH
========================= */

bindEvents();

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    STATE.authUser = user;

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
      throw new Error("Usuário autenticado sem documento em /users.");
    }

    STATE.userDoc = {
      id: snap.id,
      ...snap.data()
    };

    fillUserUI();
    resetForm();
    startUsersListener();

    setDebug(
      `Cooperativa: ${getMyTerritoryLabel()} • Perfil: ${getRole()}`,
      "Usuários carregados."
    );
  } catch (error) {
    console.error("Erro ao iniciar página:", error);
    setDebug(error?.message || "Erro desconhecido.", "Erro ao carregar.");
    alert("Não foi possível carregar a gestão de usuários da cooperativa.");
  }
});