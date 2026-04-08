document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // CONFIGURAÇÕES GERAIS
  // ==========================================
  const LOGIN_URL = "login.html";

  // Pontos que serão exibidos no mapa
  const CRGR_POINTS = {
    cooadesc: {
      name: "COOADESC",
      lat: -30.003,
      lng: -51.206,
      zoom: 15,
      popup: `
        <div style="font-family:'Archivo Condensed',sans-serif;">
          <strong>COOADESC</strong><br>
          Rua Seis (Vila Esperança), 113<br>
          Farrapos • Porto Alegre/RS
        </div>
      `
    },
    vilapinto: {
      name: "Vila Pinto",
      lat: -30.048729170292532,
      lng: -51.15652604283108,
      zoom: 16,
      popup: `
        <div style="font-family:'Archivo Condensed',sans-serif;">
          <strong>Vila Pinto</strong><br>
          Região da Bom Jesus / Jardim Carvalho<br>
          Porto Alegre/RS
        </div>
      `
    }
       padrecacique: {
      name: "Padre Cacique",
      lat: -30.140122365657504,
      lng:  -51.1268772051727,
      zoom: 16,
      popup: `
        <div style="font-family:'Archivo Condensed',sans-serif;">
          <strong>Vila Pinto</strong><br>
          Região da Belém Novo<br>
          Porto Alegre/RS
        </div>
      `
    }
  };

  // Funções utilitárias para buscar elementos
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  // Scroll suave com compensação para header fixo
  function safeScrollTo(target, offset = 96) {
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  // Detecta se o usuário prefere menos animações
  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Atualiza ano automaticamente no rodapé
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // ==========================================
  // BOTÕES DE ENTRADA / LOGIN
  // ==========================================
  const btnEntrar = $("#btnEntrar");
  const btnEntrarHero = $("#btnEntrarHero");

  [btnEntrar, btnEntrarHero].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      window.location.href = LOGIN_URL;
    });
  });

  // ==========================================
  // MENU MOBILE
  // ==========================================
  const menuBtn = $("#menuBtn");
  const mainNav = $("#mainNav");

  function closeMobileMenu() {
    if (!menuBtn || !mainNav) return;
    menuBtn.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("open");
  }

  function openMobileMenu() {
    if (!menuBtn || !mainNav) return;
    menuBtn.setAttribute("aria-expanded", "true");
    mainNav.classList.add("open");
  }

  if (menuBtn && mainNav) {
    menuBtn.addEventListener("click", () => {
      const expanded = menuBtn.getAttribute("aria-expanded") === "true";
      expanded ? closeMobileMenu() : openMobileMenu();
    });

    // Fecha menu ao clicar em um link no mobile
    $$("a", mainNav).forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= 860) closeMobileMenu();
      });
    });

    // Se voltar para desktop, fecha o menu mobile
    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) closeMobileMenu();
    });
  }

  // ==========================================
  // EFEITO DE GLOW DO CURSOR
  // ==========================================
  const cursorGlow = $("#cursorGlow");

  if (cursorGlow && !isReducedMotion()) {
    let rafId = null;
    let mouseX = -9999;
    let mouseY = -9999;

    const updateGlow = () => {
      cursorGlow.style.setProperty("--mx", mouseX);
      cursorGlow.style.setProperty("--my", mouseY);
      rafId = null;
    };

    window.addEventListener("mousemove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursorGlow.style.opacity = "1";

      if (!rafId) rafId = requestAnimationFrame(updateGlow);
    });

    window.addEventListener("mouseleave", () => {
      cursorGlow.style.opacity = "0";
    });

    window.addEventListener("blur", () => {
      cursorGlow.style.opacity = "0";
    });
  }

  // ==========================================
  // REVEAL DAS SEÇÕES AO ENTRAR NA TELA
  // ==========================================
  const revealEls = $$("[data-reveal]");

  if (revealEls.length) {
    if ("IntersectionObserver" in window && !isReducedMotion()) {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          });
        },
        {
          threshold: 0.12,
          rootMargin: "0px 0px -8% 0px"
        }
      );

      revealEls.forEach((el) => revealObserver.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add("in"));
    }
  }

  // ==========================================
  // CONTADOR ANIMADO DOS INDICADORES
  // ==========================================
  const countEls = $$(".kcount");

  function animateCount(el) {
    const target = Number(el.dataset.count || 0);
    const duration = 1400;

    if (!Number.isFinite(target)) {
      el.textContent = "0";
      return;
    }

    if (isReducedMotion()) {
      el.textContent = target.toLocaleString("pt-BR");
      return;
    }

    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      el.textContent = current.toLocaleString("pt-BR");

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = target.toLocaleString("pt-BR");
      }
    }

    requestAnimationFrame(frame);
  }

  if (countEls.length) {
    if ("IntersectionObserver" in window) {
      const countObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCount(entry.target);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.45 }
      );

      countEls.forEach((el) => countObserver.observe(el));
    } else {
      countEls.forEach((el) => animateCount(el));
    }
  }

  // ==========================================
  // FAQ - APENAS UM ITEM ABERTO POR VEZ
  // ==========================================
  $$("details.faq-item, details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;
      $$("details.faq-item, details").forEach((other) => {
        if (other !== detail) other.open = false;
      });
    });
  });

  // ==========================================
  // LINKS INTERNOS COM SCROLL SUAVE
  // ==========================================
  $$('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      const target = document.querySelector(href);
      if (!target) return;

      event.preventDefault();
      safeScrollTo(target);
      history.replaceState(null, "", href);
    });
  });

  // ==========================================
  // MAPA LEAFLET
  // ==========================================
  const mapEl = $("#map");
  let map = null;
  const markers = {};

  function initMap() {
    if (!mapEl || map || typeof L === "undefined") return map;

    map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([-30.02, -51.18], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    Object.entries(CRGR_POINTS).forEach(([key, point]) => {
      const marker = L.marker([point.lat, point.lng]).addTo(map);
      marker.bindPopup(point.popup);
      markers[key] = marker;
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return map;
  }

  function focusPoint(pointKey) {
    const point = CRGR_POINTS[pointKey];
    if (!point || !mapEl) return;

    const mapInstance = initMap();
    if (!mapInstance) return;

    safeScrollTo(mapEl, 110);

    setTimeout(() => {
      mapInstance.invalidateSize();
      mapInstance.setView([point.lat, point.lng], point.zoom || 15, {
        animate: true
      });

      if (markers[pointKey]) {
        markers[pointKey].openPopup();
      }
    }, 260);
  }

  if (mapEl) {
    initMap();

    $$("[data-focus-point]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pointKey = btn.getAttribute("data-focus-point");
        focusPoint(pointKey);
      });
    });

    const openMapBtn = $("[data-open-map]");
    if (openMapBtn) {
      openMapBtn.addEventListener("click", () => {
        safeScrollTo(mapEl, 110);
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 260);
      });
    }
  }

  // ==========================================
  // AO ENTRAR COM HASH NA URL, POSICIONA A PÁGINA
  // ==========================================
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => safeScrollTo(target), 120);
    }
  }
});