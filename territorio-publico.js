import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  updateDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const bodyConfig = document.body.dataset || {};

const PAGE_TERRITORY = {
  territoryId: bodyConfig.territoryId || "vila-pinto",
  territoryLabel: bodyConfig.territoryLabel || "Território",
  cooperativeName: bodyConfig.cooperativeName || "Cooperativa"
};

const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

const els = {
  syncCoopDashboardBtn: document.getElementById("syncCoopDashboardBtn"),
  syncCoopDashboardStatus: document.getElementById("syncCoopDashboardStatus")
};

const STATE = {
  currentUser: null,
  profile: null
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function setCoopSyncStatus(text) {
  if (els.syncCoopDashboardStatus) {
    els.syncCoopDashboardStatus.textContent = text;
  }
}

function setCoopSyncButtonLoading(isLoading) {
  if (!els.syncCoopDashboardBtn) return;
  els.syncCoopDashboardBtn.classList.toggle("is-loading", isLoading);
  els.syncCoopDashboardBtn.disabled = isLoading;
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado.");
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
      console.warn(`Não foi possível ler a coleção ${name}:`, error);
      return [];
    }
  }
}

function getResiduosTotalFromColeta(coleta = {}) {
  let total = 0;

  if (typeof coleta.totalKg === "number") total += coleta.totalKg;
  if (typeof coleta.pesoKg === "number") total += coleta.pesoKg;
  if (typeof coleta.kg === "number") total += coleta.kg;

  if (coleta.recebimento && typeof coleta.recebimento === "object") {
    Object.values(coleta.recebimento).forEach((value) => {
      if (typeof value === "number") total += value;
      if (value && typeof value === "object") {
        Object.values(value).forEach((sub) => {
          if (typeof sub === "number") total += sub;
        });
      }
    });
  }

  if (coleta.finalTurno && typeof coleta.finalTurno === "object") {
    Object.values(coleta.finalTurno).forEach((value) => {
      if (typeof value === "number") total += value;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item && typeof item.pesoKg === "number") total += item.pesoKg;
          if (item && typeof item.kg === "number") total += item.kg;
          if (item && typeof item.quantidade === "number") total += item.quantidade;
        });
      }
    });
  }

  return Number(total.toFixed(1));
}

function buildCooperativaPublicSummary({ users, participants, coletas, approvalRequests, territoryId, territoryLabel }) {
  const usersFiltered = users.filter((item) => normalizeText(item.territoryId) === normalizeText(territoryId));
  const participantsFiltered = participants.filter((item) => normalizeText(item.territoryId) === normalizeText(territoryId));
  const coletasFiltered = coletas.filter((item) => normalizeText(item.territoryId) === normalizeText(territoryId));
  const approvalFiltered = approvalRequests.filter((item) => normalizeText(item.territoryId) === normalizeText(territoryId));

  const cooperativaMembersCount = usersFiltered.filter((item) =>
    ["cooperativa", "operador", "usuario", "user", "integrante", "catador"].includes(normalizeText(item.role))
  ).length;

  const residuosCount = coletasFiltered.reduce((acc, item) => acc + getResiduosTotalFromColeta(item), 0);

  return {
    territoryId,
    territoryLabel,
    usersCount: usersFiltered.length,
    participantsCount: participantsFiltered.length,
    cooperativaMembersCount,
    coletasCount: coletasFiltered.length,
    residuosCount: Number(residuosCount.toFixed(1)),
    approvalsCount: approvalFiltered.length,
    crgrsCount: 1,
    pontosCount: 1,
    alertsCount: 0,
    updatedAt: serverTimestamp()
  };
}

async function saveCooperativaPublicDashboard(payload) {
  await setDoc(
    doc(db, "dashboard_public_by_cooperativa", payload.territoryId),
    payload,
    { merge: true }
  );
}

async function runCooperativaDashboardSync({ territoryId, territoryLabel, silent = false }) {
  try {
    setCoopSyncButtonLoading(true);
    setCoopSyncStatus(silent ? "Verificando atualização automática..." : "Atualizando indicadores da cooperativa...");

    const [users, participants, coletas, approvalRequests] = await Promise.all([
      loadCollectionSafe("users"),
      loadCollectionSafe("participants"),
      loadCollectionSafe("coletas"),
      loadCollectionSafe("approvalRequests")
    ]);

    const summary = buildCooperativaPublicSummary({
      users,
      participants,
      coletas,
      approvalRequests,
      territoryId,
      territoryLabel
    });

    await saveCooperativaPublicDashboard(summary);

    console.log("[SYNC COOP] Documento salvo:", summary);
    setCoopSyncStatus(`Atualizado em ${new Date().toLocaleString("pt-BR")}`);
    return true;
  } catch (error) {
    console.error("[SYNC COOP] Erro:", error);
    setCoopSyncStatus("Erro ao atualizar indicadores da cooperativa.");
    return false;
  } finally {
    setCoopSyncButtonLoading(false);
  }
}

async function autoSyncCooperativaDashboardIfNeeded({ territoryId, territoryLabel }) {
  try {
    const snap = await getDoc(doc(db, "dashboard_public_by_cooperativa", territoryId));

    if (!snap.exists()) {
      await runCooperativaDashboardSync({ territoryId, territoryLabel, silent: true });
      return;
    }

    const data = snap.data();
    const updatedAt = data?.updatedAt && typeof data.updatedAt.toDate === "function"
      ? data.updatedAt.toDate().getTime()
      : 0;

    const diff = Date.now() - updatedAt;

    if (!updatedAt || diff >= AUTO_SYNC_INTERVAL_MS) {
      await runCooperativaDashboardSync({ territoryId, territoryLabel, silent: true });
      return;
    }

    setCoopSyncStatus(`Última atualização em ${new Date(updatedAt).toLocaleString("pt-BR")}`);
  } catch (error) {
    console.error("[AUTO SYNC COOP] Erro:", error);
    setCoopSyncStatus("Não foi possível verificar a atualização automática.");
  }
}

function bindCooperativaSyncButton({ territoryId, territoryLabel }) {
  if (!els.syncCoopDashboardBtn) return;

  els.syncCoopDashboardBtn.addEventListener("click", async () => {
    await runCooperativaDashboardSync({
      territoryId,
      territoryLabel,
      silent: false
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) return;

    STATE.currentUser = user;
    STATE.profile = await getUserProfile(user.uid);

    const territoryId = STATE.profile.territoryId || PAGE_TERRITORY.territoryId;
    const territoryLabel = STATE.profile.territoryLabel || PAGE_TERRITORY.territoryLabel;

    bindCooperativaSyncButton({ territoryId, territoryLabel });
    await autoSyncCooperativaDashboardIfNeeded({ territoryId, territoryLabel });
  } catch (error) {
    console.error("Erro ao iniciar sync da cooperativa:", error);
    setCoopSyncStatus("Falha ao iniciar atualização da cooperativa.");
  }
});