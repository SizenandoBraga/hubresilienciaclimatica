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

function sumNumericFromItem(item) {
  if (typeof item === "number") return item;
  if (!item || typeof item !== "object") return 0;
  if (typeof item.peso === "number") return item.peso;
  if (typeof item.kg === "number") return item.kg;
  if (typeof item.quantidade === "number") return item.quantidade;
  if (typeof item.total === "number") return item.total;
  return 0;
}

function sumResiduoSecoKg(coletas = []) {
  let total = 0;
  for (const coleta of coletas) {
    if (typeof coleta.totalKg === "number") total += coleta.totalKg;
    if (coleta.recebimento && typeof coleta.recebimento === "object") {
      for (const key of Object.keys(coleta.recebimento)) {
        total += sumNumericFromItem(coleta.recebimento[key]);
      }
    }
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

function renderContentOverview({ users, territories, participants, coletas, approvalRequests }) {
  const usuariosAtivos = users.filter((u) => String(u.status || "").toLowerCase() === "active").length;
  const approvalPending = approvalRequests.filter((r) => String(r.status || "").toLowerCase() === "pending").length;

  setMetric("contentUsuarios", users.length);
  setMetric("contentTerritorios", territories.length);
  setMetric("contentParticipantes", participants.length);
  setMetric("contentColetas", coletas.length);

  setMetric("contentApprovalPending", approvalPending);
  setMetric("contentUsuariosAtivos", usuariosAtivos);
  setMetric("contentResiduoSeco", sumResiduoSecoKg(coletas));
  setMetric("contentRejeito", sumRejeitoKg(coletas));
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

    const [users, territories, participants, coletas, approvalRequests] = await Promise.all([
      loadCollectionSafe("users"),
      loadCollectionSafe("territories"),
      loadCollectionSafe("participants"),
      loadCollectionSafe("coletas"),
      loadCollectionSafe("approvalRequests")
    ]);

    renderContentOverview({ users, territories, participants, coletas, approvalRequests });
  } catch (error) {
    console.error(error);
    window.location.href = LOGIN_PAGE;
  }
});