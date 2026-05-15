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
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const bodyConfig = document.body.dataset || {};

function canonicalTerritoryId(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  if (!raw) return "vila-pinto";
  if (raw === "crgr-vila-pinto") return "vila-pinto";
  if (raw === "crgr-coadesc" || raw === "crgr-cooadesc") return "cooadesc";
  if (raw === "coadesc") return "cooadesc";
  if (raw === "crgr-padre-cacique") return "padre-cacique";

  return raw;
}

const PAGE_TERRITORY = {
  territoryId: canonicalTerritoryId(bodyConfig.territoryId || "vila-pinto"),
  territoryLabel: bodyConfig.territoryLabel || "Centro de Triagem Vila Pinto",
  cooperativeName: bodyConfig.cooperativeName || "Vila Pinto",
  coletasUrl: bodyConfig.coletasUrl || "cadastro-coletas-vila-pinto.html"
};

const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

const els = {
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  logoutLink: document.getElementById("logoutLink"),

  userNameTop: document.getElementById("userNameTop"),
  accessBanner: document.getElementById("accessBanner"),
  sidebarHelpText: document.getElementById("sidebarHelpText"),

  syncCoopDashboardBtn: document.getElementById("syncCoopDashboardBtn"),
  syncCoopDashboardStatus: document.getElementById("syncCoopDashboardStatus"),

  indicatorParticipants: document.getElementById("indicatorParticipants"),
  indicatorColetas: document.getElementById("indicatorColetas"),
  indicatorDocs: document.getElementById("indicatorDocs"),
  indicatorActions: document.getElementById("indicatorActions"),

  participantsTotalCount: document.getElementById("participantsTotalCount"),
  participantsPeopleCount: document.getElementById("participantsPeopleCount"),
  participantsCondoCount: document.getElementById("participantsCondoCount"),

  noticesList: document.getElementById("noticesList"),
  territoryCommunications: document.getElementById("territoryCommunications"),

  chartColetasMensais: document.getElementById("chartColetasMensais"),
  chartParticipantesPerfil: document.getElementById("chartParticipantesPerfil")
};

const STATE = {
  currentUser: null,
  profile: null,
  isAdmin: false,
  canEditAll: false,
  participants: [],
  coletas: [],
  documents: [],
  approvalRequests: [],
  users: [],
  unsubscribers: []
};

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isAdminUser(role) {
  return role === "admin";
}

function isGovernancaUser(role) {
  return role === "governanca" || role === "gestor";
}

function isApprovedParticipant(item) {
  return item.approvalStatus === "approved" || item.status === "active" || item.active === true;
}

function isColetaRealizada(item) {
  const status = normalizeText(
    item.status ||
      item.situacao ||
      item.decision ||
      item.approvalStatus ||
      item.coletaStatus ||
      "realizada"
  );

  return ![
    "cancelada",
    "cancelado",
    "rejected",
    "rejeitada",
    "rejeitado",
    "pendente",
    "pending",
    "rascunho",
    "draft"
  ].includes(status);
}

function participantType(item) {
  return normalizeText(item.participantType || item.tipoParticipante || item.tipo);
}

function setText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? 0);
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

function getPossibleTerritoryValues(profile) {
  const canonical = canonicalTerritoryId(profile?.territoryId || PAGE_TERRITORY.territoryId);

  if (canonical === "vila-pinto") {
    return ["vila-pinto", "crgr_vila_pinto", "crgr-vila-pinto"];
  }

  if (canonical === "cooadesc") {
    return ["cooadesc", "coadesc", "crgr_cooadesc", "crgr_coadesc", "crgr-cooadesc", "crgr-coadesc"];
  }

  if (canonical === "padre-cacique") {
    return ["padre-cacique", "crgr_padre_cacique", "crgr-padre-cacique"];
  }

  return [canonical];
}

function itemBelongsToTerritory(item, profile) {
  if (isGovernancaUser(profile.role)) return true;

  const possible = getPossibleTerritoryValues(profile).map(canonicalTerritoryId);

  const fields = [
    item.territoryId,
    item.territory,
    item.territorio,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeCode,
    item.cooperativaCode,
    item.code,
    item.crgrId,
    item.localCrgr,
    item.cooperativa,
    item.cooperativeName
  ]
    .filter(Boolean)
    .map(canonicalTerritoryId);

  return fields.some((field) => possible.includes(field));
}

function clearUnsubscribers() {
  STATE.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (_) {}
  });

  STATE.unsubscribers = [];
}

function animateNumber(el, value) {
  if (!el) return;

  if (typeof value !== "number") {
    setText(el, value);
    return;
  }

  const target = Number(value || 0);
  const current = Number(String(el.textContent || "0").replace(/\D/g, "")) || 0;

  const duration = 500;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const next = Math.round(current + (target - current) * progress);

    el.textContent = next.toLocaleString("pt-BR");

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    throw new Error("Usuário não encontrado.");
  }

  const data = {
    id: snap.id,
    ...snap.data()
  };

  if (data.territoryId) {
    data.territoryId = canonicalTerritoryId(data.territoryId);
  }

  return data;
}

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil de usuário inválido.");
  if (profile.status !== "active") throw new Error("Usuário sem acesso ativo.");

  const acceptedRoles = ["admin", "cooperativa", "user", "usuario", "governanca", "gestor"];

  if (!acceptedRoles.includes(profile.role)) {
    throw new Error("Acesso permitido apenas para perfis autorizados.");
  }

  if (!isGovernancaUser(profile.role) && !profile.territoryId) {
    throw new Error("Usuário sem território vinculado.");
  }
}

function setupSidebar() {
  function openSidebar() {
    els.sidebar?.classList.add("open");
    els.mobileOverlay?.classList.add("show");
    document.body.classList.add("menu-open");
  }

  function closeSidebar() {
    els.sidebar?.classList.remove("open");
    els.mobileOverlay?.classList.remove("show");
    document.body.classList.remove("menu-open");
  }

  els.menuBtn?.addEventListener("click", openSidebar);
  els.mobileOverlay?.addEventListener("click", closeSidebar);

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1180) closeSidebar();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) closeSidebar();
  });
}

function setupLogout() {
  els.logoutLink?.addEventListener("click", async (event) => {
    event.preventDefault();

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      window.location.href = "index.html";
    }
  });
}

function setupTopbarShadow() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  window.addEventListener("scroll", () => {
    topbar.style.boxShadow =
      window.scrollY > 8
        ? "0 10px 28px rgba(15,23,42,.08)"
        : "0 6px 20px rgba(15,23,42,.04)";
  });
}

function fillHeader(profile) {
  const isGovernanca = isGovernancaUser(profile.role);
  const isAdmin = isAdminUser(profile.role);

  const name =
    profile.displayName ||
    profile.name ||
    profile.nome ||
    (isAdmin ? "Administrador VP" : "Usuário");

  if (els.userNameTop) els.userNameTop.textContent = name;

  if (els.accessBanner) {
    if (isGovernanca) {
      els.accessBanner.className = "access-banner show admin";
      els.accessBanner.innerHTML =
        `<strong>Acesso de governança ativo.</strong> Visualização geral dos indicadores do sistema.`;
    } else if (isAdmin) {
      els.accessBanner.className = "access-banner show cooperativa";
      els.accessBanner.innerHTML =
        `<strong>Acesso administrativo ativo.</strong> Indicadores da cooperativa ${PAGE_TERRITORY.cooperativeName}.`;
    } else {
      els.accessBanner.className = "access-banner show cooperativa";
      els.accessBanner.innerHTML =
        `<strong>Acesso da cooperativa ativo.</strong> Indicadores vinculados ao seu território.`;
    }
  }

  if (els.sidebarHelpText) {
    els.sidebarHelpText.textContent =
      "Dashboard da cooperativa com dados operacionais, participantes, documentos e coletas.";
  }

  document.querySelectorAll(`a[href="cadastro-coletas-vila-pinto.html"]`).forEach((a) => {
    a.href = PAGE_TERRITORY.coletasUrl;
  });
}

function renderInfoList(container, items) {
  if (!container) return;

  container.innerHTML = items
    .map((item) => {
      return `
        <article class="info-item">
          <div class="info-copy">
            <strong>${item.title}</strong>
            <span>${item.description}</span>
          </div>
          ${item.meta ? `<span class="info-meta">${item.meta}</span>` : ""}
        </article>
      `;
    })
    .join("");
}

function fillStaticPanels() {
  renderInfoList(els.noticesList, [
    {
      title: "Indicadores atualizados",
      description: "Os dados do painel são sincronizados com os registros da cooperativa.",
      meta: "Sistema"
    },
    {
      title: "Acompanhamento operacional",
      description: "Use o dashboard para acompanhar participantes, coletas, documentos e ações pendentes.",
      meta: "Painel"
    }
  ]);

  renderInfoList(els.territoryCommunications, [
    {
      title: "Resumo da cooperativa",
      description: "Painel inicial otimizado para leitura rápida dos principais números.",
      meta: "Dashboard"
    },
    {
      title: "Dados integrados",
      description: "Participantes, coletas, documentos e solicitações são carregados diretamente do Firebase.",
      meta: "Firebase"
    }
  ]);
}

function listenCollection(collectionName, profile, callback, options = {}) {
  const {
    useOrder = false,
    orderField = "createdAtISO",
    clientFilter = true
  } = options;

  const possibleValues = getPossibleTerritoryValues(profile).slice(0, 10);

  try {
    const constraints = [];

    if (!isGovernancaUser(profile.role)) {
      constraints.push(where("territoryId", "in", possibleValues));
    }

    if (useOrder) {
      constraints.push(orderBy(orderField, "desc"));
    }

    const q = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let docs = snapshot.docs.map((docItem) => {
          const data = {
            id: docItem.id,
            ...docItem.data()
          };

          if (data.territoryId) data.territoryId = canonicalTerritoryId(data.territoryId);

          return data;
        });

        if (clientFilter) {
          docs = docs.filter((item) => itemBelongsToTerritory(item, profile));
        }

        callback(docs);
      },
      (error) => {
        console.warn(`[${collectionName}] Falha na consulta filtrada. Tentando fallback geral.`, error);

        const fallbackQuery = query(collection(db, collectionName));

        const fallbackUnsubscribe = onSnapshot(
          fallbackQuery,
          (snapshot) => {
            let docs = snapshot.docs.map((docItem) => {
              const data = {
                id: docItem.id,
                ...docItem.data()
              };

              if (data.territoryId) data.territoryId = canonicalTerritoryId(data.territoryId);

              return data;
            });

            if (clientFilter) {
              docs = docs.filter((item) => itemBelongsToTerritory(item, profile));
            }

            callback(docs);
          },
          (fallbackError) => {
            console.error(`[${collectionName}] Erro no fallback:`, fallbackError);
            callback([]);
          }
        );

        STATE.unsubscribers.push(fallbackUnsubscribe);
      }
    );

    STATE.unsubscribers.push(unsubscribe);
  } catch (error) {
    console.error(`[${collectionName}] Erro ao iniciar listener:`, error);
    callback([]);
  }
}

function computeDashboardData() {
  const approvedParticipants = STATE.participants.filter(isApprovedParticipant);
  const coletasRealizadas = STATE.coletas.filter(isColetaRealizada);

  const peopleCount = approvedParticipants.filter((item) =>
    ["morador", "familia", "lideranca", "participante", "user", "usuario"].includes(participantType(item))
  ).length;

  const condoCount = approvedParticipants.filter((item) =>
    participantType(item) === "condominio"
  ).length;

  const coletasCount = coletasRealizadas.length;
  const documentsCount = STATE.documents.length;
  const actionsCount = STATE.approvalRequests.filter((item) => item.status === "pending").length;

  return {
    participants: approvedParticipants.length,
    people: peopleCount,
    condos: condoCount,
    coletas: coletasCount,
    docs: documentsCount,
    actions: STATE.isAdmin || STATE.canEditAll ? actionsCount : 0
  };
}

function updateKpis() {
  const data = computeDashboardData();

  animateNumber(els.indicatorParticipants, data.participants);
  animateNumber(els.indicatorColetas, data.coletas);
  animateNumber(els.indicatorDocs, data.docs);
  animateNumber(els.indicatorActions, data.actions);

  animateNumber(els.participantsTotalCount, data.participants);
  animateNumber(els.participantsPeopleCount, data.people);
  animateNumber(els.participantsCondoCount, data.condos);

  updateCharts(data);
}

function updateCharts(data) {
  const bars = els.chartColetasMensais?.querySelectorAll(".fake-bars span");

  if (bars?.length) {
    const values = [
      data.coletas * 0.42,
      data.coletas * 0.58,
      data.coletas * 0.34,
      data.coletas * 0.72,
      data.coletas * 0.62,
      data.coletas * 0.86
    ];

    const max = Math.max(...values, 1);

    bars.forEach((bar, index) => {
      const height = Math.max(18, Math.round((values[index] / max) * 92));
      bar.style.height = `${height}%`;
    });
  }

  const donut = els.chartParticipantesPerfil?.querySelector(".fake-donut");

  if (donut) {
    const total = Math.max(data.participants, 1);
    const peoplePercent = Math.round((data.people / total) * 100);
    const condoPercent = Math.round((data.condos / total) * 100);
    const otherPercent = Math.max(0, 100 - peoplePercent - condoPercent);

    donut.style.background = `
      conic-gradient(
        #81B92A 0 ${peoplePercent}%,
        #53ACDE ${peoplePercent}% ${peoplePercent + condoPercent}%,
        #EF6B22 ${peoplePercent + condoPercent}% ${peoplePercent + condoPercent + otherPercent}%
      )
    `;
  }
}

async function loadCollectionSafe(name) {
  try {
    const snap = await getDocs(query(collection(db, name), orderBy("createdAt", "desc")));

    return snap.docs.map((docItem) => {
      const data = {
        id: docItem.id,
        ...docItem.data()
      };

      if (data.territoryId) data.territoryId = canonicalTerritoryId(data.territoryId);

      return data;
    });
  } catch {
    try {
      const snap = await getDocs(collection(db, name));

      return snap.docs.map((docItem) => {
        const data = {
          id: docItem.id,
          ...docItem.data()
        };

        if (data.territoryId) data.territoryId = canonicalTerritoryId(data.territoryId);

        return data;
      });
    } catch (error) {
      console.warn(`Não foi possível ler a coleção ${name}:`, error);
      return [];
    }
  }
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

  return Object.keys(obj).reduce((acc, key) => {
    return acc + sumNumericFromItem(obj[key]);
  }, 0);
}

function getResiduosTotalFromColeta(coleta = {}) {
  let total = 0;

  if (typeof coleta.totalKg === "number") total += coleta.totalKg;
  if (coleta.recebimento && typeof coleta.recebimento === "object") total += sumObjectNumericValues(coleta.recebimento);
  if (coleta.residuos && typeof coleta.residuos === "object") total += sumObjectNumericValues(coleta.residuos);
  if (coleta.materiais && typeof coleta.materiais === "object") total += sumObjectNumericValues(coleta.materiais);

  return Math.round(total);
}

function buildCooperativaPublicSummary({
  users,
  participants,
  coletas,
  documents,
  approvalRequests,
  territoryId,
  territoryLabel
}) {
  const normalizedId = canonicalTerritoryId(territoryId);

  const usersFiltered = users.filter((item) => itemBelongsToTerritory(item, { role: "admin", territoryId: normalizedId }));
  const participantsFiltered = participants.filter((item) => itemBelongsToTerritory(item, { role: "admin", territoryId: normalizedId }));
  const coletasFiltered = coletas
    .filter((item) => itemBelongsToTerritory(item, { role: "admin", territoryId: normalizedId }))
    .filter(isColetaRealizada);
  const documentsFiltered = documents.filter((item) => itemBelongsToTerritory(item, { role: "admin", territoryId: normalizedId }));
  const approvalFiltered = approvalRequests.filter((item) => itemBelongsToTerritory(item, { role: "admin", territoryId: normalizedId }));

  const residuosCount = coletasFiltered.reduce((acc, item) => {
    return acc + getResiduosTotalFromColeta(item);
  }, 0);

  return {
    territoryId: normalizedId,
    territoryLabel,
    usersCount: usersFiltered.length + participantsFiltered.length,
    participantsCount: participantsFiltered.length,
    coletasCount: coletasFiltered.length,
    documentosCount: documentsFiltered.length,
    residuosCount,
    approvalsCount: approvalFiltered.length,
    crgrsCount: 1,
    alertsCount: 0
  };
}

async function saveCooperativaPublicDashboard(payload) {
  await setDoc(
    doc(db, "dashboard_public_by_cooperativa", payload.territoryId),
    {
      ...payload,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function runCooperativaDashboardSync({ territoryId, territoryLabel, silent = false }) {
  try {
    const normalizedId = canonicalTerritoryId(territoryId);

    setCoopSyncButtonLoading(true);
    setCoopSyncStatus(
      silent
        ? "Verificando atualização automática..."
        : "Atualizando indicadores da cooperativa..."
    );

    const [users, participants, coletas, documents, approvalRequests] = await Promise.all([
      loadCollectionSafe("users"),
      loadCollectionSafe("participants"),
      loadCollectionSafe("coletas"),
      loadCollectionSafe("documentos"),
      loadCollectionSafe("approvalRequests")
    ]);

    const summary = buildCooperativaPublicSummary({
      users,
      participants,
      coletas,
      documents,
      approvalRequests,
      territoryId: normalizedId,
      territoryLabel
    });

    await saveCooperativaPublicDashboard(summary);

    const nowLabel = new Date().toLocaleString("pt-BR");
    setCoopSyncStatus(`Atualizado em ${nowLabel}`);

    return true;
  } catch (error) {
    console.error("[Cooperativa] Erro ao sincronizar dashboard público:", error);
    setCoopSyncStatus("Erro ao atualizar indicadores da cooperativa.");
    return false;
  } finally {
    setCoopSyncButtonLoading(false);
  }
}

async function autoSyncCooperativaDashboardIfNeeded({ territoryId, territoryLabel }) {
  try {
    const normalizedId = canonicalTerritoryId(territoryId);

    setCoopSyncStatus("Verificando última atualização...");

    const snap = await getDoc(doc(db, "dashboard_public_by_cooperativa", normalizedId));

    if (!snap.exists()) {
      await runCooperativaDashboardSync({
        territoryId: normalizedId,
        territoryLabel,
        silent: true
      });
      return;
    }

    const data = snap.data();

    const updatedAt =
      data?.updatedAt && typeof data.updatedAt.toDate === "function"
        ? data.updatedAt.toDate().getTime()
        : 0;

    const now = Date.now();
    const diff = now - updatedAt;

    if (!updatedAt || diff >= AUTO_SYNC_INTERVAL_MS) {
      await runCooperativaDashboardSync({
        territoryId: normalizedId,
        territoryLabel: data?.territoryLabel || territoryLabel,
        silent: true
      });
      return;
    }

    setCoopSyncStatus(`Última atualização em ${new Date(updatedAt).toLocaleString("pt-BR")}`);
  } catch (error) {
    console.error("[Cooperativa] Falha na verificação automática:", error);
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

function applyPermissionRules(profile) {
  STATE.isAdmin = isAdminUser(profile.role);
  STATE.canEditAll = isGovernancaUser(profile.role);
}

function applyRoleVisibility(profile) {
  const canManageUsers = isAdminUser(profile.role) || isGovernancaUser(profile.role);

  const userLinks = [
    document.querySelector('a[href="usuario-cooperativa-vila-pinto.html"]'),
    document.querySelector('a[href="usuarios.html"]')
  ].filter(Boolean);

  userLinks.forEach((link) => {
    link.style.display = canManageUsers ? "" : "none";
  });

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !canManageUsers);
  });
}

function listenDashboardData(profile) {
  clearUnsubscribers();

  listenCollection(
    "participants",
    profile,
    (items) => {
      STATE.participants = items.filter((item) => item.approvalStatus !== "rejected");
      updateKpis();
    },
    {
      useOrder: true,
      orderField: "createdAtISO"
    }
  );

  listenCollection(
    "coletas",
    profile,
    (items) => {
      const realizadas = items.filter(isColetaRealizada);

      console.log("[Dashboard] Coletas encontradas:", items.length);
      console.log("[Dashboard] Coletas realizadas:", realizadas.length);

      STATE.coletas = realizadas;
      updateKpis();
    },
    {
      useOrder: true,
      orderField: "createdAtISO"
    }
  );

  listenCollection(
    "documentos",
    profile,
    (items) => {
      STATE.documents = items;
      updateKpis();
    },
    {
      useOrder: false
    }
  );

  listenCollection(
    "approvalRequests",
    profile,
    (items) => {
      STATE.approvalRequests = items.filter((item) => {
        return item.type === "participant_registration" && item.status === "pending";
      });

      updateKpis();
    },
    {
      useOrder: true,
      orderField: "createdAtISO"
    }
  );

  if (isGovernancaUser(profile.role)) {
    listenCollection(
      "users",
      profile,
      (items) => {
        STATE.users = items;
        updateKpis();
      },
      {
        useOrder: false,
        clientFilter: false
      }
    );
  }
}

function boot() {
  setupSidebar();
  setupLogout();
  setupTopbarShadow();
  fillStaticPanels();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      STATE.currentUser = user;

      const profile = await getUserProfile(user.uid);
      validateProfile(profile);

      STATE.profile = profile;

      applyPermissionRules(profile);
      fillHeader(profile);
      applyRoleVisibility(profile);
      listenDashboardData(profile);

      const territoryId = canonicalTerritoryId(profile.territoryId || PAGE_TERRITORY.territoryId);
      const territoryLabel = profile.territoryLabel || PAGE_TERRITORY.territoryLabel;

      bindCooperativaSyncButton({
        territoryId,
        territoryLabel
      });

      await autoSyncCooperativaDashboardIfNeeded({
        territoryId,
        territoryLabel
      });

      document.body.classList.add("dashboard-loaded");
    } catch (error) {
      console.error("Erro ao carregar painel da cooperativa:", error);
      alert(error.message || "Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();