document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const bodyData = document.body.dataset || {};

  const TERRITORY_DATA = {
    territoryId: bodyData.territoryId || "crgr_vila_pinto",
    title: bodyData.title || "Território",
    lead:
      bodyData.lead ||
      "Página territorial com visão integrada da operação local, indicadores, cooperativa vinculada, mapa de referência e acessos rápidos para as rotinas do território.",
    label: bodyData.label || "Território",
    region: bodyData.region || "Porto Alegre / RS",
    profile: bodyData.profile || "Operação comunitária e cooperativa",
    focus: bodyData.focus || "Coleta seletiva, triagem e fortalecimento territorial",
    coopName: bodyData.coopName || "Cooperativa",
    coopDescription:
      bodyData.coopDescription ||
      "Núcleo territorial com atuação na triagem, articulação comunitária e fortalecimento da cadeia local de reciclagem.",
    participantUrl: bodyData.participantUrl || "cadastro-participantes-vila-pinto.html",
    dashboardUrl: bodyData.dashboardUrl || "dashboard-cooperativa.html",
    coopUrl: bodyData.coopUrl || "cooperativa.html",
    usersUrl: bodyData.usersUrl || "usuarios.html",
    stats: {
      cooperados: Number(bodyData.cooperados || 0),
      coletas: Number(bodyData.coletas || 0),
      volume: Number(bodyData.volume || 0),
      pontos: Number(bodyData.pontos || 0)
    },
    map: {
      center: [
        Number(bodyData.mapCenterLat || -30.03),
        Number(bodyData.mapCenterLng || -51.18)
      ],
      zoom: Number(bodyData.mapZoom || 14),
      marker: {
        lat: Number(bodyData.markerLat || -30.03),
        lng: Number(bodyData.markerLng || -51.18),
        popup:
          bodyData.markerPopup ||
          `
            <div style="font-family:'Archivo Condensed',sans-serif;">
              <strong>${bodyData.title || "Território"}</strong><br>
              ${bodyData.label || "Território"}<br>
              Porto Alegre • RS
            </div>
          `
      }
    }
  };

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("pt-BR");
  }

  function formatTon(value) {
    return `${Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })} t`;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function fillStaticContent() {
    const mapText = {
      territoryHeroTitle: TERRITORY_DATA.title,
      territoryHeroLead: TERRITORY_DATA.lead,
      territoryLabelText: TERRITORY_DATA.label,
      territoryRegionText: TERRITORY_DATA.region,
      territoryProfileText: TERRITORY_DATA.profile,
      territoryFocusText: TERRITORY_DATA.focus,
      coopNameText: TERRITORY_DATA.coopName,
      coopDescriptionText: TERRITORY_DATA.coopDescription
    };

    Object.entries(mapText).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    document.querySelectorAll("[data-participant-link]").forEach((el) => {
      el.setAttribute("href", TERRITORY_DATA.participantUrl);
    });

    document.querySelectorAll("[data-dashboard-link]").forEach((el) => {
      el.setAttribute("href", TERRITORY_DATA.dashboardUrl);
    });

    document.querySelectorAll("[data-coop-link]").forEach((el) => {
      el.setAttribute("href", TERRITORY_DATA.coopUrl);
    });

    document.querySelectorAll("[data-users-link]").forEach((el) => {
      el.setAttribute("href", TERRITORY_DATA.usersUrl);
    });
  }

  function renderStats(stats) {
    setText("cooperadosValue", formatNumber(stats.cooperados));
    setText("coletasValue", formatNumber(stats.coletas));
    setText("volumeValue", formatTon(stats.volume));
    setText("pontosValue", formatNumber(stats.pontos));
  }

  async function loadPublicTerritoryStats() {
    try {
      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const { db } = firebaseInit;
      const { doc, getDoc } = firestore;

      console.log("[TERRITÓRIO] lendo doc:", TERRITORY_DATA.territoryId);

      const snap = await getDoc(
        doc(db, "dashboard_public_by_cooperativa", TERRITORY_DATA.territoryId)
      );

      if (!snap.exists()) {
        console.warn("[TERRITÓRIO] doc não existe, usando fallback do HTML");
        renderStats(TERRITORY_DATA.stats);
        return;
      }

      const data = snap.data();
      console.log("[TERRITÓRIO] doc carregado:", data);

      const cooperados = Number(data.cooperativaMembersCount ?? data.usersCount ?? TERRITORY_DATA.stats.cooperados ?? 0);
      const coletas = Number(data.coletasCount ?? TERRITORY_DATA.stats.coletas ?? 0);
      const volume = Number(data.residuosCount ?? TERRITORY_DATA.stats.volume ?? 0);
      const pontos = Number(data.pontosCount ?? data.crgrsCount ?? TERRITORY_DATA.stats.pontos ?? 0);

      renderStats({
        cooperados,
        coletas,
        volume,
        pontos
      });
    } catch (error) {
      console.error("[TERRITÓRIO] erro ao carregar firestore:", error);
      renderStats(TERRITORY_DATA.stats);
    }
  }

  function initMobileMenu() {
    const menuToggle = $("#menuToggle");
    const mobileMenu = $("#mobileMenu");

    if (!menuToggle || !mobileMenu) return;

    const closeMenu = () => {
      mobileMenu.classList.remove("show");
      menuToggle.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
      mobileMenu.classList.add("show");
      menuToggle.setAttribute("aria-expanded", "true");
    };

    menuToggle.addEventListener("click", () => {
      const isOpen = mobileMenu.classList.contains("show");
      isOpen ? closeMenu() : openMenu();
    });

    $$("a", mobileMenu).forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) closeMenu();
    });
  }

  function initMap() {
    const mapEl = document.getElementById("map");

    if (!mapEl) {
      console.warn("Elemento #map não encontrado.");
      return;
    }

    if (typeof window.L === "undefined") {
      console.error("Leaflet não foi carregado.");
      return;
    }

    const map = window.L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView(TERRITORY_DATA.map.center, TERRITORY_DATA.map.zoom);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const marker = window.L.marker([
      TERRITORY_DATA.map.marker.lat,
      TERRITORY_DATA.map.marker.lng
    ]).addTo(map);

    marker.bindPopup(TERRITORY_DATA.map.marker.popup);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    window.addEventListener("resize", () => {
      setTimeout(() => map.invalidateSize(), 150);
    });
  }

  fillStaticContent();
  renderStats(TERRITORY_DATA.stats);
  loadPublicTerritoryStats();
  initMobileMenu();
  initMap();
});