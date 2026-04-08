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

const navButtons = document.querySelectorAll(".gov-nav-btn");
const sections = document.querySelectorAll(".gov-section");
const pageSubtitle = document.getElementById("pageSubtitle");

const logoutBtn = document.getElementById("logoutBtn");
const loggedUserName = document.getElementById("loggedUserName");
const loggedUserMeta = document.getElementById("loggedUserMeta");

const SECTION_TITLES = {
  painel: "Plataforma • Cooperativas",
  usuarios: "Gestão do Usuário",
  territorios: "Gestão do Território",
  conteudos: "Gestão de conteúdos"
};

function showSection(sectionName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.section === sectionName);
  });

  sections.forEach((section) => {
    section.classList.toggle("is-visible", section.id === `section-${sectionName}`);
  });

  if (pageSubtitle) {
    pageSubtitle.textContent =
      SECTION_TITLES[sectionName] || "Plataforma • Cooperativas";
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => showSection(btn.dataset.section));
});

function byId(id) {
  return document.getElementById(id);
}

function setMetric(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value ?? 0);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function lower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeRole(data = {}) {
  if (data.role) return lower(data.role);
  if (data.roles?.governanca) return "governanca";
  if (data.roles?.admin) return "admin";
  if (data.roles?.brigadista) return "brigadista";
  return "usuario";
}

function isGovernancaUser(userData = {}) {
  const role = normalizeRole(userData);

  return lower(userData.status) === "active" && (
    role === "governanca" ||
    role === "gestor" ||
    userData.roles?.governanca === true
  );
}

function formatDateTime(value) {
  try {
    if (!value) return "";

    let dateObj = null;

    if (typeof value?.toDate === "function") dateObj = value.toDate();
    else if (value instanceof Date) dateObj = value;
    else dateObj = new Date(value);

    if (!dateObj || Number.isNaN(dateObj.getTime())) return "";

    return dateObj.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    });
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

    return dateObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function getUserDisplayName(data = {}) {
  return data.name || data.fullName || data.displayName || data.email || "Sem nome";
}

function estimateAccessCount(data = {}) {
  return data.accessCount || data.loginCount || data.qtdAcessos || data.quantidadeAcessos || 0;
}

function sumNumericFromItem(item) {
  if (typeof item === "number") return item;
  if (!item || typeof item !== "object") return 0;
  if (typeof item.peso === "number") return item.peso;
  if (typeof item.kg === "number") return item.kg;
  if (typeof item.quantidade === "number") return item.quantidade;
  if (typeof item.total === "number") return item.total;
  return 0;
}

function sumObjectNumericValues(obj) {
  if (!obj || typeof obj !== "object") return 0;
  let total = 0;

  for (const key of Object.keys(obj)) {
    total += sumNumericFromItem(obj[key]);
  }

  return total;
}

function sumResiduoSecoKg(coletas = []) {
  let total = 0;

  for (const coleta of coletas) {
    if (typeof coleta.totalKg === "number") total += coleta.totalKg;
    if (coleta.recebimento && typeof coleta.recebimento === "object") {
      total += sumObjectNumericValues(coleta.recebimento);
    }
  }

  return Math.round(total);
}

function sumRejeitoKg(coletas = []) {
  let total = 0;

  for (const coleta of coletas) {
    if (!coleta?.recebimento || typeof coleta.recebimento !== "object") continue;

    for (const key of Object.keys(coleta.recebimento)) {
      if (!lower(key).includes("rejeito")) continue;
      total += sumNumericFromItem(coleta.recebimento[key]);
    }
  }

  return Math.round(total);
}

function sumResiduoSecoFromColeta(coleta) {
  if (!coleta) return 0;
  let total = 0;

  if (typeof coleta.totalKg === "number") total += coleta.totalKg;
  if (coleta.recebimento && typeof coleta.recebimento === "object") {
    total += sumObjectNumericValues(coleta.recebimento);
  }

  return total;
}

function sumRejeitoFromColeta(coleta) {
  if (!coleta?.recebimento || typeof coleta.recebimento !== "object") return 0;
  let total = 0;

  for (const key of Object.keys(coleta.recebimento)) {
    if (!lower(key).includes("rejeito")) continue;
    total += sumNumericFromItem(coleta.recebimento[key]);
  }

  return total;
}

function getLoggedUserRoleLabel(profile = {}) {
  const role = normalizeRole(profile);
  if (role === "governanca" || role === "gestor") return "Governança";
  if (role === "admin") return "Admin cooperativa";
  if (role === "brigadista") return "Brigadista";
  return "Usuário";
}

function renderLoggedUser(profile = {}, authUser = {}) {
  if (loggedUserName) {
    loggedUserName.textContent =
      profile.name ||
      profile.fullName ||
      profile.displayName ||
      authUser.displayName ||
      profile.email ||
      authUser.email ||
      "Usuário";
  }

  if (loggedUserMeta) {
    const roleLabel = getLoggedUserRoleLabel(profile);
    const email = profile.email || authUser.email || "";
    loggedUserMeta.textContent = email
      ? `${roleLabel} • ${email}`
      : `Perfil: ${roleLabel}`;
  }
}

function bindLogout() {
  if (!logoutBtn) return;

  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      window.location.href = LOGIN_PAGE;
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      alert("Não foi possível sair. Tente novamente.");
    }
  };
}

async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function loadCollectionSafe(name) {
  try {
    const snap = await getDocs(query(collection(db, name), orderBy("createdAt", "desc")));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(collection(db, name));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.warn(`Nao foi possivel ler a colecao ${name}:`, error);
      return [];
    }
  }
}

async function loadCRGRCollections() {
  const [territories, cooperativas, crgrs] = await Promise.all([
    loadCollectionSafe("territories"),
    loadCollectionSafe("cooperativas"),
    loadCollectionSafe("crgrs")
  ]);

  const merged = [...territories, ...cooperativas, ...crgrs];
  return merged.length ? merged : [];
}

function normalizeCRGRDocs(rawCRGRs = []) {
  return rawCRGRs
    .map((item) => ({
      id: item.id || item.code || item.territoryId,
      code: item.code || item.id || item.territoryId,
      territoryId: item.territoryId || item.code || item.id,
      name:
        item.name ||
        item.title ||
        item.label ||
        item.territoryLabel ||
        item.cooperativaNome ||
        item.code ||
        item.id,
      territoryLabel:
        item.territoryLabel ||
        item.name ||
        item.title ||
        item.label ||
        item.cooperativaNome ||
        item.code ||
        item.id,
      active: item.active !== false
    }))
    .filter((item) => item.id);
}

function buildCRGRsFromData(users = [], participants = [], coletas = []) {
  const map = new Map();

  function ensureCRGR(territoryId, territoryLabel, source = "") {
    const id = normalizeText(territoryId);
    if (!id) return;

    if (!map.has(id)) {
      map.set(id, {
        id,
        code: id,
        territoryId: id,
        name: normalizeText(territoryLabel) || id,
        territoryLabel: normalizeText(territoryLabel) || id,
        active: true,
        source
      });
    } else {
      const current = map.get(id);
      if (!current.name || current.name === current.id) {
        current.name = normalizeText(territoryLabel) || current.name;
        current.territoryLabel = normalizeText(territoryLabel) || current.territoryLabel;
      }
    }
  }

  users.forEach((item) => {
    ensureCRGR(item.territoryId, item.territoryLabel || item.cooperativaNome, "users");
  });

  participants.forEach((item) => {
    ensureCRGR(item.territoryId, item.territoryLabel, "participants");
  });

  coletas.forEach((item) => {
    ensureCRGR(item.territoryId, item.territoryLabel, "coletas");
  });

  return Array.from(map.values()).sort((a, b) =>
    String(a.name || a.id).localeCompare(String(b.name || b.id), "pt-BR")
  );
}

async function loadAllData() {
  const [users, participants, coletas, approvalRequests, rawCRGRs] = await Promise.all([
    loadCollectionSafe("users"),
    loadCollectionSafe("participants"),
    loadCollectionSafe("coletas"),
    loadCollectionSafe("approvalRequests"),
    loadCRGRCollections()
  ]);

  let crgrs = normalizeCRGRDocs(rawCRGRs);
  if (!crgrs.length) {
    crgrs = buildCRGRsFromData(users, participants, coletas);
  }

  return { users, participants, coletas, approvalRequests, crgrs };
}

function renderPainel({ crgrs, users, participants, coletas, approvalRequests }) {
  const totalCadastros = users.length + participants.length;
  const crgrAtivos = crgrs.filter((t) => t.active !== false).length;
  const residencias = participants.length;
  const brigadistas = users.filter((u) => normalizeRole(u) === "brigadista").length;

  const acoesAndamento = coletas.filter((c) => {
    const status = lower(c.status);
    return status === "andamento" || status === "em_andamento" || status === "open";
  }).length;

  const acoesCriticas = coletas.filter((c) => {
    const status = lower(c.status);
    return status === "critico" || status === "critica" || status === "crítica";
  }).length;

  const usuariosAtivos = users.filter((u) => lower(u.status) === "active").length;
  const territoriosInativos = crgrs.filter((t) => t.active === false).length;

  setMetric("metricCrgrAtivos", crgrAtivos);
  setMetric("metricUsuarios", totalCadastros);
  setMetric("metricResidencias", residencias);
  setMetric("metricBrigadistas", brigadistas);
  setMetric("metricAcoesAndamento", acoesAndamento);
  setMetric("metricAcoesCriticas", acoesCriticas);
  setMetric("metricResiduoSeco", sumResiduoSecoKg(coletas));
  setMetric("metricRejeito", sumRejeitoKg(coletas));

  setMetric("metricApprovalRequests", approvalRequests.length);
  setMetric("metricColetas", coletas.length);
  setMetric("metricTerritoriosInativos", territoriosInativos);
  setMetric("metricUsuariosAtivos", usuariosAtivos);

  const updated = byId("updatedAtLabel");
  if (updated) {
    updated.textContent = `Atualizado em ${new Date().toLocaleString("pt-BR")}`;
  }
}

function buildUnifiedUsers(users = [], participants = []) {
  const unified = [];

  users.forEach((user) => {
    unified.push({
      id: user.id,
      sourceCollection: "users",
      name: user.name || user.fullName || user.displayName || user.email || "Sem nome",
      email: user.email || "-",
      territoryId: user.territoryId || "",
      territoryLabel: user.territoryLabel || user.cooperativaNome || "",
      createdAt: user.createdAt || user.createdAtClient || user.createdAtISO || null,
      lastAccessAt: user.lastLoginAt || user.lastAccessAt || user.updatedAt || null,
      accessCount: user.accessCount || user.loginCount || user.qtdAcessos || user.quantidadeAcessos || 0,
      role: user.role || "",
      roles: user.roles || {},
      status: user.status || "inactive"
    });
  });

  participants.forEach((participant) => {
    unified.push({
      id: `participant-${participant.id || participant.participantCode || Math.random().toString(36).slice(2)}`,
      sourceCollection: "participants",
      name: participant.name || participant.fullName || "Participante",
      email: participant.email || "-",
      territoryId: participant.territoryId || "",
      territoryLabel: participant.territoryLabel || "",
      createdAt: participant.createdAt || participant.createdAtISO || null,
      lastAccessAt: participant.updatedAt || null,
      accessCount: 0,
      role: participant.participantType || "participante",
      roles: {},
      status: participant.status || participant.approvalStatus || "pending"
    });
  });

  unified.sort((a, b) => {
    const da = a.createdAt;
    const db = b.createdAt;

    const ta =
      typeof da?.toDate === "function"
        ? da.toDate().getTime()
        : new Date(da || 0).getTime();

    const tb =
      typeof db?.toDate === "function"
        ? db.toDate().getTime()
        : new Date(db || 0).getTime();

    return tb - ta;
  });

  return unified;
}

function formatUnifiedPermission(item = {}) {
  if (item.sourceCollection === "participants") return "Participante";

  const role = normalizeRole(item);
  if (role === "governanca" || role === "gestor") return "Governança";
  if (role === "admin") return "Admin cooperativa";
  if (role === "brigadista") return "Brigadista";
  return "Usuário local";
}

function formatUnifiedStatus(item = {}) {
  const status = lower(item.status);

  if (status === "active") return { label: "Ativo", inactive: false };
  if (status === "approved") return { label: "Aprovado", inactive: false };
  if (status === "pending" || status === "pending_approval") {
    return { label: "Pendente", inactive: true };
  }

  return { label: item.status || "Inativo", inactive: true };
}

function handleEditUser(item) {
  console.log("Editar usuario:", item);
  alert(`Editar: ${item.name || item.email || item.id}`);
}

function handleDeleteUser(item) {
  const confirmed = window.confirm(
    `Deseja excluir este registro?\n\n${item.name || item.email || item.id}`
  );

  if (!confirmed) return;

  console.log("Excluir usuario:", item);
  alert(`Exclusão preparada para: ${item.name || item.email || item.id}`);
}

function handleEditTerritory(item) {
  console.log("Editar territorio:", item);
  alert(`Editar território: ${item.nome}`);
}

function handleDeleteTerritory(item) {
  const confirmed = window.confirm(
    `Deseja excluir este território?\n\n${item.nome}`
  );

  if (!confirmed) return;

  console.log("Excluir território:", item);
  alert(`Exclusão preparada para: ${item.nome}`);
}

function createActionButtons({ onEdit, onDelete }) {
  const wrapper = document.createElement("div");
  wrapper.className = "gov-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "gov-btn-table gov-btn-edit";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", onEdit);

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "gov-btn-table gov-btn-delete";
  deleteBtn.textContent = "Excluir";
  deleteBtn.addEventListener("click", onDelete);

  wrapper.appendChild(editBtn);
  wrapper.appendChild(deleteBtn);

  return wrapper;
}

function renderUsuarios(users = [], participants = []) {
  const unifiedUsers = buildUnifiedUsers(users, participants);

  setMetric("usersTotal", unifiedUsers.length);
  setMetric("usersAtivos", users.filter((u) => lower(u.status) === "active").length);
  setMetric("usersAdmins", users.filter((u) => normalizeRole(u) === "admin").length);
  setMetric(
    "usersGovernanca",
    users.filter((u) => {
      const role = normalizeRole(u);
      return role === "governanca" || role === "gestor";
    }).length
  );

  const tbody = byId("usersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!unifiedUsers.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="10">Nenhum registro encontrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  unifiedUsers.forEach((item) => {
    const tr = document.createElement("tr");
    const statusInfo = formatUnifiedStatus(item);

    tr.innerHTML = `
      <td>${formatHour(item.createdAt) || "-"}</td>
      <td>${item.name || "-"}</td>
      <td>${item.email || "-"}</td>
      <td>${item.territoryLabel || item.territoryId || "Sem território"}</td>
      <td>${item.accessCount ?? 0}</td>
      <td>${formatDateTime(item.lastAccessAt) || "-"}</td>
      <td>${formatUnifiedPermission(item)}</td>
      <td>${item.sourceCollection}</td>
      <td><span class="status-pill ${statusInfo.inactive ? "inactive" : ""}">${statusInfo.label}</span></td>
      <td></td>
    `;

    const actionsCell = tr.lastElementChild;
    actionsCell.appendChild(
      createActionButtons({
        onEdit: () => handleEditUser(item),
        onDelete: () => handleDeleteUser(item)
      })
    );

    tbody.appendChild(tr);
  });
}

function buildTerritorySummary(crgrs = [], users = [], participants = [], coletas = []) {
  const map = new Map();

  crgrs.forEach((territory) => {
    const code = territory.code || territory.id || territory.territoryId;
    if (!code) return;

    map.set(code, {
      nome: territory.name || territory.title || territory.label || territory.territoryLabel || code,
      codigo: code,
      active: territory.active !== false,
      usuarios: 0,
      participantes: 0,
      coletas: 0,
      residuoSeco: 0,
      rejeito: 0
    });
  });

  users.forEach((user) => {
    const code = user.territoryId;
    if (!code) return;

    if (!map.has(code)) {
      map.set(code, {
        nome: user.territoryLabel || code,
        codigo: code,
        active: true,
        usuarios: 0,
        participantes: 0,
        coletas: 0,
        residuoSeco: 0,
        rejeito: 0
      });
    }

    map.get(code).usuarios += 1;
  });

  participants.forEach((participant) => {
    const code = participant.territoryId;
    if (!code) return;

    if (!map.has(code)) {
      map.set(code, {
        nome: participant.territoryLabel || code,
        codigo: code,
        active: true,
        usuarios: 0,
        participantes: 0,
        coletas: 0,
        residuoSeco: 0,
        rejeito: 0
      });
    }

    map.get(code).participantes += 1;
  });

  coletas.forEach((coleta) => {
    const code = coleta.territoryId;
    if (!code) return;

    if (!map.has(code)) {
      map.set(code, {
        nome: coleta.territoryLabel || code,
        codigo: code,
        active: true,
        usuarios: 0,
        participantes: 0,
        coletas: 0,
        residuoSeco: 0,
        rejeito: 0
      });
    }

    const item = map.get(code);
    item.coletas += 1;
    item.residuoSeco += sumResiduoSecoFromColeta(coleta);
    item.rejeito += sumRejeitoFromColeta(coleta);
  });

  return Array.from(map.values()).sort((a, b) =>
    String(a.nome).localeCompare(String(b.nome), "pt-BR")
  );
}

function renderTerritorios(summary = []) {
  setMetric("territoriosTotal", summary.length);
  setMetric("territoriosAtivos", summary.filter((t) => t.active).length);
  setMetric(
    "territoriosParticipantes",
    summary.reduce((acc, item) => acc + item.participantes, 0)
  );
  setMetric(
    "territoriosColetas",
    summary.reduce((acc, item) => acc + item.coletas, 0)
  );

  const tbody = byId("territoriosTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!summary.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9">Nenhuma CRGR encontrada.</td>`;
    tbody.appendChild(tr);
    return;
  }

  summary.forEach((item) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${item.nome}</td>
      <td>${item.codigo}</td>
      <td><span class="status-pill ${item.active ? "" : "inactive"}">${item.active ? "Ativo" : "Inativo"}</span></td>
      <td>${item.usuarios}</td>
      <td>${item.participantes}</td>
      <td>${item.coletas}</td>
      <td>${Math.round(item.residuoSeco)}</td>
      <td>${Math.round(item.rejeito)}</td>
      <td></td>
    `;

    const actionsCell = tr.lastElementChild;
    actionsCell.appendChild(
      createActionButtons({
        onEdit: () => handleEditTerritory(item),
        onDelete: () => handleDeleteTerritory(item)
      })
    );

    tbody.appendChild(tr);
  });
}

function renderConteudos({ users, crgrs, participants, coletas, approvalRequests }) {
  const usuariosAtivos = users.filter((u) => lower(u.status) === "active").length;
  const approvalPending = approvalRequests.filter((r) => lower(r.status) === "pending").length;

  setMetric("contentUsuarios", users.length);
  setMetric("contentTerritorios", crgrs.length);
  setMetric("contentParticipantes", participants.length);
  setMetric("contentColetas", coletas.length);

  setMetric("contentApprovalPending", approvalPending);
  setMetric("contentUsuariosAtivos", usuariosAtivos);
  setMetric("contentResiduoSeco", sumResiduoSecoKg(coletas));
  setMetric("contentRejeito", sumRejeitoKg(coletas));
}

async function loadGovernanca() {
  const { users, participants, coletas, approvalRequests, crgrs } = await loadAllData();

  renderPainel({ crgrs, users, participants, coletas, approvalRequests });
  renderUsuarios(users, participants);

  const territorySummary = buildTerritorySummary(crgrs, users, participants, coletas);
  renderTerritorios(territorySummary);

  renderConteudos({ users, crgrs, participants, coletas, approvalRequests });

  console.log("users:", users.length);
  console.log("participants:", participants.length);
  console.log("coletas:", coletas.length);
  console.log("approvalRequests:", approvalRequests.length);
  console.log("crgrs:", crgrs.length);
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

    renderLoggedUser(profile, user);
    bindLogout();

    await loadGovernanca();
  } catch (error) {
    console.error(error);
    window.location.href = LOGIN_PAGE;
  }
});