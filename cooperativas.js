import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";

const els = {
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  sidebarClose: document.getElementById("sidebarClose"),

  territoryNameTop: document.getElementById("territoryNameTop"),
  userNameTop: document.getElementById("userNameTop"),

  noticesList: document.getElementById("noticesList"),
  featuredTrails: document.getElementById("featuredTrails"),

  territoryTabs: document.getElementById("territoryTabs"),
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

  mapPointsCount: document.getElementById("mapPointsCount"),
  mapPointsList: document.getElementById("mapPointsList"),
  mapTypeFilter: document.getElementById("mapTypeFilter"),
  btnNearMe: document.getElementById("btnNearMe")
};

let allParticipants = [];
let territoryMap = null;
let territoryMarkers = [];
let territoryPoints = [];

const TAB_META = {
  comunicados: {
    title: "Comunicados da cooperativa",
    subtitle: "Avisos e atualizações do território."
  },
  servicos: {
    title: "Serviços disponíveis",
    subtitle: "Ações e apoios operacionais do território."
  },
  mapa: {
    title: "Mapa do território",
    subtitle: "Pontos e referências acessíveis ao território."
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

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    throw new Error("Usuário não encontrado.");
  }
  return snap.data();
}

function validateProfile(profile) {
  if (profile.role !== "cooperativa") {
    throw new Error("Acesso permitido somente para cooperativa.");
  }

  if (profile.status !== "active") {
    throw new Error("Usuário sem acesso ativo.");
  }

  if (!profile.territoryId) {
    throw new Error("Usuário sem território vinculado.");
  }
}

function setupSidebar() {
  els.menuBtn?.addEventListener("click", () => {
    els.sidebar?.classList.add("open");
  });

  els.sidebarClose?.addEventListener("click", () => {
    els.sidebar?.classList.remove("open");
  });
}

function fillHeader(profile) {
  if (els.territoryNameTop) {
    els.territoryNameTop.textContent = profile.territoryLabel || "Território";
  }

  if (els.userNameTop) {
    els.userNameTop.textContent = profile.displayName || profile.name || "Usuário";
  }
}

function renderInfoList(container, items) {
  if (!container) return;

  container.innerHTML = items.map((item) => `
    <article class="info-item">
      <div class="info-copy">
        <strong>${item.title}</strong>
        <span>${item.description}</span>
      </div>
      ${item.meta ? `<span class="info-meta">${item.meta}</span>` : ""}
    </article>
  `).join("");
}

function renderTrailList(container, items) {
  if (!container) return;

  container.innerHTML = items.map((item) => `
    <article class="trail-item">
      <div class="trail-copy">
        <strong>${item.title}</strong>
        <span>${item.status}</span>
      </div>
      ${item.level ? `<span class="trail-level">${item.level}</span>` : ""}
    </article>
  `).join("");
}

function fillStaticPanels() {
  renderInfoList(els.noticesList, [
    {
      title: "Comunicado do Núcleo",
      description: "Atualização de conteúdos e trilhas nesta semana.",
      meta: "Hoje"
    },
    {
      title: "Campanha ativa no território",
      description: "Mutirão de educação ambiental | Inscrições abertas.",
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
      description: "Concentração às 8h. Leve luvas e garrafa de água.",
      meta: "Ação"
    },
    {
      title: "Mudança de horário",
      description: "Triagem das 8h às 17h (seg–sex).",
      meta: "Aviso"
    },
    {
      title: "Coleta especial aberta",
      description: "Agendamentos para grandes volumes via formulário.",
      meta: "Serviço"
    }
  ]);

  renderInfoList(els.territoryServices, [
    {
      title: "Apoio operacional",
      description: "Orientação sobre triagem, rota e organização."
    },
    {
      title: "Ponto de entrega",
      description: "Recebimento de materiais vinculados ao território."
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
      description: "Procedimentos e rotina da cooperativa."
    }
  ]);

  if (els.summaryAccepted) els.summaryAccepted.textContent = "4";
  if (els.summaryRejected) els.summaryRejected.textContent = "4";
  if (els.summaryPoints) els.summaryPoints.textContent = "3";

  if (els.indicatorColetas) els.indicatorColetas.textContent = "0";
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
        setTimeout(() => {
          territoryMap?.invalidateSize();
        }, 200);
      }
    });
  });
}

function participantIcon(type) {
  const key = String(type || "").toLowerCase();

  if (key === "condominio") return "🏢";
  if (key === "comercio") return "🏪";
  if (key === "familia") return "👨‍👩‍👧";
  if (key === "morador") return "👤";
  if (key === "lideranca") return "📣";
  if (key === "participante") return "🧩";

  return "👤";
}

function formatParticipantType(type) {
  if (!type) return "Não informado";

  const map = {
    morador: "Morador",
    familia: "Família",
    condominio: "Condomínio",
    comercio: "Comércio",
    lideranca: "Liderança",
    participante: "Participante"
  };

  return map[type] || type;
}

function computeParticipantsKpis(items) {
  const total = items.length;

  const peopleCount = items.filter((item) =>
    ["morador", "familia", "lideranca", "participante"].includes(
      String(item.participantType || "").toLowerCase()
    )
  ).length;

  const condoCount = items.filter((item) =>
    String(item.participantType || "").toLowerCase() === "condominio"
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
        Nenhum participante encontrado para este território.
      </div>
    `;
    return;
  }

  els.participantsList.innerHTML = items.map((item) => `
    <article class="participant-row">
      <div class="participant-main">
        <div class="participant-avatar">${participantIcon(item.participantType)}</div>

        <div class="participant-copy">
          <strong>${item.name || "Sem nome"}</strong>
          <span>${item.participantCode || "-"}</span>
          <span>${item.address?.street || "Endereço não informado"}${item.address?.number ? `, ${item.address.number}` : ""}</span>
        </div>
      </div>

      <div class="participant-meta">
        <span class="participant-tag">${formatParticipantType(item.participantType)}</span>
        <span class="participant-subtag">${item.localType || item.address?.neighborhood || "Território"}</span>
      </div>
    </article>
  `).join("");
}

function filterParticipants() {
  const term = String(els.participantSearchInput?.value || "").trim().toLowerCase();

  if (!term) {
    computeParticipantsKpis(allParticipants);
    renderParticipants(allParticipants);
    return;
  }

  const filtered = allParticipants.filter((item) => {
    const name = String(item.name || "").toLowerCase();
    const code = String(item.participantCode || "").toLowerCase();
    return name.includes(term) || code.includes(term);
  });

  computeParticipantsKpis(filtered);
  renderParticipants(filtered);
}

function bindParticipantsSearch() {
  els.participantSearchInput?.addEventListener("input", filterParticipants);
}

function loadParticipants(territoryId) {
  const q = query(
    collection(db, "participants"),
    where("territoryId", "==", territoryId),
    orderBy("createdAtISO", "desc")
  );

  onSnapshot(
    q,
    (snapshot) => {
      allParticipants = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));

      computeParticipantsKpis(allParticipants);
      renderParticipants(allParticipants);
      filterParticipants();
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
        id: "vp-1",
        name: "Ponto Bom Jesus",
        type: "seletiva",
        lat: -30.036111,
        lng: -51.158333,
        address: "Região Bom Jesus / Jardim Carvalho"
      },
      {
        id: "vp-2",
        name: "Escola parceira",
        type: "papel",
        lat: -30.0315,
        lng: -51.1608,
        address: "Área escolar do território"
      },
      {
        id: "vp-3",
        name: "Ponto comunitário",
        type: "plastico",
        lat: -30.0382,
        lng: -51.1548,
        address: "Centro comunitário local"
      }
    ];
  }

  if (territoryId === "crgr_cooadesc") {
    return [
      {
        id: "coo-1",
        name: "COOADESC (CRGR)",
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
        name: "Cooperilhas (CRGR)",
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
  territoryMarkers.forEach((marker) => territoryMap?.removeLayer(marker));
  territoryMarkers = [];
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
      <strong>${point.name}</strong>
      <span>${point.address || "Endereço não informado"}</span>
      <span>Tipo: ${point.type || "seletiva"} • ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</span>
    </article>
  `).join("");
}

function renderTerritoryMap(points) {
  if (typeof L === "undefined") return;
  const mapContainer = document.getElementById("territoryMap");
  if (!mapContainer) return;

  if (!territoryMap) {
    const first = points[0] || { lat: -30.0346, lng: -51.2177 };

    territoryMap = L.map("territoryMap", {
      zoomControl: true
    }).setView([first.lat, first.lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(territoryMap);
  }

  clearTerritoryMarkers();

  const bounds = [];

  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng]).addTo(territoryMap);
    marker.bindPopup(`
      <strong>${point.name}</strong><br>
      ${point.address || ""}<br>
      Tipo: ${point.type || "seletiva"}
    `);
    territoryMarkers.push(marker);
    bounds.push([point.lat, point.lng]);
  });

  if (bounds.length === 1) {
    territoryMap.setView(bounds[0], 14);
  } else if (bounds.length > 1) {
    territoryMap.fitBounds(bounds, { padding: [30, 30] });
  }

  if (els.mapPointsCount) {
    els.mapPointsCount.textContent = String(points.length);
  }

  if (els.summaryPoints) {
    els.summaryPoints.textContent = String(points.length);
  }

  renderMapPointsList(points);
}

function applyMapFilter() {
  const filter = els.mapTypeFilter?.value || "all";

  if (filter === "all") {
    renderTerritoryMap(territoryPoints);
    return;
  }

  const filtered = territoryPoints.filter((point) => point.type === filter);
  renderTerritoryMap(filtered);
}

function setupMapActions() {
  els.mapTypeFilter?.addEventListener("change", applyMapFilter);

  els.btnNearMe?.addEventListener("click", () => {
    if (!navigator.geolocation || !territoryMap) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        territoryMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
      },
      () => {
        alert("Não foi possível obter sua localização.");
      }
    );
  });
}

function initTerritoryMap(profile) {
  territoryPoints = getDefaultTerritoryPoints(profile);

  setTimeout(() => {
    renderTerritoryMap(territoryPoints);
  }, 120);
}

function boot() {
  setupSidebar();
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

      const profile = await getUserProfile(user.uid);
      validateProfile(profile);

      fillHeader(profile);
      loadParticipants(profile.territoryId);
      initTerritoryMap(profile);
    } catch (error) {
      console.error("Erro ao carregar painel da cooperativa:", error);
      alert(error.message || "Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();