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
  territoryId: bodyConfig.territoryId || "crgr_vila_pinto",
  territoryLabel: bodyConfig.territoryLabel || "Território",
  cooperativeName: bodyConfig.cooperativeName || "Cooperativa",
  participantUrl: bodyConfig.participantUrl || "cadastro-participantes-vila-pinto.html",
  coletasUrl: bodyConfig.coletasUrl || "cadastro-coletas-vila-pinto.html",
  mapLat: Number(bodyConfig.mapLat || -30.0346),
  mapLng: Number(bodyConfig.mapLng || -51.2177),
  mapZoom: Number(bodyConfig.mapZoom || 15)
};

const AUTO_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

const els = {
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  sidebarClose: document.getElementById("sidebarClose"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  logoutLink: document.getElementById("logoutLink"),

  territoryNameTop: document.getElementById("territoryNameTop"),
  cooperativeNameTop: document.getElementById("cooperativeNameTop"),
  roleNameTop: document.getElementById("roleNameTop"),
  userNameTop: document.getElementById("userNameTop"),
  rolePill: document.getElementById("rolePill"),
  accessBanner: document.getElementById("accessBanner"),
  sidebarHelpText: document.getElementById("sidebarHelpText"),

  noticesList: document.getElementById("noticesList"),
  featuredTrails: document.getElementById("featuredTrails"),

  territoryPanelTitle: document.getElementById("territoryPanelTitle"),
  territoryPanelSubtitle: document.getElementById("territoryPanelSubtitle"),

  territoryCommunications: document.getElementById("territoryCommunications"),
  territoryServices: document.getElementById("territoryServices"),
  territoryCalendar: document.getElementById("territoryCalendar"),
  territoryTrainings: document.getElementById("territoryTrainings"),

  summaryAccepted: document.getElementById("summaryAccepted"),
  summaryRejected: document.getElementById("summaryRejected"),
  summaryPoints: document.getElementById("summaryPoints"),

  indicatorColetas: document.getElementById("indicatorColetas"),
  indicatorParticipants: document.getElementById("indicatorParticipants"),
  indicatorDocs: document.getElementById("indicatorDocs"),
  indicatorActions: document.getElementById("indicatorActions"),

  participantsList: document.getElementById("participantsList"),
  participantSearchInput: document.getElementById("participantSearchInput"),
  participantsTotalCount: document.getElementById("participantsTotalCount"),
  participantsPeopleCount: document.getElementById("participantsPeopleCount"),
  participantsCondoCount: document.getElementById("participantsCondoCount"),
  participantsSectionText: document.getElementById("participantsSectionText"),
  newParticipantBtn: document.getElementById("newParticipantBtn"),

  approvalRequestsList: document.getElementById("approvalRequestsList"),

  mapPointsCount: document.getElementById("mapPointsCount"),
  mapPointsList: document.getElementById("mapPointsList"),
  mapTypeFilter: document.getElementById("mapTypeFilter"),
  btnNearMe: document.getElementById("btnNearMe"),
  btnLoadParticipantPoints: document.getElementById("btnLoadParticipantPoints"),

  editPointName: document.getElementById("editPointName"),
  editPointAddress: document.getElementById("editPointAddress"),
  editPointType: document.getElementById("editPointType"),
  editPointLat: document.getElementById("editPointLat"),
  editPointLng: document.getElementById("editPointLng"),
  btnApplyPointEdit: document.getElementById("btnApplyPointEdit"),
  btnCancelPointEdit: document.getElementById("btnCancelPointEdit"),

  usersNavLink: document.querySelector('a[href="usuarios.html"]'),
  participantsSectionShell: document.querySelector(".participants-section-shell"),
  indicatorsCard: document.querySelector(".indicators-card"),

  syncCoopDashboardBtn: document.getElementById("syncCoopDashboardBtn"),
  syncCoopDashboardStatus: document.getElementById("syncCoopDashboardStatus")
};

const TAB_META = {
  comunicados: {
    title: "Comunicados da cooperativa",
    subtitle: "Avisos, atualizações e orientações da cooperativa."
  },
  servicos: {
    title: "Serviços disponíveis",
    subtitle: "Ações e apoios operacionais do território."
  },
  mapa: {
    title: "Mapa do território",
    subtitle: "Pontos de coleta e endereços operacionais vinculados à cooperativa."
  },
  calendario: {
    title: "Agenda e calendário",
    subtitle: "Compromissos, reuniões e atividades previstas."
  },
  treinamentos: {
    title: "Treinamentos e formações",
    subtitle: "Trilhas e capacitações da cooperativa."
  },
  coleta: {
    title: "Coleta especial",
    subtitle: "Fluxos operacionais extraordinários."
  },
  ouvidoria: {
    title: "Ouvidoria",
    subtitle: "Canal aberto para escuta e apoio."
  }
};

const STATE = {
  currentUser: null,
  profile: null,
  isAdmin: false,
  canEditAll: false,
  allParticipants: [],
  approvalRequests: [],
  territoryMap: null,
  territoryMarkers: [],
  fixedPoints: [],
  participantPoints: [],
  allMapPoints: [],
  geocodeCache: new Map(),
  selectedPointId: null,
  participantsUnsubscribe: null,
  approvalRequestsUnsubscribe: null
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function roleLabel(role) {
  const map = {
    admin: "Administrador",
    cooperativa: "Cooperativa",
    governanca: "Governança",
    gestor: "Gestor",
    user: "Cooperativa",
    usuario: "Cooperativa"
  };
  return map[role] || role || "Perfil";
}

function isCommonCoopUser(role) {
  return ["cooperativa", "user", "usuario"].includes(role);
}

function isAdminUser(role) {
  return role === "admin";
}

function participantIcon(type) {
  const key = normalizeText(type);
  if (key === "condominio") return "🏢";
  if (key === "comercio") return "🏪";
  if (key === "familia") return "👨‍👩‍👧";
  if (key === "morador") return "👤";
  if (key === "lideranca") return "📣";
  if (key === "participante") return "🧩";
  return "👤";
}

function formatParticipantType(type) {
  const map = {
    morador: "Morador",
    familia: "Família",
    condominio: "Condomínio",
    comercio: "Comércio",
    lideranca: "Liderança",
    participante: "Participante",
    usuario: "Participante",
    user: "Participante"
  };
  return map[normalizeText(type)] || type || "Não informado";
}

function buildFullAddress(participant) {
  if (!participant) return "";

  const address = participant.address || {};

  const nestedAddress = [
    address.street,
    address.number,
    address.neighborhood,
    address.city || "Porto Alegre",
    address.state || "RS"
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");

  if (nestedAddress) return nestedAddress;

  const flatAddress = [
    participant.rua,
    participant.numero,
    participant.bairro,
    participant.cidade || "Porto Alegre",
    participant.uf || "RS"
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");

  return participant.enderecoCompleto || flatAddress;
}

function hasValidLatLng(item) {
  const lat = Number(item?.lat ?? item?.address?.lat);
  const lng = Number(item?.lng ?? item?.address?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
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

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil de usuário inválido.");
  if (profile.status !== "active") throw new Error("Usuário sem acesso ativo.");

  const acceptedRoles = ["admin", "cooperativa", "user", "usuario"];
  if (!acceptedRoles.includes(profile.role)) {
    throw new Error("Acesso permitido apenas para administrador ou usuário da cooperativa.");
  }

  if (profile.role !== "admin" && !profile.territoryId) {
    throw new Error("Usuário sem território vinculado.");
  }
}

function setupSidebar() {
  els.menuBtn?.addEventListener("click", () => {
    els.sidebar?.classList.add("open");
    els.mobileOverlay?.classList.add("show");
  });

  function closeSidebar() {
    els.sidebar?.classList.remove("open");
    els.mobileOverlay?.classList.remove("show");
  }

  els.sidebarClose?.addEventListener("click", closeSidebar);
  els.mobileOverlay?.addEventListener("click", closeSidebar);

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

function fillHeader(profile) {
  const isAdmin = isAdminUser(profile.role);
  const isCommonUser = isCommonCoopUser(profile.role);

  const territory =
    profile.territoryLabel ||
    (isAdmin ? "Todos os territórios" : PAGE_TERRITORY.territoryLabel);

  const coop =
    profile.cooperativeName ||
    profile.cooperativeLabel ||
    (isAdmin ? "Todas as cooperativas" : PAGE_TERRITORY.cooperativeName);

  const name = profile.displayName || profile.name || "Usuário";

  if (els.territoryNameTop) els.territoryNameTop.textContent = territory;
  if (els.cooperativeNameTop) els.cooperativeNameTop.textContent = coop;
  if (els.roleNameTop) els.roleNameTop.textContent = roleLabel(profile.role);
  if (els.userNameTop) els.userNameTop.textContent = name;

  if (els.accessBanner) {
    els.accessBanner.className = `access-banner show ${isAdmin ? "admin" : "cooperativa"}`;
    els.accessBanner.innerHTML = isAdmin
      ? `<strong>Acesso administrativo ativo.</strong> Você pode visualizar e editar dados de todas as cooperativas cadastradas no sistema.`
      : `<strong>Acesso da cooperativa ativo.</strong> Você visualiza e insere dados apenas da sua cooperativa e do seu território vinculado.`;
  }

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin);
  });

  if (els.usersNavLink) {
    els.usersNavLink.style.display = isAdmin ? "" : "none";
  }

  if (els.newParticipantBtn) {
    els.newParticipantBtn.href = PAGE_TERRITORY.participantUrl;
  }

  document.querySelectorAll(`a[href="cadastro-coletas-vila-pinto.html"]`).forEach((a) => {
    a.href = PAGE_TERRITORY.coletasUrl;
  });

  if (els.participantsSectionText) {
    if (isAdmin) {
      els.participantsSectionText.textContent =
        "Visualização geral de participantes cadastrados no sistema.";
    } else {
      els.participantsSectionText.textContent =
        "Participantes vinculados à cooperativa.";
    }
  }
}

function renderInfoList(container, items) {
  if (!container) return;
  container.innerHTML = items.map((item) => `
    <article class="info-item">
      <div class="info-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </div>
      ${item.meta ? `<span class="info-meta">${escapeHtml(item.meta)}</span>` : ""}
    </article>
  `).join("");
}

function renderTrailList(container, items) {
  if (!container) return;
  container.innerHTML = items.map((item) => `
    <article class="trail-item">
      <div class="trail-copy">
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.status)}</span>
      </div>
      ${item.level ? `<span class="trail-level">${escapeHtml(item.level)}</span>` : ""}
    </article>
  `).join("");
}

function fillStaticPanels() {
  renderInfoList(els.noticesList, [
    {
      title: "Comunicado do Núcleo",
      description: "Atualização de conteúdos, trilhas e materiais operacionais nesta semana.",
      meta: "Hoje"
    },
    {
      title: "Campanha ativa no território",
      description: "Mutirão de educação ambiental com mobilização local.",
      meta: "Esta semana"
    }
  ]);

  renderTrailList(els.featuredTrails, [
    {
      title: "Trilha 1 • Introdução",
      status: "Status: não iniciada",
      level: "Básico"
    },
    {
      title: "Trilha 2 • Gestão de Resíduos",
      status: "Status: em andamento",
      level: "Essencial"
    }
  ]);

  renderInfoList(els.territoryCommunications, [
    {
      title: "Mutirão de limpeza — sábado",
      description: "Concentração às 8h. Leve luvas, água e identificação da cooperativa.",
      meta: "Ação"
    },
    {
      title: "Mudança de horário",
      description: "Triagem das 8h às 17h de segunda a sexta-feira.",
      meta: "Aviso"
    },
    {
      title: "Coleta especial aberta",
      description: "Agendamentos para grandes volumes via registro operacional.",
      meta: "Serviço"
    }
  ]);

  renderInfoList(els.territoryServices, [
    {
      title: "Apoio operacional",
      description: "Orientação sobre triagem, rota, recebimento e organização dos pontos."
    },
    {
      title: "Ponto de entrega",
      description: "Recebimento de materiais vinculados ao território e parceiros locais."
    }
  ]);

  renderInfoList(els.territoryCalendar, [
    {
      title: "Reunião da cooperativa",
      description: "Quarta-feira • 14h • sede local",
      meta: "Agenda"
    },
    {
      title: "Oficina ambiental",
      description: "Sexta-feira • 9h • escola do território",
      meta: "Formação"
    }
  ]);

  renderInfoList(els.territoryTrainings, [
    {
      title: "Formação inicial",
      description: "Introdução à separação correta dos resíduos."
    },
    {
      title: "Boas práticas operacionais",
      description: "Procedimentos, segurança e rotina da cooperativa."
    }
  ]);

  if (els.summaryAccepted) els.summaryAccepted.textContent = "4";
  if (els.summaryRejected) els.summaryRejected.textContent = "4";
  if (els.indicatorDocs) els.indicatorDocs.textContent = "0";
  if (els.indicatorActions) els.indicatorActions.textContent = "0";
}

function setupTerritoryTabs() {
  const tabs = document.querySelectorAll(".territory-tab");
  const contents = document.querySelectorAll(".territory-tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.tab;

      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(`tab-${key}`)?.classList.add("active");

      if (els.territoryPanelTitle) {
        els.territoryPanelTitle.textContent = TAB_META[key]?.title || "Painel do território";
      }

      if (els.territoryPanelSubtitle) {
        els.territoryPanelSubtitle.textContent = TAB_META[key]?.subtitle || "";
      }

      if (key === "mapa") {
        setTimeout(() => STATE.territoryMap?.invalidateSize(), 200);
      }
    });
  });
}

function computeParticipantsKpis(items) {
  const total = items.length;

  const peopleCount = items.filter((item) =>
    ["morador", "familia", "lideranca", "participante", "user", "usuario"].includes(
      normalizeText(item.participantType || item.tipoParticipante || item.tipo)
    )
  ).length;

  const condoCount = items.filter(
    (item) => normalizeText(item.participantType || item.tipoParticipante || item.tipo) === "condominio"
  ).length;

  if (els.participantsTotalCount) els.participantsTotalCount.textContent = String(total);
  if (els.participantsPeopleCount) els.participantsPeopleCount.textContent = String(peopleCount);
  if (els.participantsCondoCount) els.participantsCondoCount.textContent = String(condoCount);
  if (els.indicatorParticipants) els.indicatorParticipants.textContent = String(total);
}

function renderParticipants(items) {
  if (!els.participantsList) return;

  if (!items.length) {
    els.participantsList.innerHTML = `
      <div class="participants-empty">
        Nenhum participante encontrado para o filtro atual.
      </div>
    `;
    return;
  }

  els.participantsList.innerHTML = items.map((item) => {
    const participantType = item.participantType || item.tipoParticipante || item.tipo;
    const address = buildFullAddress(item) || "Endereço não informado";

    return `
      <article class="participant-row">
        <div class="participant-main">
          <div class="participant-avatar">${participantIcon(participantType)}</div>
          <div class="participant-copy">
            <strong>${escapeHtml(item.name || item.nome || "Sem nome")}</strong>
            <span>${escapeHtml(item.participantCode || item.familyCode || item.codigoFamilia || "-")}</span>
            <span>${escapeHtml(address)}</span>
          </div>
        </div>

        <div class="participant-meta">
          <span class="participant-tag">${escapeHtml(formatParticipantType(participantType))}</span>
          <span class="participant-subtag">${escapeHtml(
            item.localType ||
            item.address?.neighborhood ||
            item.bairro ||
            item.territoryLabel ||
            "Território"
          )}</span>
        </div>
      </article>
    `;
  }).join("");
}

function filterParticipants() {
  const term = normalizeText(els.participantSearchInput?.value);

  if (!term) {
    computeParticipantsKpis(STATE.allParticipants);
    renderParticipants(STATE.allParticipants);
    return;
  }

  const filtered = STATE.allParticipants.filter((item) => {
    const haystack = [
      item.name,
      item.nome,
      item.participantCode,
      item.familyCode,
      item.codigoFamilia,
      item.localType,
      item.address?.street,
      item.address?.number,
      item.address?.neighborhood,
      item.address?.city,
      item.rua,
      item.numero,
      item.bairro,
      item.cidade,
      item.enderecoCompleto
    ].map(normalizeText).join(" ");

    return haystack.includes(term);
  });

  computeParticipantsKpis(filtered);
  renderParticipants(filtered);
}

function bindParticipantsSearch() {
  els.participantSearchInput?.addEventListener("input", filterParticipants);
}

function buildParticipantsQuery(profile, useOrdered = true) {
  if (profile.role === "admin") {
    return useOrdered
      ? query(collection(db, "participants"), orderBy("createdAtISO", "desc"))
      : query(collection(db, "participants"));
  }

  return useOrdered
    ? query(
        collection(db, "participants"),
        where("territoryId", "==", profile.territoryId),
        orderBy("createdAtISO", "desc")
      )
    : query(collection(db, "participants"), where("territoryId", "==", profile.territoryId));
}

function applyParticipantsSnapshot(snapshot) {
  STATE.allParticipants = snapshot.docs
    .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
    .filter((item) => item.approvalStatus !== "rejected");

  computeParticipantsKpis(STATE.allParticipants);
  renderParticipants(STATE.allParticipants);
  filterParticipants();
  updateParticipantIndicator();

  if (STATE.profile) {
    loadIndicators(STATE.profile);
  }
}

function loadParticipants(profile) {
  if (typeof STATE.participantsUnsubscribe === "function") {
    try { STATE.participantsUnsubscribe(); } catch (_) {}
    STATE.participantsUnsubscribe = null;
  }

  const orderedQuery = buildParticipantsQuery(profile, true);

  STATE.participantsUnsubscribe = onSnapshot(
    orderedQuery,
    (snapshot) => {
      applyParticipantsSnapshot(snapshot);
    },
    (error) => {
      console.warn("Falha na consulta ordenada de participantes. Tentando fallback sem orderBy...", error);

      const fallbackQuery = buildParticipantsQuery(profile, false);

      STATE.participantsUnsubscribe = onSnapshot(
        fallbackQuery,
        (snapshot) => {
          applyParticipantsSnapshot(snapshot);
        },
        (fallbackError) => {
          console.error("Erro ao carregar participantes:", fallbackError);
          if (els.participantsList) {
            els.participantsList.innerHTML = `
              <div class="participants-empty">
                Não foi possível carregar os participantes.
              </div>
            `;
          }
        }
      );
    }
  );
}

function buildApprovalRequestsQuery(profile, useOrdered = true) {
  if (profile.role === "admin") {
    return useOrdered
      ? query(
          collection(db, "approvalRequests"),
          where("type", "==", "participant_registration"),
          where("status", "==", "pending"),
          orderBy("createdAtISO", "desc")
        )
      : query(
          collection(db, "approvalRequests"),
          where("type", "==", "participant_registration"),
          where("status", "==", "pending")
        );
  }

  return useOrdered
    ? query(
        collection(db, "approvalRequests"),
        where("type", "==", "participant_registration"),
        where("status", "==", "pending"),
        where("territoryId", "==", profile.territoryId),
        orderBy("createdAtISO", "desc")
      )
    : query(
        collection(db, "approvalRequests"),
        where("type", "==", "participant_registration"),
        where("status", "==", "pending"),
        where("territoryId", "==", profile.territoryId)
      );
}

function renderApprovalRequests(items) {
  if (!els.approvalRequestsList) return;

  if (!STATE.isAdmin) {
    els.approvalRequestsList.innerHTML = `
      <div class="participants-empty">
        Área disponível apenas para administradores.
      </div>
    `;
    return;
  }

  if (!items.length) {
    els.approvalRequestsList.innerHTML = `
      <div class="participants-empty">
        Nenhuma solicitação pendente no momento.
      </div>
    `;
    return;
  }

  els.approvalRequestsList.innerHTML = items.map((item) => {
    const snapshot = item.applicantSnapshot || {};
    const address = snapshot.address?.addressLine || [
      snapshot.address?.street,
      snapshot.address?.number,
      snapshot.address?.neighborhood,
      snapshot.address?.city,
      snapshot.address?.state
    ].filter(Boolean).join(", ");

    return `
      <article class="participant-row">
        <div class="participant-main">
          <div class="participant-avatar">${participantIcon(item.participantType)}</div>
          <div class="participant-copy">
            <strong>${escapeHtml(item.participantName || "Sem nome")}</strong>
            <span>${escapeHtml(item.participantCode || "-")}</span>
            <span>${escapeHtml(address || "Endereço não informado")}</span>
            <span>${escapeHtml(snapshot.phone || "Telefone não informado")}</span>
          </div>
        </div>

        <div class="participant-meta">
          <span class="participant-tag">${escapeHtml(formatParticipantType(item.participantType))}</span>
          <span class="participant-subtag">${escapeHtml(item.territoryLabel || "Território")}</span>
          <div style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;">
            <button type="button" class="map-mini-btn green" data-approve-request="${escapeHtml(item.id)}">
              Aprovar
            </button>
            <button type="button" class="map-mini-btn orange" data-reject-request="${escapeHtml(item.id)}">
              Rejeitar
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  els.approvalRequestsList.querySelectorAll("[data-approve-request]").forEach((btn) => {
    btn.addEventListener("click", () => approveParticipantRequest(btn.dataset.approveRequest));
  });

  els.approvalRequestsList.querySelectorAll("[data-reject-request]").forEach((btn) => {
    btn.addEventListener("click", () => rejectParticipantRequest(btn.dataset.rejectRequest));
  });
}

function loadApprovalRequests(profile) {
  if (!els.approvalRequestsList) return;

  if (typeof STATE.approvalRequestsUnsubscribe === "function") {
    try { STATE.approvalRequestsUnsubscribe(); } catch (_) {}
    STATE.approvalRequestsUnsubscribe = null;
  }

  if (!STATE.isAdmin) {
    renderApprovalRequests([]);
    return;
  }

  const orderedQuery = buildApprovalRequestsQuery(profile, true);

  STATE.approvalRequestsUnsubscribe = onSnapshot(
    orderedQuery,
    (snapshot) => {
      STATE.approvalRequests = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));
      renderApprovalRequests(STATE.approvalRequests);
      if (STATE.profile) loadIndicators(STATE.profile);
    },
    (error) => {
      console.warn("Falha na consulta ordenada de solicitações. Tentando fallback...", error);

      const fallbackQuery = buildApprovalRequestsQuery(profile, false);

      STATE.approvalRequestsUnsubscribe = onSnapshot(
        fallbackQuery,
        (snapshot) => {
          STATE.approvalRequests = snapshot.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data()
          }));
          renderApprovalRequests(STATE.approvalRequests);
          if (STATE.profile) loadIndicators(STATE.profile);
        },
        (fallbackError) => {
          console.error("Erro ao carregar solicitações:", fallbackError);
          if (els.approvalRequestsList) {
            els.approvalRequestsList.innerHTML = `
              <div class="participants-empty">
                Não foi possível carregar as solicitações.
              </div>
            `;
          }
        }
      );
    }
  );
}

async function approveParticipantRequest(requestId) {
  try {
    const requestRef = doc(db, "approvalRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) throw new Error("Solicitação não encontrada.");

    const requestData = requestSnap.data();
    if (!requestData.participantId) throw new Error("Solicitação sem participantId.");

    const participantRef = doc(db, "participants", requestData.participantId);
    const now = serverTimestamp();

    await updateDoc(requestRef, {
      status: "approved",
      approved: true,
      rejected: false,
      active: false,
      publicSync: false,
      updatedAt: now,
      "review.approvedAt": now,
      "review.approvedBy": STATE.currentUser?.uid || null,
      "review.approvedByName": STATE.profile?.name || STATE.profile?.displayName || "Administrador",
      "review.rejectedAt": null,
      "review.rejectedBy": null,
      "review.rejectedByName": null
    });

    await updateDoc(participantRef, {
      status: "active",
      approvalStatus: "approved",
      active: true,
      updatedAt: now,
      "review.approvedAt": now,
      "review.approvedBy": STATE.currentUser?.uid || null,
      "review.approvedByName": STATE.profile?.name || STATE.profile?.displayName || "Administrador",
      "review.rejectedAt": null,
      "review.rejectedBy": null,
      "review.rejectedByName": null
    });

    if (STATE.profile) {
      await runCooperativaDashboardSync({
        territoryId: STATE.profile.territoryId || PAGE_TERRITORY.territoryId,
        territoryLabel: STATE.profile.territoryLabel || PAGE_TERRITORY.territoryLabel,
        silent: true
      });
    }

    alert("Solicitação aprovada com sucesso.");
  } catch (error) {
    console.error("Erro ao aprovar solicitação:", error);
    alert(error.message || "Não foi possível aprovar a solicitação.");
  }
}

async function rejectParticipantRequest(requestId) {
  try {
    const requestRef = doc(db, "approvalRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) throw new Error("Solicitação não encontrada.");

    const requestData = requestSnap.data();
    if (!requestData.participantId) throw new Error("Solicitação sem participantId.");

    const participantRef = doc(db, "participants", requestData.participantId);
    const now = serverTimestamp();

    await updateDoc(requestRef, {
      status: "rejected",
      approved: false,
      rejected: true,
      active: false,
      updatedAt: now,
      "review.rejectedAt": now,
      "review.rejectedBy": STATE.currentUser?.uid || null,
      "review.rejectedByName": STATE.profile?.name || STATE.profile?.displayName || "Administrador"
    });

    await updateDoc(participantRef, {
      status: "rejected",
      approvalStatus: "rejected",
      active: false,
      updatedAt: now,
      "review.rejectedAt": now,
      "review.rejectedBy": STATE.currentUser?.uid || null,
      "review.rejectedByName": STATE.profile?.name || STATE.profile?.displayName || "Administrador"
    });

    if (STATE.profile) {
      await runCooperativaDashboardSync({
        territoryId: STATE.profile.territoryId || PAGE_TERRITORY.territoryId,
        territoryLabel: STATE.profile.territoryLabel || PAGE_TERRITORY.territoryLabel,
        silent: true
      });
    }

    alert("Solicitação rejeitada com sucesso.");
  } catch (error) {
    console.error("Erro ao rejeitar solicitação:", error);
    alert(error.message || "Não foi possível rejeitar a solicitação.");
  }
}

function getDefaultTerritoryPoints(profile) {
  const territoryId = profile?.territoryId || PAGE_TERRITORY.territoryId;

  if (territoryId === "crgr_vila_pinto") {
    return [
      {
        id: "vp-main",
        name: "Vila Pinto",
        type: "seletiva",
        lat: -30.048729170292532,
        lng: -51.15652604283108,
        address: "Vila Pinto, Porto Alegre - RS"
      },
      {
        id: "vp-2",
        name: "Escola parceira",
        type: "papel",
        lat: -30.0468,
        lng: -51.1602,
        address: "Área escolar do território"
      },
      {
        id: "vp-3",
        name: "Ponto comunitário",
        type: "plastico",
        lat: -30.0505,
        lng: -51.1539,
        address: "Centro comunitário local"
      }
    ];
  }

  if (territoryId === "crgr_coadesc" || territoryId === "crgr_cooadesc") {
    return [
      {
        id: "coa-1",
        name: "COOADESC",
        type: "seletiva",
        lat: -30.003,
        lng: -51.206,
        address: "Base da COOADESC"
      },
      {
        id: "coa-2",
        name: "Ponto comunitário COOADESC",
        type: "plastico",
        lat: -30.006,
        lng: -51.203,
        address: "Ponto comunitário da região"
      }
    ];
  }

  if (territoryId === "crgr_padre_cacique") {
    return [
      {
        id: "pc-1",
        name: "Padre Cacique",
        type: "seletiva",
        lat: -30.140122365657504,
        lng: -51.1268772051727,
        address: "Base da cooperativa Padre Cacique"
      },
      {
        id: "pc-2",
        name: "Ponto parceiro Padre Cacique",
        type: "vidro",
        lat: -30.1388,
        lng: -51.1249,
        address: "Ponto de apoio do território"
      }
    ];
  }

  if (profile.role === "admin") {
    return [
      {
        id: "admin-default",
        name: "Base geral do NSRU",
        type: "seletiva",
        lat: PAGE_TERRITORY.mapLat,
        lng: PAGE_TERRITORY.mapLng,
        address: "Visualização geral do sistema"
      }
    ];
  }

  return [
    {
      id: "default-1",
      name: profile?.territoryLabel || PAGE_TERRITORY.territoryLabel,
      type: "seletiva",
      lat: PAGE_TERRITORY.mapLat,
      lng: PAGE_TERRITORY.mapLng,
      address: "Ponto principal do território"
    }
  ];
}

function clearTerritoryMarkers() {
  STATE.territoryMarkers.forEach((marker) => STATE.territoryMap?.removeLayer(marker));
  STATE.territoryMarkers = [];
}

function getMarkerColor(type) {
  const normalized = normalizeText(type);
  if (normalized === "participante") return "#EF6B22";
  if (normalized === "papel") return "#53ACDE";
  if (normalized === "plastico") return "#81B92A";
  if (normalized === "vidro") return "#3C3A39";
  return "#2F8F4E";
}

function buildDivIcon(type) {
  const color = getMarkerColor(type);
  return L.divIcon({
    className: "custom-map-pin-wrap",
    html: `
      <div style="
        width:18px;
        height:18px;
        border-radius:999px;
        background:${color};
        border:3px solid #fff;
        box-shadow:0 4px 14px rgba(0,0,0,.18);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

function selectPointForEdit(pointId) {
  const point = STATE.allMapPoints.find((p) => p.id === pointId);
  if (!point) return;

  STATE.selectedPointId = pointId;

  if (els.editPointName) els.editPointName.value = point.name || "";
  if (els.editPointAddress) els.editPointAddress.value = point.address || "";
  if (els.editPointType) els.editPointType.value = point.type || "";
  if (els.editPointLat) els.editPointLat.value = point.lat ?? "";
  if (els.editPointLng) els.editPointLng.value = point.lng ?? "";
}

function clearPointEditor() {
  STATE.selectedPointId = null;
  if (els.editPointName) els.editPointName.value = "";
  if (els.editPointAddress) els.editPointAddress.value = "";
  if (els.editPointType) els.editPointType.value = "";
  if (els.editPointLat) els.editPointLat.value = "";
  if (els.editPointLng) els.editPointLng.value = "";
}

function updatePointInState(updatedPoint) {
  STATE.allMapPoints = STATE.allMapPoints.map((item) =>
    item.id === updatedPoint.id ? { ...item, ...updatedPoint } : item
  );

  STATE.fixedPoints = STATE.fixedPoints.map((item) =>
    item.id === updatedPoint.id ? { ...item, ...updatedPoint } : item
  );

  STATE.participantPoints = STATE.participantPoints.map((item) =>
    item.id === updatedPoint.id ? { ...item, ...updatedPoint } : item
  );
}

function renderMapPointsList(points) {
  if (!els.mapPointsList) return;

  if (!points.length) {
    els.mapPointsList.innerHTML = `
      <div class="participants-empty">Nenhum ponto encontrado para o filtro atual.</div>
    `;
    return;
  }

  els.mapPointsList.innerHTML = points.map((point) => `
    <article class="map-point-card">
      <strong>${escapeHtml(point.name)}</strong>
      <span>${escapeHtml(point.address || "Endereço não informado")}</span>
      <span>Tipo: ${escapeHtml(point.type || "seletiva")} • ${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}</span>

      <div class="map-point-card-actions">
        <button class="map-mini-btn green" type="button" data-edit-point="${escapeHtml(point.id)}">Editar</button>
        <button class="map-mini-btn orange" type="button" data-focus-point="${escapeHtml(point.id)}">Ver no mapa</button>
      </div>
    </article>
  `).join("");

  els.mapPointsList.querySelectorAll("[data-edit-point]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectPointForEdit(btn.dataset.editPoint);
    });
  });

  els.mapPointsList.querySelectorAll("[data-focus-point]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const point = STATE.allMapPoints.find((p) => p.id === btn.dataset.focusPoint);
      if (!point || !STATE.territoryMap) return;
      STATE.territoryMap.setView([point.lat, point.lng], 17);
    });
  });
}

function renderTerritoryMap(points) {
  if (typeof L === "undefined") return;

  if (!STATE.territoryMap) {
    const first = points[0] || { lat: PAGE_TERRITORY.mapLat, lng: PAGE_TERRITORY.mapLng };

    STATE.territoryMap = L.map("territoryMap", {
      zoomControl: true
    }).setView([first.lat, first.lng], PAGE_TERRITORY.mapZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(STATE.territoryMap);
  }

  clearTerritoryMarkers();

  const bounds = [];

  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng], {
      icon: buildDivIcon(point.type),
      draggable: true
    }).addTo(STATE.territoryMap);

    marker.bindPopup(`
      <strong>${escapeHtml(point.name)}</strong><br>
      ${escapeHtml(point.address || "")}<br>
      Tipo: ${escapeHtml(point.type || "seletiva")}
    `);

    marker.on("click", () => {
      selectPointForEdit(point.id);
    });

    marker.on("dragend", (event) => {
      const latlng = event.target.getLatLng();
      const updatedPoint = {
        ...point,
        lat: Number(latlng.lat),
        lng: Number(latlng.lng)
      };

      updatePointInState(updatedPoint);
      selectPointForEdit(point.id);
      if (els.editPointLat) els.editPointLat.value = updatedPoint.lat;
      if (els.editPointLng) els.editPointLng.value = updatedPoint.lng;
      renderMapPointsList(getCurrentMapFilteredPoints());
    });

    STATE.territoryMarkers.push(marker);
    bounds.push([point.lat, point.lng]);
  });

  if (bounds.length === 1) {
    STATE.territoryMap.setView(bounds[0], PAGE_TERRITORY.mapZoom);
  } else if (bounds.length > 1) {
    STATE.territoryMap.fitBounds(bounds, { padding: [30, 30] });
  }

  if (els.mapPointsCount) els.mapPointsCount.textContent = String(points.length);
  if (els.summaryPoints) els.summaryPoints.textContent = String(points.length);

  renderMapPointsList(points);
}

function getCurrentMapFilteredPoints() {
  const filter = els.mapTypeFilter?.value || "all";
  if (filter === "all") return STATE.allMapPoints;
  return STATE.allMapPoints.filter((point) => normalizeText(point.type) === normalizeText(filter));
}

function applyMapFilter() {
  renderTerritoryMap(getCurrentMapFilteredPoints());
}

function applyPointEdit() {
  if (!STATE.selectedPointId) {
    alert("Selecione um ponto para editar.");
    return;
  }

  const point = STATE.allMapPoints.find((p) => p.id === STATE.selectedPointId);
  if (!point) return;

  const updatedPoint = {
    ...point,
    name: els.editPointName?.value?.trim() || point.name,
    address: els.editPointAddress?.value?.trim() || point.address,
    type: els.editPointType?.value?.trim() || point.type,
    lat: Number(els.editPointLat?.value),
    lng: Number(els.editPointLng?.value)
  };

  if (!Number.isFinite(updatedPoint.lat) || !Number.isFinite(updatedPoint.lng)) {
    alert("Latitude e longitude inválidas.");
    return;
  }

  updatePointInState(updatedPoint);
  applyMapFilter();

  const selected = STATE.allMapPoints.find((p) => p.id === updatedPoint.id);
  if (selected && STATE.territoryMap) {
    STATE.territoryMap.setView([selected.lat, selected.lng], 16);
  }

  alert("Ponto atualizado com sucesso na tela.");
}

function setupMapActions() {
  els.mapTypeFilter?.addEventListener("change", applyMapFilter);

  els.btnNearMe?.addEventListener("click", () => {
    if (!navigator.geolocation || !STATE.territoryMap) {
      alert("Geolocalização não disponível neste dispositivo.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        STATE.territoryMap.setView([lat, lng], 15);

        const userMarker = L.circleMarker([lat, lng], {
          radius: 10,
          weight: 3,
          color: "#53ACDE",
          fillColor: "#53ACDE",
          fillOpacity: 0.35
        }).addTo(STATE.territoryMap);

        userMarker.bindPopup("Sua localização atual").openPopup();

        setTimeout(() => {
          try { STATE.territoryMap.removeLayer(userMarker); } catch (_) {}
        }, 12000);
      },
      () => {
        alert("Não foi possível obter sua localização.");
      }
    );
  });

  els.btnLoadParticipantPoints?.addEventListener("click", async () => {
    els.btnLoadParticipantPoints.disabled = true;
    els.btnLoadParticipantPoints.textContent = "Carregando endereços...";

    try {
      await loadParticipantAddressPoints();
      applyMapFilter();
    } catch (error) {
      console.error("Erro ao carregar pontos dos participantes:", error);
      alert("Não foi possível carregar os pontos dos participantes.");
    } finally {
      els.btnLoadParticipantPoints.disabled = false;
      els.btnLoadParticipantPoints.textContent = "➕ Carregar pontos por endereço";
    }
  });

  els.btnApplyPointEdit?.addEventListener("click", applyPointEdit);
  els.btnCancelPointEdit?.addEventListener("click", clearPointEditor);
}

function initTerritoryMap(profile) {
  STATE.fixedPoints = getDefaultTerritoryPoints(profile);
  STATE.participantPoints = [];
  STATE.allMapPoints = [...STATE.fixedPoints];

  setTimeout(() => {
    renderTerritoryMap(STATE.allMapPoints);
  }, 120);
}

async function geocodeAddress(addressText) {
  const key = addressText.trim();
  if (!key) return null;

  if (STATE.geocodeCache.has(key)) {
    return STATE.geocodeCache.get(key);
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("Falha na geocodificação.");
  }

  const data = await response.json();
  const result = data?.[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;

  STATE.geocodeCache.set(key, result);
  return result;
}

function buildParticipantPoint(participant, coords) {
  return {
    id: `participant-${participant.id}`,
    name:
      participant.name ||
      participant.nome ||
      participant.participantCode ||
      participant.familyCode ||
      "Participante",
    type: "participante",
    lat: Number(coords.lat),
    lng: Number(coords.lng),
    address: buildFullAddress(participant) || "Endereço do participante"
  };
}

async function loadParticipantAddressPoints() {
  if (!STATE.allParticipants.length) return;

  const points = [];

  for (const participant of STATE.allParticipants) {
    if (participant.approvalStatus && participant.approvalStatus !== "approved") continue;

    if (hasValidLatLng(participant)) {
      const pointCoords = {
        lat: Number(participant.lat ?? participant.address?.lat),
        lng: Number(participant.lng ?? participant.address?.lng)
      };
      points.push(buildParticipantPoint(participant, pointCoords));
      continue;
    }

    const address = buildFullAddress(participant);
    if (!address) continue;

    try {
      const coords = await geocodeAddress(address);
      if (coords) points.push(buildParticipantPoint(participant, coords));
    } catch (error) {
      console.warn("Endereço não geocodificado:", address, error);
    }
  }

  const uniqueMap = new Map();
  [...STATE.fixedPoints, ...points].forEach((item) => uniqueMap.set(item.id, item));

  STATE.participantPoints = points;
  STATE.allMapPoints = [...uniqueMap.values()];

  renderTerritoryMap(getCurrentMapFilteredPoints());
}

async function loadCollectionCount(collectionName, profile, whereField = "territoryId") {
  try {
    let q;

    if (profile.role === "admin") {
      q = query(collection(db, collectionName), limit(500));
    } else {
      q = query(
        collection(db, collectionName),
        where(whereField, "==", profile.territoryId),
        limit(500)
      );
    }

    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.warn(`Erro ao contar coleção ${collectionName}:`, error);
    return 0;
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
    pontosCount: STATE.allMapPoints?.length || 1,
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
    setCoopSyncStatus(
      silent
        ? "Verificando atualização automática..."
        : "Atualizando indicadores da cooperativa..."
    );

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
    const updatedAt =
      data?.updatedAt && typeof data.updatedAt.toDate === "function"
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

async function loadIndicators(profile) {
  const isAdmin = isAdminUser(profile.role);

  const coletas = await loadCollectionCount("coletas", profile, "territoryId");
  const usersCount = isAdmin ? await loadCollectionCount("users", profile, "territoryId") : null;
  const participantsCount = STATE.allParticipants.filter(
    (item) => item.approvalStatus === "approved" || item.status === "active"
  ).length;

  if (els.indicatorColetas) els.indicatorColetas.textContent = String(coletas);
  if (els.indicatorParticipants) els.indicatorParticipants.textContent = String(participantsCount);
  if (els.indicatorDocs) els.indicatorDocs.textContent = isAdmin ? String(usersCount) : "—";
  if (els.indicatorActions) els.indicatorActions.textContent = isAdmin ? String(STATE.approvalRequests.length) : "—";
}

function updateParticipantIndicator() {
  if (els.indicatorParticipants) {
    const approvedCount = STATE.allParticipants.filter(
      (item) => item.approvalStatus === "approved" || item.status === "active"
    ).length;
    els.indicatorParticipants.textContent = String(approvedCount);
  }
}

function applyPermissionRules(profile) {
  STATE.isAdmin = profile.role === "admin";
  STATE.canEditAll = STATE.isAdmin || ["cooperativa", "user", "usuario"].includes(profile.role);
}

function applyRoleVisibility(profile) {
  const isAdmin = isAdminUser(profile.role);
  const isCommonUser = isCommonCoopUser(profile.role);

  if (els.usersNavLink) els.usersNavLink.style.display = isAdmin ? "" : "none";
  if (els.newParticipantBtn) els.newParticipantBtn.style.display = isAdmin ? "" : "none";
  if (els.participantsSectionShell) els.participantsSectionShell.style.display = "";

  if (els.indicatorDocs) {
    const labelEl = els.indicatorDocs.parentElement?.querySelector("span");
    if (labelEl) labelEl.textContent = "Usuários";
  }

  if (!isAdmin) {
    if (els.indicatorDocs) els.indicatorDocs.textContent = "—";
    document.querySelectorAll(".admin-only").forEach((el) => {
      el.style.display = "none";
    });
  }

  if (isCommonUser) clearPointEditor();
}

function boot() {
  setupSidebar();
  setupLogout();
  setupTerritoryTabs();
  fillStaticPanels();
  bindParticipantsSearch();
  setupMapActions();

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
      loadParticipants(profile);
      loadApprovalRequests(profile);
      initTerritoryMap(profile);

      const territoryId = profile.territoryId || PAGE_TERRITORY.territoryId;
      const territoryLabel = profile.territoryLabel || PAGE_TERRITORY.territoryLabel;

      bindCooperativaSyncButton({ territoryId, territoryLabel });
      await autoSyncCooperativaDashboardIfNeeded({ territoryId, territoryLabel });

      setTimeout(() => {
        loadIndicators(profile);
      }, 600);
    } catch (error) {
      console.error("Erro ao carregar painel da cooperativa:", error);
      alert(error.message || "Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();