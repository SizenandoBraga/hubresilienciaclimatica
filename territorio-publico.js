document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const bodyData = document.body.dataset || {};

  const TERRITORY_DATA = {
    territoryId: bodyData.territoryId || "",
    title: bodyData.title || "Território",
    lead: bodyData.lead || "",
    participantUrl: bodyData.participantUrl || "#",
    dashboardUrl: bodyData.dashboardUrl || "#",
    coopUrl: bodyData.coopUrl || "#",
    usersUrl: bodyData.usersUrl || "#",

    stats: {
      cooperados: Number(bodyData.cooperados || 0),
      coletas: Number(bodyData.coletas || 0),
      volume: Number(bodyData.volume || 0),
      pontos: Number(bodyData.pontos || 0)
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
      return ["vila-pinto", "crgr-vila-pinto", "crgr_vila_pinto"];
    }

    if (v === "cooadesc" || v === "coadesc" || v === "crgr-cooadesc" || v === "crgr-coadesc") {
      return ["cooadesc", "coadesc", "crgr-cooadesc", "crgr-coadesc", "crgr_cooadesc", "crgr_coadesc"];
    }

    if (v === "padre-cacique" || v === "crgr-padre-cacique") {
      return ["padre-cacique", "crgr-padre-cacique", "crgr_padre_cacique"];
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

  function renderStats(stats) {
    setText("cooperadosValue", formatNumber(stats.cooperados));
    setText("coletasValue", formatNumber(stats.coletas));
    setText("volumeValue", formatTon(stats.volume));
    setText("pontosValue", formatNumber(stats.pontos));
  }

  function fillStaticContent() {
    const title = document.getElementById("territoryHeroTitle");
    const lead = document.getElementById("territoryHeroLead");

    if (title) title.textContent = TERRITORY_DATA.title;
    if (lead) lead.textContent = TERRITORY_DATA.lead;

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

  async function tryGetDashboardDoc(db, firestore, docId) {
    const { doc, getDoc } = firestore;
    return await getDoc(doc(db, "dashboard_public_by_cooperativa", docId));
  }

  async function loadPublicTerritoryStats() {
    try {
      if (!TERRITORY_DATA.territoryId) {
        renderStats(TERRITORY_DATA.stats);
        return;
      }

      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const { db } = firebaseInit;
      const aliases = territoryAliases(TERRITORY_DATA.territoryId);

      let foundSnap = null;

      for (const alias of aliases) {
        const snap = await tryGetDashboardDoc(db, firestore, alias);
        if (snap.exists()) {
          foundSnap = snap;
          break;
        }
      }

      if (!foundSnap) {
        renderStats(TERRITORY_DATA.stats);
        return;
      }

      const data = foundSnap.data();

      const cooperados = Number(
        data.totalPublicoPessoas ??
        data.usersCount ??
        data.participantsCount ??
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
      console.error("[TERRITÓRIO] erro ao carregar indicadores:", error);
      renderStats(TERRITORY_DATA.stats);
    }
  }

  function initTerritorySlider() {
    const slides = document.querySelectorAll(".territory-slide");
    const dots = document.querySelectorAll(".territory-dot");
    const prevBtn = document.querySelector(".territory-slider-btn.prev");
    const nextBtn = document.querySelector(".territory-slider-btn.next");

    if (!slides.length) return;

    let current = 0;
    let intervalId = null;
    const delay = 7000;

    function render(index) {
      slides.forEach((slide, i) => {
        slide.classList.toggle("is-active", i === index);
      });

      dots.forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
      });
    }

    function next() {
      current = current + 1 >= slides.length ? 0 : current + 1;
      render(current);
    }

    function prev() {
      current = current - 1 < 0 ? slides.length - 1 : current - 1;
      render(current);
    }

    function stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function start() {
      stop();
      intervalId = setInterval(next, delay);
    }

    nextBtn?.addEventListener("click", () => {
      next();
      start();
    });

    prevBtn?.addEventListener("click", () => {
      prev();
      start();
    });

    dots.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        current = index;
        render(current);
        start();
      });
    });

    render(current);
    start();
  }

  function initMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl || typeof window.L === "undefined") return;

    const centerLat = Number(bodyData.mapCenterLat || -30.0487);
    const centerLng = Number(bodyData.mapCenterLng || -51.1565);
    const zoom = Number(bodyData.mapZoom || 15);
    const markerLat = Number(bodyData.markerLat || centerLat);
    const markerLng = Number(bodyData.markerLng || centerLng);
    const popup = bodyData.markerPopup || TERRITORY_DATA.title;

    const map = window.L.map(mapEl, {
      scrollWheelZoom: false,
      dragging: !window.matchMedia("(max-width: 768px)").matches,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false
    }).setView([centerLat, centerLng], zoom);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    window.L.marker([markerLat, markerLng])
      .addTo(map)
      .bindPopup(popup);

    setTimeout(() => map.invalidateSize(), 200);
  }

  function init() {
    fillStaticContent();
    renderStats(TERRITORY_DATA.stats);
    initTerritorySlider();
    loadPublicTerritoryStats();
    initMap();
  }

  init();
});