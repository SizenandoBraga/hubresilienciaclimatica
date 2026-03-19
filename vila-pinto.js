document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const TERRITORY_DATA = {
    title: "Vila Pinto",
    lead:
      "Página territorial com visão integrada da operação local, indicadores, cooperativa vinculada, mapa de referência e acessos rápidos para as rotinas do território.",
    label: "Centro de Triagem Vila Pinto",
    region: "Porto Alegre / RS",
    profile: "Operação comunitária e cooperativa",
    focus: "Coleta seletiva, triagem e fortalecimento territorial",
    coopName: "UT Vila Pinto",
    coopDescription:
      "Núcleo territorial com atuação na triagem, articulação comunitária e fortalecimento da cadeia local de reciclagem.",
    stats: {
      cooperados: 24,
      coletas: 148,
      volume: 18.7,
      pontos: 12
    },
    map: {
      center: [-30.036111, -51.158333],
      zoom: 14,
      marker: {
        lat: -30.036111,
        lng: -51.158333,
        popup: `
          <div style="font-family:'Archivo Condensed',sans-serif;">
            <strong>Vila Pinto</strong><br>
            Centro de Triagem Vila Pinto<br>
            Bom Jesus / Jardim Carvalho<br>
            Porto Alegre • RS
          </div>
        `
      }
    }
  };

  function formatNumber(value) {
    return Number(value).toLocaleString("pt-BR");
  }

  function formatTon(value) {
    return `${Number(value).toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })} t`;
  }

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  }

  function animateValue(el, finalValue, formatter = (v) => String(v), duration = 1200) {
    if (!el) return;

    if (isReducedMotion()) {
      el.textContent = formatter(finalValue);
      return;
    }

    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = finalValue * eased;
      el.textContent = formatter(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatter(finalValue);
      }
    }

    requestAnimationFrame(frame);
  }

  function initStats() {
    const cooperadosEl = $("#cooperadosValue");
    const coletasEl = $("#coletasValue");
    const volumeEl = $("#volumeValue");
    const pontosEl = $("#pontosValue");

    const startAnimation = () => {
      animateValue(cooperadosEl, TERRITORY_DATA.stats.cooperados, (v) => formatNumber(Math.round(v)));
      animateValue(coletasEl, TERRITORY_DATA.stats.coletas, (v) => formatNumber(Math.round(v)));
      animateValue(volumeEl, TERRITORY_DATA.stats.volume, (v) => formatTon(v));
      animateValue(pontosEl, TERRITORY_DATA.stats.pontos, (v) => formatNumber(Math.round(v)));
    };

    if ("IntersectionObserver" in window) {
      const statsSection = $(".stats-section");
      if (!statsSection) return startAnimation();

      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            startAnimation();
            obs.disconnect();
          });
        },
        { threshold: 0.35 }
      );

      observer.observe(statsSection);
    } else {
      startAnimation();
    }
  }

  function initReveal() {
    const revealEls = $$("[data-reveal]");
    if (!revealEls.length) return;

    if ("IntersectionObserver" in window && !isReducedMotion()) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          });
        },
        {
          threshold: 0.15,
          rootMargin: "0px 0px -8% 0px"
        }
      );

      revealEls.forEach((el) => observer.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("is-visible"));
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
    const mapEl = $("#map");
    if (!mapEl || typeof L === "undefined") return;

    const map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView(TERRITORY_DATA.map.center, TERRITORY_DATA.map.zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const marker = L.marker([
      TERRITORY_DATA.map.marker.lat,
      TERRITORY_DATA.map.marker.lng
    ]).addTo(map);

    marker.bindPopup(TERRITORY_DATA.map.marker.popup);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);
  }

  function initCursorGlow() {
    const orb1 = $(".orb-1");
    const orb2 = $(".orb-2");
    if (isReducedMotion() || !orb1 || !orb2) return;

    let raf = null;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    function render() {
      orb1.style.transform = `translate(${x * 0.02}px, ${y * 0.015}px)`;
      orb2.style.transform = `translate(${x * -0.015}px, ${y * -0.012}px)`;
      raf = null;
    }

    window.addEventListener("mousemove", (event) => {
      x = event.clientX;
      y = event.clientY;

      if (!raf) raf = requestAnimationFrame(render);
    });
  }

  fillStaticContent();
  initStats();
  initReveal();
  initMobileMenu();
  initMap();
  initCursorGlow();
});