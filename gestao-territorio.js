import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const LOGIN_PAGE = "./login.html";
const COOPERATIVAS_PAGE = "./cooperativas.html";

function byId(id) {
  return document.getElementById(id);
}

function normalizeRole(data = {}) {
  if (data.role) return String(data.role).toLowerCase();
  if (data.roles?.governanca) return "governanca";
  if (data.roles?.admin) return "admin";
  if (data.roles?.brigadista) return "brigadista";
  return "usuario";
}

function isGovernancaUser(userData = {}) {
  const role = normalizeRole(userData);
  return userData.status === "active" && (
    role === "governanca" ||
    role === "gestor" ||
    userData.roles?.governanca === true
  );
}

function setMetric(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value ?? 0);
}

function formatDateTime(value) {
  try {
    if (!value) return "";
    let dateObj = null;
    if (typeof value?.toDate === "function") dateObj = value.toDate();
    else if (value instanceof Date) dateObj = value;
    else dateObj = new Date(value);
    if (!dateObj || Number.isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

function formatHour(value) {
  try {
    if (!value) return "";
    let dateObj = null;
    if (typeof value?.toDate === "function") dateObj = value.toDate();
    else if (value instanceof Date) dateObj = value;
    else dateObj = new Date(value);
    if (!dateObj || Number.isNaN(dateObj.getTime())) return "";
    return dateObj.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getCreatedAt(userData = {}) {
  return userData.createdAt || userData.createdAtClient || userData.createdAtISO || null;
}

function getLastLogin(userData = {}) {
  return userData.lastLoginAt || userData.lastAccessAt || userData.ultimoLogin || userData.updatedAt || null;
}

function getUserDisplayName(userData = {}) {
  return userData.name || userData.fullName || userData.displayName || userData.email || "Sem nome";
}

function estimateAccessCount(userData = {}) {
  return userData.accessCount || userData.loginCount || userData.qtdAcessos || userData.quantidadeAcessos || 0;
}

function formatPermission(userData = {}) {
  const role = normalizeRole(userData);
  if (role === "governanca" || role === "gestor") return "Governança";
  if (role === "admin") return "Admin cooperativa";
  if (role === "brigadista") return "Brigadista";
  return "Usuário local";
}

function territoryName(userData = {}) {
  return userData.territoryLabel || userData.cooperativaNome || userData.territoryId || "Global";
}

function statusLabel(userData = {}) {
  return String(userData.status || "inactive").toLowerCase() === "active" ? "Ativo" : "Inativo";
}

async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadUsers() {
  try {
    const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

function renderUsersTable(users = []) {
  const tbody = byId("usersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!users.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8">Nenhum usuário encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  users.forEach((user) => {
    const tr = document.createElement("tr");
    const isActive = String(user.status || "").toLowerCase() === "active";

    tr.innerHTML = `
      <td>${formatHour(getCreatedAt(user)) || "-"}</td>
      <td>${getUserDisplayName(user)}</td>
      <td>${user.email || "-"}</td>
      <td>${territoryName(user)}</td>
      <td>${estimateAccessCount(user)}</td>
      <td>${formatDateTime(getLastLogin(user)) || "-"}</td>
      <td>${formatPermission(user)}</td>
      <td><span class="status-pill ${isActive ? "" : "inactive"}">${statusLabel(user)}</span></td>
    `;

    tbody.appendChild(tr);
  });
}

function renderKPIs(users = []) {
  const total = users.length;
  const ativos = users.filter((u) => String(u.status || "").toLowerCase() === "active").length;
  const admins = users.filter((u) => normalizeRole(u) === "admin").length;
  const governanca = users.filter((u) => normalizeRole(u) === "governanca" || normalizeRole(u) === "gestor").length;

  setMetric("usersTotal", total);
  setMetric("usersAtivos", ativos);
  setMetric("usersAdmins", admins);
  setMetric("usersGovernanca", governanca);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  try {
    const profile = await loadUserProfile(user.uid);

    if (!profile) {
      await signOut(auth);
      window.location.href = LOGIN_PAGE;
      return;
    }

    if (!isGovernancaUser(profile)) {
      window.location.href = COOPERATIVAS_PAGE;
      return;
    }

    const users = await loadUsers();
    renderKPIs(users);
    renderUsersTable(users);
  } catch (error) {
    console.error(error);
    window.location.href = LOGIN_PAGE;
  }
});