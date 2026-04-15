document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const HEADER_SCROLL_OFFSET = 96;
  const MAP_SCROLL_OFFSET = 110;
  const INITIAL_MAP_VIEW = {
    lat: -30.02,
    lng: -51.18,
    zoom: 11
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const STATE = {
    crgrs: [],
    metrics: {
      crgrs: 0,
      users: 0,
      approvals: 0,
      coletas: 0,
      alerts: 0
    }
  };

  const FALLBACK_CRGRS = [
    {
      id: "vilapinto",
      code: "vilapinto",
      name: "Vila Pinto",
      territoryLabel: "Vila Pinto",
      lat: -30.048729170292532,
      lng: -51.15652604283108,
      address: "Avenida Joaquim Porto Vilanova, 143 • Bom Jesus • Porto Alegre/RS",
      page: "vila-pinto.html",
      active: true
    },
    {
      id: "cooadesc",
      code: "cooadesc",
      name: "COOADESC",
      territoryLabel: "COOADESC",
      lat: -30.003,
      lng: -51.206,
      address: "Rua Seis (Vila Esperança), 113 • Farrapos • Porto Alegre/RS",
      page: "cooadesc.html",
      active: true
    },
    {
      id: "padrecacique",
      code: "padrecacique",
      name: "Padre Cacique",
      territoryLabel: "Padre Cacique",
      lat: -30.140122365657504,
      lng: -51.1268772051727,
      address: "Estrada do Rincão, 6781 • Belém Velho • Porto Alegre/RS",
      page: "padre-cacique.html",
      active: true
    }
  ];

  let map = null;
  let mapMarkers = [];

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value ?? 0);
  }

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function safeScrollTo(target, offset = HEADER_SCROLL_OFFSET) {
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function initCursorGlow() {
    const cursorGlow = byId("cursorGlow");
    if (!cursorGlow || isReducedMotion()) return;

    let rafId = null;
    let mouseX = -9999;
    let mouseY = -9999;

    function updateGlowPosition() {
      cursorGlow.style.setProperty("--mx", String(mouseX));
      cursorGlow.style.setProperty("--my", String(mouseY));
      rafId = null;
    }

    window.addEventListener("mousemove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursorGlow.style.opacity = "1";

      if (!rafId) rafId = requestAnimationFrame(updateGlowPosition);
    });

    window.addEventListener("mouseleave", () => {
      cursorGlow.style.opacity = "0";
    });
  }

  function initReveal() {
    const revealEls = $$("[data-reveal]");
    if (!revealEls.length) return;

    if (!("IntersectionObserver" in window) || isReducedMotion()) {
      revealEls.forEach((el) => el.classList.add("in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          obs.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    revealEls.forEach((el) => observer.observe(el));
  }

  function initAnchorScroll() {
    $$('a[href^="#"]').forEach((el) => {
      el.addEventListener("click", (event) => {
        const href = el.getAttribute("href");
        if (!href || href === "#") return;

        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();
        safeScrollTo(target);
        history.replaceState(null, "", href);
      });
    });
  }

  function initFaq() {
    const items = $$("details.faq-item");
    items.forEach((detail) => {
      detail.addEventListener("toggle", () => {
        if (!detail.open) return;
        items.forEach((other) => {
          if (other !== detail) other.open = false;
        });
      });
    });
  }

  function initHeroCarousel() {
    const root = byId("heroCarousel");
    if (!root) return;

    const slides = $$(".hero-slide", root);
    const dots = $$(".carousel-dot", root);
    const prevBtn = byId("carouselPrev");
    const nextBtn = byId("carouselNext");

    if (!slides.length) return;

    let currentIndex = 0;
    let intervalId = null;
    const delay = 4500;

    function render() {
      slides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === currentIndex);
      });

      dots.forEach((dot, index) => {
        if (dot.dataset.slide !== undefined) {
          dot.classList.toggle("is-active", index === currentIndex);
          dot.setAttribute("aria-pressed", index === currentIndex ? "true" : "false");
        }
      });
    }

    function goTo(index) {
      if (index < 0) currentIndex = slides.length - 1;
      else if (index >= slides.length) currentIndex = 0;
      else currentIndex = index;
      render();
    }

    function next() {
      goTo(currentIndex + 1);
    }

    function prev() {
      goTo(currentIndex - 1);
    }

    function stopAuto() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (isReducedMotion()) return;
      intervalId = setInterval(next, delay);
    }

    prevBtn?.addEventListener("click", () => {
      prev();
      startAuto();
    });

    nextBtn?.addEventListener("click", () => {
      next();
      startAuto();
    });

    dots.forEach((dot) => {
      if (dot.dataset.slide === undefined) return;
      dot.addEventListener("click", () => {
        goTo(Number(dot.dataset.slide || 0));
        startAuto();
      });
    });

    root.addEventListener("mouseenter", stopAuto);
    root.addEventListener("mouseleave", startAuto);
    root.addEventListener("focusin", stopAuto);
    root.addEventListener("focusout", startAuto);

    render();
    startAuto();
  }

  function getCrgrPage(name = "", id = "") {
    const base = `${name} ${id}`.toLowerCase();

    if (base.includes("vila pinto") || base.includes("vilapinto")) return "vila-pinto.html";
    if (base.includes("cooadesc") || base.includes("farrapos")) return "cooadesc.html";
    if (base.includes("padre") || base.includes("cacique")) return "padre-cacique.html";

    return "#";
  }

  function normalizeCrgrDocs(raw = []) {
    return raw
      .map((item) => ({
        id: item.id || item.code || item.territoryId,
        code: item.code || item.id || item.territoryId,
        territoryId: item.territoryId || item.code || item.id,
        name:
          item.name ||
          item.title ||
          item.label ||
          item.territoryLabel ||
          item.cooperativaNome ||
          item.code ||
          item.id,
        territoryLabel:
          item.territoryLabel ||
          item.name ||
          item.title ||
          item.label ||
          item.cooperativaNome ||
          item.code ||
          item.id,
        lat: toNumberOrNull(
          item.lat ??
          item.latitude ??
          item.coords?.lat ??
          item.location?.lat
        ),
        lng: toNumberOrNull(
          item.lng ??
          item.longitude ??
          item.coords?.lng ??
          item.location?.lng
        ),
        address:
          item.address ||
          item.enderecoCompleto ||
          item.location?.address ||
          item.endereco ||
          "",
        page: item.page || item.link || item.slug || "",
        active: item.active ?? (item.status === "active")
      }))
      .filter((item) => item.id);
  }

  function renderMetrics(metrics = {}) {
    setText("metricCrgrs", metrics.crgrs || 0);
    setText("metricUsers", metrics.users || 0);
    setText("metricApprovals", metrics.approvals || 0);
    setText("metricColetas", metrics.coletas || 0);
    setText("metricAlerts", metrics.alerts || 0);
  }

  function renderSelectedCrgr(item, activatedFromMap = false) {
    const card = byId("selectedCrgrCard");
    if (!card || !item) return;

    const page = item.page || getCrgrPage(item.name, item.id);
    const hasCoords = Number.isFinite(item.lat) && Number.isFinite(item.lng);

    card.classList.toggle("is-active", activatedFromMap);

    card.innerHTML = `
      <div class="panel-card-text">
        <div class="panel-card-title">${item.name || item.territoryLabel || "CRGR"}</div>
        <div class="panel-card-subtitle">
          ${item.address || "Território conectado à plataforma"}
        </div>
        <div class="panel-card-meta">
          ${
            hasCoords
              ? `Lat/Lng: ${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}`
              : "Sem coordenadas cadastradas"
          }
        </div>
      </div>

      <div class="panel-card-actions">
        ${page !== "#" ? `<a href="${page}" class="small-btn solid">Acessar cooperativa</a>` : ""}
      </div>
    `;
  }

  function renderCrgrList(crgrs = []) {
    const card = byId("selectedCrgrCard");
    if (!card) return;

    if (!crgrs.length) {
      card.innerHTML = `
        <div class="panel-card-text">
          <div class="panel-card-title">Nenhum CRGR encontrado</div>
          <div class="panel-card-subtitle">
            Cadastre os territórios/CRGRs no Firebase para listar aqui.
          </div>
          <div class="panel-card-meta">
            Quando houver CRGRs com coordenadas, eles aparecerão no mapa.
          </div>
        </div>
        <div class="panel-card-actions"></div>
      `;
      return;
    }

    const firstWithCoords =
      crgrs.find((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)) || crgrs[0];

    renderSelectedCrgr(firstWithCoords, false);
  }

  function initMap() {
    const mapEl = byId("map");
    if (!mapEl || typeof window.L === "undefined") return null;

    if (!map) {
      map = window.L.map(mapEl, {
        zoomControl: true,
        scrollWheelZoom: false
      }).setView([INITIAL_MAP_VIEW.lat, INITIAL_MAP_VIEW.lng], INITIAL_MAP_VIEW.zoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);
    }

    return map;
  }

  function renderMap(crgrs = []) {
    const mapInstance = initMap();
    if (!mapInstance) return;

    mapMarkers.forEach((marker) => mapInstance.removeLayer(marker));
    mapMarkers = [];

    const validPoints = crgrs.filter(
      (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)
    );

    if (!validPoints.length) return;

    const bounds = [];

    validPoints.forEach((item, index) => {
      const marker = window.L.marker([item.lat, item.lng]).addTo(mapInstance);

      marker.bindPopup(`
        <div style="font-family:'Archivo Condensed',sans-serif;">
          <strong>${item.name || item.territoryLabel || "CRGR"}</strong><br>
          ${item.address || "Território conectado à plataforma"}
        </div>
      `);

      marker.on("click", () => {
        renderSelectedCrgr(item, true);
      });

      if (index === 0) {
        renderSelectedCrgr(item, false);
      }

      mapMarkers.push(marker);
      bounds.push([item.lat, item.lng]);
    });

    mapInstance.fitBounds(bounds, { padding: [30, 30] });

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 200);
  }

  function initMapOpenButton() {
    const mapEl = byId("map");
    const button = document.querySelector("[data-open-map]");
    if (!button || !mapEl) return;

    button.addEventListener("click", () => {
      safeScrollTo(mapEl, MAP_SCROLL_OFFSET);
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 220);
    });
  }

  function countActivePlans(items = []) {
    return items.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return item.active === true || status === "active" || status === "em_andamento";
    }).length;
  }

  function countActiveCrgrs(items = []) {
    return items.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return item.active === true || status === "active";
    }).length;
  }

  function countActiveAlerts(items = []) {
    return items.filter((item) => item.active !== false).length;
  }

  async function loadIndexPublicData() {
    try {
      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const { db } = firebaseInit;
      const { collection, getDocs } = firestore;

      async function readCollectionSafe(name) {
        try {
          const snap = await getDocs(collection(db, name));
          return snap.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data()
          }));
        } catch (error) {
          console.warn(`Erro ao ler coleção ${name}:`, error);
          return [];
        }
      }

      const [
        users,
        coletas,
        approvalRequests,
        territories,
        cooperativas,
        crgrsDocs,
        alerts
      ] = await Promise.all([
        readCollectionSafe("users"),
        readCollectionSafe("coletas"),
        readCollectionSafe("approvalRequests"),
        readCollectionSafe("territories"),
        readCollectionSafe("cooperativas"),
        readCollectionSafe("crgrs"),
        readCollectionSafe("alerts")
      ]);

      const rawCrgrs = [...territories, ...cooperativas, ...crgrsDocs];
      const normalized = normalizeCrgrDocs(rawCrgrs);

      STATE.crgrs = normalized.length ? normalized : FALLBACK_CRGRS;

      STATE.metrics = {
        users: users.length,
        coletas: coletas.length,
        approvals: countActivePlans(approvalRequests),
        crgrs: normalized.length ? countActiveCrgrs(normalized) || normalized.length : FALLBACK_CRGRS.length,
        alerts: countActiveAlerts(alerts)
      };

      renderMetrics(STATE.metrics);
      renderCrgrList(STATE.crgrs);
      renderMap(STATE.crgrs);
    } catch (error) {
      console.error("Falha ao carregar dados públicos da index:", error);

      STATE.crgrs = FALLBACK_CRGRS;
      STATE.metrics = {
        users: 0,
        coletas: 0,
        approvals: 0,
        crgrs: FALLBACK_CRGRS.length,
        alerts: 0
      };

      renderMetrics(STATE.metrics);
      renderCrgrList(STATE.crgrs);
      renderMap(STATE.crgrs);
    }
  }

  function initHashScroll() {
    if (window.location.hash) {
      const target = document.querySelector(window.location.hash);
      if (target) {
        setTimeout(() => safeScrollTo(target), 100);
      }
    }
  }

  initCursorGlow();
  initReveal();
  initAnchorScroll();
  initFaq();
  initHeroCarousel();
  initMapOpenButton();
  initHashScroll();

  renderMetrics(STATE.metrics);
  renderCrgrList(FALLBACK_CRGRS);
  renderMap(FALLBACK_CRGRS);

  loadIndexPublicData();
});