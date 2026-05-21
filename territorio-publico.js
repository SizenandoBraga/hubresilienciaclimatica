document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const bodyData = document.body.dataset || {};

  const TERRITORY_DATA = {
    territoryId: bodyData.territoryId || "",
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

    if (v === "cooadesc" || v === "coadesc") {
      return ["cooadesc", "coadesc", "crgr-cooadesc"];
    }

    if (v === "padre-cacique") {
      return ["padre-cacique", "crgr-padre-cacique"];
    }

    return [v];
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
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

  function renderStats(stats) {
    setText("cooperadosValue", formatNumber(stats.cooperados));
    setText("coletasValue", formatNumber(stats.coletas));
    setText("volumeValue", formatTon(stats.volume));
    setText("pontosValue", formatNumber(stats.pontos));
  }

  async function tryGetDashboardDoc(db, firestore, docId) {
    const { doc, getDoc } = firestore;
    return await getDoc(doc(db, "dashboard_public_by_cooperativa", docId));
  }

  async function loadPublicTerritoryStats() {
    try {
      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import(
        "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"
      );

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

      renderStats({
        cooperados: Number(
          data.totalPublicoPessoas ??
          data.usersCount ??
          data.participantsCount ??
          TERRITORY_DATA.stats.cooperados ??
          0
        ),
        coletas: Number(
          data.coletasCount ??
          TERRITORY_DATA.stats.coletas ??
          0
        ),
        volume: Number(
          data.residuosCount ??
          data.volumeCount ??
          TERRITORY_DATA.stats.volume ??
          0
        ),
        pontos: Number(
          data.pontosCount ??
          TERRITORY_DATA.stats.pontos ??
          0
        )
      });
    } catch (error) {
      console.error("[TERRITÓRIO] erro:", error);
      renderStats(TERRITORY_DATA.stats);
    }
  }

  function initHeroCarousel() {
    const slides = document.querySelectorAll(".hero-carousel-slide");
    const prevBtn = document.getElementById("heroPrev");
    const nextBtn = document.getElementById("heroNext");

    if (!slides.length) return;

    let current = 0;
    let timer = null;
    const delay = 5000;

    function render(index) {
      slides.forEach((slide, i) => {
        slide.classList.toggle("is-active", i === index);
      });
    }

    function next() {
      current = (current + 1) % slides.length;
      render(current);
    }

    function prev() {
      current = (current - 1 + slides.length) % slides.length;
      render(current);
    }

    function restartTimer() {
      if (timer) clearInterval(timer);
      timer = setInterval(next, delay);
    }

    nextBtn?.addEventListener("click", () => {
      next();
      restartTimer();
    });

    prevBtn?.addEventListener("click", () => {
      prev();
      restartTimer();
    });

    render(current);
    restartTimer();
  }

  function init() {
    renderStats(TERRITORY_DATA.stats);
    loadPublicTerritoryStats();
    initHeroCarousel();
  }

  init();
});