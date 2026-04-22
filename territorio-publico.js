document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const bodyData = document.body.dataset || {};

  const TERRITORY_DATA = {
    territoryId: bodyData.territoryId || "",
    title: bodyData.title || "Território",
    lead: bodyData.lead || "",
    label: bodyData.label || "Território",
    region: bodyData.region || "Porto Alegre / RS",
    profile: bodyData.profile || "",
    focus: bodyData.focus || "",
    coopName: bodyData.coopName || "Cooperativa",
    coopDescription: bodyData.coopDescription || "",
    participantUrl: bodyData.participantUrl || "#",
    dashboardUrl: bodyData.dashboardUrl || "#",
    coopUrl: bodyData.coopUrl || "#",
    usersUrl: bodyData.usersUrl || "#",

    stats: {
      cooperados: Number(bodyData.cooperados || 0),
      coletas: Number(bodyData.coletas || 0),
      volume: Number(bodyData.volume || 0),
      pontos: Number(bodyData.pontos || 0)
    },

    map: {
      center: [
        Number(bodyData.mapCenterLat || -30.0487),
        Number(bodyData.mapCenterLng || -51.1565)
      ],
      zoom: Number(bodyData.mapZoom || 15),
      marker: {
        lat: Number(bodyData.markerLat || -30.0487),
        lng: Number(bodyData.markerLng || -51.1565),
        popup: bodyData.markerPopup || "Território"
      }
    }
  };

  function normalizeTerritory(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
  }

  function territoryAliases(value) {
    const v = normalizeTerritory(value);

    if (v === "vila-pinto" || v === "crgr-vila-pinto") {
      return ["vila-pinto", "crgr-vila-pinto"];
    }

    if (v === "cooadesc" || v === "cooadesc" || v === "crgr-cooadesc" || v === "crgr-cooadesc") {
      return ["cooadesc", "cooadesc", "crgr-cooadesc", "crgr-cooadesc"];
    }

    if (v === "padre-cacique" || v === "crgr-padre-cacique") {
      return ["padre-cacique", "crgr-padre-cacique"];
    }

    return v ? [v] : [];
  }

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
      el.href = TERRITORY_DATA.participantUrl;
    });

    document.querySelectorAll("[data-dashboard-link]").forEach((el) => {
      el.href = TERRITORY_DATA.dashboardUrl;
    });

    document.querySelectorAll("[data-coop-link]").forEach((el) => {
      el.href = TERRITORY_DATA.coopUrl;
    });

    document.querySelectorAll("[data-users-link]").forEach((el) => {
      el.href = TERRITORY_DATA.usersUrl;
    });
  }

  function renderStats(stats) {
    setText("cooperadosValue", formatNumber(stats.cooperados));
    setText("coletasValue", formatNumber(stats.coletas));
    setText("volumeValue", formatTon(stats.volume));
    setText("pontosValue", formatNumber(stats.pontos));
  }

  async function tryGetDashboardDoc(db, firestore, docId) {
    const { doc, getDoc } = firestore;
    const snap = await getDoc(doc(db, "dashboard_public_by_cooperativa", docId));
    return snap;
  }

  async function loadPublicTerritoryStats() {
    try {
      if (!TERRITORY_DATA.territoryId) {
        console.error("[TERRITÓRIO] territoryId não definido no HTML.");
        renderStats({
          cooperados: 0,
          coletas: 0,
          volume: 0,
          pontos: 0
        });
        return;
      }

      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const { db } = firebaseInit;
      const aliases = territoryAliases(TERRITORY_DATA.territoryId);

      console.log("[TERRITÓRIO] territoryId da página:", TERRITORY_DATA.territoryId);
      console.log("[TERRITÓRIO] aliases aceitos:", aliases);

      let foundSnap = null;
      let foundId = null;

      for (const alias of aliases) {
        const snap = await tryGetDashboardDoc(db, firestore, alias);
        if (snap.exists()) {
          foundSnap = snap;
          foundId = alias;
          break;
        }
      }

      if (!foundSnap) {
        console.warn("[TERRITÓRIO] nenhum dashboard encontrado para:", aliases);
        renderStats({
          cooperados: 0,
          coletas: 0,
          volume: 0,
          pontos: 0
        });
        return;
      }

      const data = foundSnap.data();
      console.log("[TERRITÓRIO] doc carregado:", foundId, data);

      const cooperados = Number(
        data.totalPublicoPessoas ??
        ((Number(data.cooperativaMembersCount || 0) + Number(data.participantsCount || 0)) || 0) ??
        data.usersCount ??
        TERRITORY_DATA.stats.cooperados ??
        0
      );

      const coletas = Number(
        data.coletasCount ??
        TERRITORY_DATA.stats.coletas ??
        0
      );

      const volume = Number(
        data.residuosCount ??
        data.volumeCount ??
        TERRITORY_DATA.stats.volume ??
        0
      );

      const pontos = Number(
        data.pontosCount ??
        data.crgrsCount ??
        TERRITORY_DATA.stats.pontos ??
        0
      );

      renderStats({
        cooperados,
        coletas,
        volume,
        pontos
      });

    } catch (error) {
      console.error("[TERRITÓRIO] erro:", error);
      renderStats({
        cooperados: 0,
        coletas: 0,
        volume: 0,
        pontos: 0
      });
    }
  }

  function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl || typeof window.L === "undefined") return;

    const map = window.L.map(mapEl).setView(
      TERRITORY_DATA.map.center,
      TERRITORY_DATA.map.zoom
    );

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const marker = window.L.marker([
      TERRITORY_DATA.map.marker.lat,
      TERRITORY_DATA.map.marker.lng
    ]).addTo(map);

    marker.bindPopup(TERRITORY_DATA.map.marker.popup);

    setTimeout(() => map.invalidateSize(), 200);
  }

  function init() {
    fillStaticContent();
    renderStats(TERRITORY_DATA.stats);
    loadPublicTerritoryStats();
    initMap();
  }

  init();
});