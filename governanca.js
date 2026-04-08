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

function setMetric(id, value) {
  const el = byId(id);
  if (el) el.textContent = String(value ?? 0);
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

function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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
    if (coleta.recebimento) total += sumObjectNumericValues(coleta.recebimento);
  }
  return Math.round(total);
}

function sumRejeitoKg(coletas = []) {
  let total = 0;
  for (const coleta of coletas) {
    if (!coleta?.recebimento || typeof coleta.recebimento !== "object") continue;
    for (const key of Object.keys(coleta.recebimento)) {
      if (!String(key).toLowerCase().includes("rejeito")) continue;
      total += sumNumericFromItem(coleta.recebimento[key]);
    }
  }
  return Math.round(total);
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
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
}

function renderMetrics({ territories, users, participants, coletas, approvalRequests }) {
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
    return status === "critico" || status === "critica" || status === "crítica";
  }).length;

  const usuariosAtivos = users.filter((u) => String(u.status || "").toLowerCase() === "active").length;
  const territoriosInativos = territories.filter((t) => t.active === false).length;

  setMetric("metricCrgrAtivos", crgrAtivos);
  setMetric("metricUsuarios", usuarios);
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

async function loadDashboard() {
  const [territories, users, participants, coletas, approvalRequests] = await Promise.all([
    loadCollectionSafe("territories"),
    loadCollectionSafe("users"),
    loadCollectionSafe("participants"),
    loadCollectionSafe("coletas"),
    loadCollectionSafe("approvalRequests")
  ]);

  renderMetrics({ territories, users, participants, coletas, approvalRequests });
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

    await loadDashboard();
  } catch (error) {
    console.error(error);
    window.location.href = LOGIN_PAGE;
  }
});