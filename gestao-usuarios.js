import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const LOGIN_PAGE = "./login.html";
const COOPERATIVAS_PAGE = "./cooperativas.html";

/* =========================
   UI / NAVEGAÇÃO
========================= */

const navButtons = document.querySelectorAll(".gov-nav-btn");
const sections = document.querySelectorAll(".gov-section");

function showSection(sectionName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.section === sectionName);
  });

  sections.forEach((section) => {
    section.classList.toggle("is-visible", section.id === `section-${sectionName}`);
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showSection(btn.dataset.section);
  });
});

/* =========================
   HELPERS
========================= */

function byId(id) {
  return document.getElementById(id);
}

function safeText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function setMetric(id, value) {
  const el = byId(id);
  if (!el) return;
  el.textContent = safeText(value, "0");
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

function formatDateTime(value) {
  try {
    if (!value) return "";

    let dateObj = null;

    if (typeof value?.toDate === "function") {
      dateObj = value.toDate();
    } else if (value instanceof Date) {
      dateObj = value;
    } else if (typeof value === "string" || typeof value === "number") {
      dateObj = new Date(value);
    }

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

    if (typeof value?.toDate === "function") {
      dateObj = value.toDate();
    } else if (value instanceof Date) {
      dateObj = value;
    } else if (typeof value === "string" || typeof value === "number") {
      dateObj = new Date(value);
    }

    if (!dateObj || Number.isNaN(dateObj.getTime())) return "";

    return dateObj.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function formatPermission(userData = {}) {
  const role = normalizeRole(userData);

  if (role === "governanca" || role === "gestor") return "Governança";
  if (role === "admin") return "Admin cooperativa";
  if (role === "brigadista") return "Brigadista";
  return "Usuário local";
}

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sumObjectNumericValues(obj) {
  if (!obj || typeof obj !== "object") return 0;

  let total = 0;

  for (const key of Object.keys(obj)) {
    const item = obj[key];

    if (typeof item === "number") {
      total += item;
      continue;
    }

    if (item && typeof item === "object") {
      if (typeof item.peso === "number") total += item.peso;
      else if (typeof item.kg === "number") total += item.kg;
      else if (typeof item.quantidade === "number") total += item.quantidade;
      else if (typeof item.total === "number") total += item.total;
    }
  }

  return total;
}

function sumResiduoSecoKg(coletas = []) {
  let total = 0;

  for (const coleta of coletas) {
    if (!coleta || typeof coleta !== "object") continue;

    if (typeof coleta.totalKg === "number") {
      total += coleta.totalKg;
    }

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
      const item = coleta.recebimento[key];
      const keyName = String(key).toLowerCase();

      if (!keyName.includes("rejeito")) continue;

      if (typeof item === "number") {
        total += item;
      } else if (item && typeof item === "object") {
        if (typeof item.peso === "number") total += item.peso;
        else if (typeof item.kg === "number") total += item.kg;
        else if (typeof item.quantidade === "number") total += item.quantidade;
        else if (typeof item.total === "number") total += item.total;
      }
    }
  }

  return Math.round(total);
}

function estimateAccessCount(userData = {}) {
  return numberOrZero(
    userData.accessCount ??
    userData.loginCount ??
    userData.qtdAcessos ??
    userData.quantidadeAcessos
  );
}

function getLastLogin(userData = {}) {
  return (
    userData.lastLoginAt ||
    userData.lastAccessAt ||
    userData.ultimoLogin ||
    userData.updatedAt ||
    null
  );
}

function getCreatedAt(userData = {}) {
  return (
    userData.createdAt ||
    userData.createdAtClient ||
    userData.createdAtISO ||
    null
  );
}

function getUserDisplayName(userData = {}) {
  return (
    userData.name ||
    userData.fullName ||
    userData.displayName ||
    userData.email ||
    "Sem nome"
  );
}

/* =========================
   FIREBASE LOADERS
========================= */

async function loadUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}

async function loadTerritories() {
  const snap = await getDocs(collection(db, "territories"));
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data()
  }));
}

async function loadUsers() {
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  } catch {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  }
}

async function loadParticipants() {
  try {
    const q = query(collection(db, "participants"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  } catch {
    const snap = await getDocs(collection(db, "participants"));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  }
}

async function loadColetas() {
  try {
    const q = query(collection(db, "coletas"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  } catch {
    const snap = await getDocs(collection(db, "coletas"));
    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));
  }
}

/* =========================
   RENDER - PAINEL
========================= */

function renderMetrics({ territories, users, participants, coletas }) {
  const crgrAtivos = territories.filter((t) => t.active !== false).length;
  const usuarios = users.length;
  const residencias = participants.length;
  const brigadistas = users.filter((u) => normalizeRole(u) === "brigadista").length;

  const acoesAndamento = coletas.filter((c) => {
    const status = String(c.status || "").toLowerCase();
    return status === "andamento" || status === "em_andamento" || status === "open";
  }).length;

  const acoesCriticas = coletas.filter((c) => {
    const status = String(c.status || "").toLowerCase();
    return status === "critico" || status === "crítica" || status === "critica";
  }).length;

  const residuoSeco = sumResiduoSecoKg(coletas);
  const rejeito = sumRejeitoKg(coletas);

  setMetric("metricCrgrAtivos", crgrAtivos);
  setMetric("metricUsuarios", usuarios);
  setMetric("metricResidencias", residencias);
  setMetric("metricBrigadistas", brigadistas);
  setMetric("metricAcoesAndamento", acoesAndamento);
  setMetric("metricAcoesCriticas", acoesCriticas);
  setMetric("metricResiduoSeco", residuoSeco);
  setMetric("metricRejeito", rejeito);
}

/* =========================
   RENDER - GESTÃO USUÁRIOS
========================= */

function renderUsersTable(users = []) {
  const tbody = byId("usersTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const ordered = [...users].sort((a, b) => {
    const da = getCreatedAt(a);
    const db = getCreatedAt(b);

    const ta = typeof da?.toDate === "function" ? da.toDate().getTime() : new Date(da || 0).getTime();
    const tb = typeof db?.toDate === "function" ? db.toDate().getTime() : new Date(db || 0).getTime();

    return tb - ta;
  });

  if (!ordered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td colspan="5">Nenhum usuário encontrado.</td>
    `;
    tbody.appendChild(tr);
    return;
  }

  ordered.forEach((user) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${safeText(formatHour(getCreatedAt(user)), "-")}</td>
      <td>${safeText(getUserDisplayName(user), "-")}</td>
      <td>${safeText(estimateAccessCount(user), "0")}</td>
      <td>${safeText(formatDateTime(getLastLogin(user)), "-")}</td>
      <td>${safeText(formatPermission(user), "-")}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* =========================
   RENDER - TERRITÓRIOS
   pronto para a próxima tela
========================= */

function buildTerritorySummary(territories = [], users = [], participants = [], coletas = []) {
  const summaryMap = new Map();

  territories.forEach((territory) => {
    const id = territory.code || territory.id || territory.territoryId;
    if (!id) return;

    summaryMap.set(id, {
      id,
      name: territory.name || territory.title || territory.label || territory.territoryLabel || id,
      active: territory.active !== false,
      users: 0,
      participants: 0,
      coletas: 0,
      residuoSecoKg: 0
    });
  });

  users.forEach((user) => {
    const territoryId = user.territoryId;
    if (!territoryId) return;

    if (!summaryMap.has(territoryId)) {
      summaryMap.set(territoryId, {
        id: territoryId,
        name: user.territoryLabel || territoryId,
        active: true,
        users: 0,
        participants: 0,
        coletas: 0,
        residuoSecoKg: 0
      });
    }

    summaryMap.get(territoryId).users += 1;
  });

  participants.forEach((participant) => {
    const territoryId = participant.territoryId;
    if (!territoryId) return;

    if (!summaryMap.has(territoryId)) {
      summaryMap.set(territoryId, {
        id: territoryId,
        name: participant.territoryLabel || territoryId,
        active: true,
        users: 0,
        participants: 0,
        coletas: 0,
        residuoSecoKg: 0
      });
    }

    summaryMap.get(territoryId).participants += 1;
  });

  coletas.forEach((coleta) => {
    const territoryId = coleta.territoryId;
    if (!territoryId) return;

    if (!summaryMap.has(territoryId)) {
      summaryMap.set(territoryId, {
        id: territoryId,
        name: coleta.territoryLabel || territoryId,
        active: true,
        users: 0,
        participants: 0,
        coletas: 0,
        residuoSecoKg: 0
      });
    }

    const item = summaryMap.get(territoryId);
    item.coletas += 1;

    if (coleta.recebimento && typeof coleta.recebimento === "object") {
      item.residuoSecoKg += sumObjectNumericValues(coleta.recebimento);
    }

    if (typeof coleta.totalKg === "number") {
      item.residuoSecoKg += coleta.totalKg;
    }
  });

  return Array.from(summaryMap.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/* =========================
   MAIN LOAD
========================= */

async function loadGovernancaDashboard(userProfile) {
  try {
    const [territories, users, participants, coletas] = await Promise.all([
      loadTerritories(),
      loadUsers(),
      loadParticipants(),
      loadColetas()
    ]);

    renderMetrics({ territories, users, participants, coletas });
    renderUsersTable(users);

    // deixa pronto para uso futuro em Gestão do Território
    window.__govData = {
      me: userProfile,
      territories,
      users,
      participants,
      coletas,
      territorySummary: buildTerritorySummary(territories, users, participants, coletas)
    };

    console.log("Governança carregada com sucesso:", window.__govData);
  } catch (error) {
    console.error("Erro ao carregar dados da governança:", error);
    alert("Não foi possível carregar os dados da governança.");
  }
}

/* =========================
   AUTH GUARD
========================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = LOGIN_PAGE;
    return;
  }

  try {
    const profile = await loadUserProfile(user.uid);

    if (!profile) {
      alert("Usuário sem cadastro no Firestore.");
      await signOut(auth);
      window.location.href = LOGIN_PAGE;
      return;
    }

    if (!isGovernancaUser(profile)) {
      window.location.href = COOPERATIVAS_PAGE;
      return;
    }

    await loadGovernancaDashboard(profile);
  } catch (error) {
    console.error("Erro ao validar acesso da governança:", error);
    alert("Erro ao validar acesso.");
    window.location.href = LOGIN_PAGE;
  }
});