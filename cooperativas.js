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
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
  btnCancelPointEdit: document.getElementById("btnCancelPointEdit")
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
  territoryMap: null,
  territoryMarkers: [],
  fixedPoints: [],
  participantPoints: [],
  allMapPoints: [],
  geocodeCache: new Map(),
  selectedPointId: null
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
    gestor: "Gestor"
  };
  return map[role] || role || "Perfil";
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
    participante: "Participante"
  };
  return map[normalizeText(type)] || type || "Não informado";
}

function buildFullAddress(participant) {
  const address = participant?.address || {};

  const pieces = [
    address.street,
    address.number,
    address.neighborhood,
    address.city || "Porto Alegre",
    address.state || "RS"
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  return pieces.join(", ");
}

function hasValidLatLng(item) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado.");
  return { id: snap.id, ...snap.data() };
}

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil de usuário inválido.");
  if (profile.status !== "active") throw new Error("Usuário sem acesso ativo.");

  const acceptedRoles = ["admin", "cooperativa"];
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
  const isAdmin = profile.role === "admin";
  const territory = profile.territoryLabel || (isAdmin ? "Todos os territórios" : "Território");
  const coop = profile.cooperativeName || profile.cooperativeLabel || (isAdmin ? "Todas as cooperativas" : "Cooperativa");
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
  if (els.indicatorDocs) els.indicatorDocs.textContent = "12";
  if (els.indicatorActions) els.indicatorActions.textContent = "5";
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
    ["morador", "familia", "lideranca", "participante"].includes(normalizeText(item.participantType))
  ).length;

  const condoCount = items.filter((item) => normalizeText(item.participantType) === "condominio").length;

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
    const address = buildFullAddress(item) || "Endereço não informado";
    return `
      <article class="participant-row">
        <div class="participant-main">
          <div class="participant-avatar">${participantIcon(item.participantType)}</div>
          <div class="participant-copy">
            <strong>${escapeHtml(item.name || "Sem nome")}</strong>
            <span>${escapeHtml(item.participantCode || "-")}</span>
            <span>${escapeHtml(address)}</span>
          </div>
        </div>

        <div class="participant-meta">
          <span class="participant-tag">${escapeHtml(formatParticipantType(item.participantType))}</span>
          <span class="participant-subtag">${escapeHtml(item.localType || item.address?.neighborhood || "Território")}</span>
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
      item.participantCode,
      item.localType,
      item.address?.street,
      item.address?.number,
      item.address?.neighborhood,
      item.address?.city
    ]
      .map(normalizeText)
      .join(" ");

    return haystack.includes(term);
  });

  computeParticipantsKpis(filtered);
  renderParticipants(filtered);
}

function bindParticipantsSearch() {
  els.participantSearchInput?.addEventListener("input", filterParticipants);
}

function buildParticipantsQuery(profile) {
  if (profile.role === "admin") {
    return query(collection(db, "participants"), orderBy("createdAtISO", "desc"));
  }

  return query(
    collection(db, "participants"),
    where("territoryId", "==", profile.territoryId),
    orderBy("createdAtISO", "desc")
  );
}

function loadParticipants(profile) {
  const q = buildParticipantsQuery(profile);

  onSnapshot(
    q,
    (snapshot) => {
      STATE.allParticipants = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));

      computeParticipantsKpis(STATE.allParticipants);
      renderParticipants(STATE.allParticipants);
      filterParticipants();
      updateParticipantIndicator();
    },
    (error) => {
      console.error("Erro ao carregar participantes:", error);
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

function getDefaultTerritoryPoints(profile) {
  const territoryId = profile?.territoryId || "";

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

  if (territoryId === "crgr_cooadesc") {
    return [
      {
        id: "coo-1",
        name: "COOADESC",
        type: "seletiva",
        lat: -30.003,
        lng: -51.206,
        address: "Rua Seis (Vila Esperança), 113 — Farrapos"
      },
      {
        id: "coo-2",
        name: "Ponto de papel e plástico",
        type: "plastico",
        lat: -30.006,
        lng: -51.203,
        address: "Ponto comunitário da região"
      }
    ];
  }

  if (territoryId === "crgr_cooperilhas") {
    return [
      {
        id: "coopi-1",
        name: "Cooperilhas",
        type: "seletiva",
        lat: -30.016667,
        lng: -51.216667,
        address: "Rua Paraíba, 177 — Floresta"
      },
      {
        id: "coopi-2",
        name: "Ponto parceiro",
        type: "vidro",
        lat: -30.0182,
        lng: -51.2124,
        address: "Região de apoio local"
      }
    ];
  }

  if (profile.role === "admin") {
    return [
      {
        id: "admin-default",
        name: "Base geral do NSRU",
        type: "seletiva",
        lat: -30.0346,
        lng: -51.2177,
        address: "Visualização geral do sistema"
      }
    ];
  }

  return [
    {
      id: "default-1",
      name: profile?.territoryLabel || "Ponto do território",
      type: "seletiva",
      lat: -30.0346,
      lng: -51.2177,
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

  const mapContainer = document.getElementById("territoryMap");
  if (!mapContainer) return;

  if (!STATE.territoryMap) {
    const first = points[0] || { lat: -30.0346, lng: -51.2177 };

    STATE.territoryMap = L.map("territoryMap", {
      zoomControl: true
    }).setView([first.lat, first.lng], 13);

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
    STATE.territoryMap.setView(bounds[0], 15);
  } else if (bounds.length > 1) {
    STATE.territoryMap.fitBounds(bounds, { padding: [30, 30] });
  }

  if (els.mapPointsCount) {
    els.mapPointsCount.textContent = String(points.length);
  }

  if (els.summaryPoints) {
    els.summaryPoints.textContent = String(points.length);
  }

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

  alert("Ponto atualizado com sucesso na tela. No próximo passo eu posso ligar isso ao Firebase.");
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
          try {
            STATE.territoryMap.removeLayer(userMarker);
          } catch (_) {}
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
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error("Falha na geocodificação.");
  }

  const data = await response.json();
  const result = data?.[0]
    ? { lat: Number(data[0].lat), lng: Number(data[0].lon) }
    : null;

  STATE.geocodeCache.set(key, result);
  return result;
}

function buildParticipantPoint(participant, coords) {
  return {
    id: `participant-${participant.id}`,
    name: participant.name || participant.participantCode || "Participante",
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
    if (hasValidLatLng(participant)) {
      points.push(buildParticipantPoint(participant, {
        lat: Number(participant.lat),
        lng: Number(participant.lng)
      }));
      continue;
    }

    const address = buildFullAddress(participant);
    if (!address) continue;

    try {
      const coords = await geocodeAddress(address);
      if (coords) {
        points.push(buildParticipantPoint(participant, coords));
      }
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
      q = query(collection(db, collectionName), limit(200));
    } else {
      q = query(collection(db, collectionName), where(whereField, "==", profile.territoryId), limit(200));
    }

    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    console.warn(`Erro ao contar coleção ${collectionName}:`, error);
    return 0;
  }
}

async function loadIndicators(profile) {
  const coletas = await loadCollectionCount("coletas", profile, "territoryId");
  if (els.indicatorColetas) els.indicatorColetas.textContent = String(coletas);
}

function updateParticipantIndicator() {
  if (els.indicatorParticipants) {
    els.indicatorParticipants.textContent = String(STATE.allParticipants.length);
  }
}

function applyPermissionRules(profile) {
  STATE.isAdmin = profile.role === "admin";
  STATE.canEditAll = STATE.isAdmin || profile.role === "cooperativa";
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
      loadParticipants(profile);
      initTerritoryMap(profile);
      loadIndicators(profile);
    } catch (error) {
      console.error("Erro ao carregar painel da cooperativa:", error);
      alert(error.message || "Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();