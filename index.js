document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const HEADER_SCROLL_OFFSET = 96;

  const INITIAL_MAP_VIEW = {
    lat: -30.055,
    lng: -51.165,
    zoom: 11
  };

  const VALID_CRGR_IDS = [
    "vila-pinto",
    "cooadesc",
    "ccpa"
  ];

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
      territoryId: "vila-pinto",
      name: "CRGR Vila Pinto",
      territoryLabel: "CRGR Vila Pinto",
      lat: -30.048729170292532,
      lng: -51.15652604283108,
      address: "Avenida Joaquim Porto Vilanova, 143 • Bom Jesus • Porto Alegre/RS",
      page: "vila-pinto.html",
      active: true,
      color: "#62B32F"
    },
    {
      id: "cooadesc",
      code: "cooadesc",
      territoryId: "cooadesc",
      name: "CRGR Cooadesc",
      territoryLabel: "CRGR Cooadesc",
      lat: -30.003,
      lng: -51.206,
      address: "Rua Seis (Vila Esperança), 113 • Farrapos • Porto Alegre/RS",
      page: "cooadesc.html",
      active: true,
      color: "#2FA8D8"
    },
    
    {
      id: "ccpa",
      code: "ccpa",
      territoryId: "ccpa",
      name: "CRGR CCPA",
      territoryLabel: "CCPA",
      lat: -30.140122365657504,
      lng: -51.1268772051727,
      address: "Estrada do Rincão, 6781 • Restinga • Porto Alegre/RS",
      page: "ccpa.html",
      active: true,
      color: "#ef6b22"
    }
  ];

  let map = null;
  let mapMarkers = [];
  let publicIndicatorsUnsubscribe = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = String(value ?? 0);
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function safeScrollTo(target, offset = HEADER_SCROLL_OFFSET) {
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top,
      behavior: "smooth"
    });
  }

  function canonicalTerritoryId(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", "-")
      .replace(/\s+/g, "-");

    if (!raw) return "";

    if (
      raw === "vilapinto" ||
      raw === "vila-pinto" ||
      raw === "crgr-vila-pinto" ||
      raw === "crgr-vilapinto"
    ) {
      return "vila-pinto";
    }

    if (
      raw === "coadesc" ||
      raw === "cooadesc" ||
      raw === "crgr-coadesc" ||
      raw === "crgr-cooadesc"
    ) {
      return "cooadesc";
    }

    if (
      raw==="ccpa" ||
      raw === "padrecacique" ||
      raw === "padre-cacique" ||
      raw === "crgr-padre-cacique"
    ) {
      return "ccpa";
    }

    return raw;
  }

  function isValidCrgrId(value) {
    return VALID_CRGR_IDS.includes(canonicalTerritoryId(value));
  }

  function getValidCrgrs(items = []) {
    const mapByTerritory = new Map();

    items.forEach((item) => {
      const territoryId = canonicalTerritoryId(item.territoryId || item.code || item.id);

      if (!isValidCrgrId(territoryId)) return;
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return;

      if (!mapByTerritory.has(territoryId)) {
        mapByTerritory.set(territoryId, {
          ...item,
          territoryId
        });
      }
    });

    return Array.from(mapByTerritory.values());
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

      if (!rafId) {
        rafId = requestAnimationFrame(updateGlowPosition);
      }
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
          if (other !== detail) {
            other.open = false;
          }
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
        dot.classList.toggle("is-active", index === currentIndex);
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
      if (!intervalId) return;

      clearInterval(intervalId);
      intervalId = null;
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
      dot.addEventListener("click", () => {
        goTo(Number(dot.dataset.slide || 0));
        startAuto();
      });
    });

    root.addEventListener("mouseenter", stopAuto);
    root.addEventListener("mouseleave", startAuto);

    render();
    startAuto();
  }

  function getCrgrPage(name = "", id = "", territoryId = "") {
    const base = `${name} ${id} ${territoryId}`.toLowerCase();

    if (
      base.includes("vila pinto") ||
      base.includes("vilapinto") ||
      base.includes("crgr_vila_pinto") ||
      base.includes("vila-pinto")
    ) {
      return "vila-pinto.html";
    }

    if (
      base.includes("cooadesc") ||
      base.includes("coadesc") ||
      base.includes("crgr_cooadesc") ||
      base.includes("crgr_coadesc")
    ) {
      return "cooadesc.html";
    }

    if (
      base.includes("ccpa") ||
      base.includes("padre") ||
      base.includes("cacique") ||
      base.includes("crgr_padre_cacique") ||
      base.includes("padre-cacique")
    ) {
      return "ccpa.html";
    }

    return "#";
  }

  function getCrgrColor(item = {}, index = 0) {
    if (item.color) return item.color;

    const base = `${item.name || ""} ${item.id || ""} ${item.territoryId || ""}`.toLowerCase();

    if (base.includes("vila")) return "#62B32F";
    if (base.includes("cooadesc") || base.includes("coadesc")) return "#2FA8D8";
    if (base.includes("ccpa") || base.includes("ccpa")) return "#ef6b22";

    const colors = ["#62B32F", "#2FA8D8", "#ef6b22"];
    return colors[index % colors.length];
  }

  function normalizeCrgrDocs(raw = []) {
    return raw
      .map((item, index) => {
        const territoryId = canonicalTerritoryId(item.territoryId || item.code || item.id);

        const name =
          item.name ||
          item.title ||
          item.label ||
          item.territoryLabel ||
          item.cooperativaNome ||
          item.code ||
          item.id ||
          "CRGR";

        const id = item.id || item.code || territoryId || name;

        return {
          id,
          code: item.code || item.id || territoryId,
          territoryId,
          name,
          territoryLabel:
            item.territoryLabel ||
            item.name ||
            item.title ||
            item.label ||
            item.cooperativaNome ||
            item.code ||
            item.id ||
            "CRGR",
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
          page: item.page || item.link || item.slug || getCrgrPage(name, id, territoryId),
          active:
            item.active ??
            (String(item.status || "").toLowerCase() === "active"),
          color: item.color || getCrgrColor({ name, id, territoryId }, index)
        };
      })
      .filter((item) => item.id);
  }

  function renderMetrics(metrics = {}) {
    setText("metricCrgrs", metrics.crgrs || 0);
    setText("metricUsers", metrics.users || 0);
    setText("metricApprovals", metrics.approvals || 0);
    setText("metricColetas", metrics.coletas || 0);
    setText("metricAlerts", metrics.alerts || 0);
  }

  function createCrgrIcon(color = "#62B32F") {
    return window.L.divIcon({
      className: "crgr-map-marker",
      html: `
        <span
          style="
            --marker-color:${escapeHtml(color)};
            display:block;
            width:24px;
            height:24px;
            border-radius:999px;
            background:${escapeHtml(color)};
            border:4px solid #ffffff;
            box-shadow:0 8px 18px rgba(0,0,0,.28);
          "
        ></span>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -14]
    });
  }

  function createCrgrPopup(item = {}, index = 0) {
    const name = escapeHtml(item.name || item.territoryLabel || "CRGR");
    const address = escapeHtml(item.address || "Território conectado à plataforma");
    const page = item.page || getCrgrPage(item.name, item.id, item.territoryId);
    const color = escapeHtml(getCrgrColor(item, index));

    return `
      <div class="crgr-popup" style="min-width:220px; font-family:'Inter',sans-serif;">
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <span style="width:12px; height:12px; border-radius:999px; background:${color}; display:inline-block;"></span>
          <strong style="font-family:'Archivo Condensed',sans-serif; font-size:20px; line-height:1;">
            ${name}
          </strong>
        </div>

        <div style="font-size:13.5px; line-height:1.45; color:#4f5558; margin-bottom:12px;">
          ${address}
        </div>

        ${
          page && page !== "#"
            ? `
              <a
                href="${escapeHtml(page)}"
                class="small-btn solid"
                style="
                  display:inline-flex;
                  align-items:center;
                  justify-content:center;
                  min-height:36px;
                  padding:8px 12px;
                  border-radius:999px;
                  background:${color};
                  color:#ffffff;
                  text-decoration:none;
                  font-size:13px;
                  font-weight:800;
                "
              >
                Acessar cooperativa →
              </a>
            `
            : ""
        }
      </div>
    `;
  }

  function initMap() {
    const mapEl = byId("map");

    if (!mapEl || typeof window.L === "undefined") return null;

    if (!map) {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;

      map = window.L.map(mapEl, {
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: !isMobile,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false
      }).setView([INITIAL_MAP_VIEW.lat, INITIAL_MAP_VIEW.lng], INITIAL_MAP_VIEW.zoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19
      }).addTo(map);
    }

    return map;
  }

  function renderMap(crgrs = []) {
    const mapInstance = initMap();
    if (!mapInstance) return;

    mapMarkers.forEach((marker) => {
      mapInstance.removeLayer(marker);
    });

    mapMarkers = [];

    const validPoints = getValidCrgrs(crgrs);

    if (!validPoints.length) {
      mapInstance.setView([INITIAL_MAP_VIEW.lat, INITIAL_MAP_VIEW.lng], INITIAL_MAP_VIEW.zoom);
      return;
    }

    const bounds = [];

    validPoints.forEach((item, index) => {
      const marker = window.L.marker([item.lat, item.lng], {
        icon: createCrgrIcon(getCrgrColor(item, index)),
        title: item.name || item.territoryLabel || "CRGR"
      }).addTo(mapInstance);

      marker.bindPopup(createCrgrPopup(item, index), {
        closeButton: true,
        maxWidth: 280,
        className: "crgr-leaflet-popup"
      });

      mapMarkers.push(marker);
      bounds.push([item.lat, item.lng]);
    });

    if (bounds.length === 1) {
      mapInstance.setView(bounds[0], 14);
    } else {
      mapInstance.fitBounds(bounds, {
        padding: [38, 38],
        maxZoom: 13
      });
    }

    setTimeout(() => {
      mapInstance.invalidateSize();
    }, 250);
  }

  async function loadCRGRCollections() {
    try {
      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const { db } = firebaseInit;
      const { collection, getDocs, query, orderBy } = firestore;

      async function loadCollectionSafe(name) {
        try {
          const snap = await getDocs(
            query(collection(db, name), orderBy("createdAt", "desc"))
          );

          return snap.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data()
          }));
        } catch {
          try {
            const snap = await getDocs(collection(db, name));

            return snap.docs.map((docItem) => ({
              id: docItem.id,
              ...docItem.data()
            }));
          } catch (error) {
            console.warn(`[INDEX] Não foi possível ler ${name}:`, error);
            return [];
          }
        }
      }

      const [territories, cooperativas, crgrs] = await Promise.all([
        loadCollectionSafe("territories"),
        loadCollectionSafe("cooperativas"),
        loadCollectionSafe("crgrs")
      ]);

      const normalized = normalizeCrgrDocs([
        ...territories,
        ...cooperativas,
        ...crgrs
      ]);

      const validNormalized = getValidCrgrs(normalized);

      STATE.crgrs = validNormalized.length ? validNormalized : FALLBACK_CRGRS;

      renderMap(STATE.crgrs);
    } catch (error) {
      console.error("[INDEX] Erro ao carregar CRGRs:", error);

      STATE.crgrs = FALLBACK_CRGRS;
      renderMap(STATE.crgrs);
    }
  }

  async function loadPublicIndicators() {
    try {
      const firebaseInit = await import("./firebase-init.js");
      const firestore = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

      const { db } = firebaseInit;
      const { collection, getDocs, onSnapshot } = firestore;

      if (typeof publicIndicatorsUnsubscribe === "function") {
        try {
          publicIndicatorsUnsubscribe();
        } catch (_) {}

        publicIndicatorsUnsubscribe = null;
      }

      const publicCollectionRef = collection(db, "dashboard_public_by_cooperativa");

      function applyDocs(docs) {
        const summaries = docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data()
        }));

       const validSummaries = summaries.filter((item) => {
  const territoryId = canonicalTerritoryId(item.territoryId || item.id || item.code);
  const count = Number(item.crgrsCount ?? 1);

  return isValidCrgrId(territoryId) && count > 0;
});

const uniqueCrgrs = new Set(
  validSummaries.map((item) =>
    canonicalTerritoryId(item.territoryId || item.id || item.code)
  )
);

const totals = validSummaries.reduce(
  (acc, item) => {
    acc.users += Number(item.usersCount ?? item.participantsCount ?? 0);
    acc.coletas += Number(item.coletasCount ?? 0);
    acc.approvals += Number(item.approvalsCount ?? 0);
    acc.alerts += Number(item.alertsCount ?? 0);
    return acc;
  },
  {
    users: 0,
    coletas: 0,
    approvals: 0,
    alerts: 0
  }
);

const activeCrgrs = uniqueCrgrs.size || 3;

   STATE.metrics = {
  users: totals.users,
  coletas: totals.coletas,
  approvals: totals.approvals,
  crgrs: Math.min(activeCrgrs, 3),
  alerts: totals.alerts
};
        renderMetrics(STATE.metrics);
      }

      publicIndicatorsUnsubscribe = onSnapshot(
        publicCollectionRef,
        (snapshot) => {
          applyDocs(snapshot.docs);
        },
        async (snapshotError) => {
          console.warn("[INDEX] Falha no onSnapshot dos indicadores públicos:", snapshotError);

          try {
            const snap = await getDocs(publicCollectionRef);
            applyDocs(snap.docs);
          } catch (fallbackError) {
            console.error("[INDEX] Erro ao carregar indicadores públicos:", fallbackError);

            STATE.metrics = {
              users: 0,
              coletas: 0,
              approvals: 0,
              crgrs: FALLBACK_CRGRS.length,
              alerts: 0
            };

            renderMetrics(STATE.metrics);
          }
        }
      );
    } catch (error) {
      console.error("[INDEX] Erro ao carregar indicadores públicos:", error);

      renderMetrics({
        users: 0,
        coletas: 0,
        approvals: 0,
        crgrs: FALLBACK_CRGRS.length,
        alerts: 0
      });
    }
  }

  function initHashScroll() {
    if (!window.location.hash) return;

    const target = document.querySelector(window.location.hash);
    if (!target) return;

    setTimeout(() => {
      safeScrollTo(target);
    }, 100);
  }

  initCursorGlow();
  initReveal();
  initAnchorScroll();
  initFaq();
  initHeroCarousel();
  initHashScroll();

  renderMetrics(STATE.metrics);
  renderMap(FALLBACK_CRGRS);

  Promise.all([
    loadCRGRCollections(),
    loadPublicIndicators()
  ]).catch((error) => {
    console.error("[INDEX] Falha geral ao iniciar index:", error);
  });
});