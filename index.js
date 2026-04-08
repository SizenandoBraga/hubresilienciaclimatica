document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =========================================================
   * CONFIGURAÇÕES GERAIS
   * ========================================================= */
  const LOGIN_URL = "login.html";
  const MOBILE_BREAKPOINT = 860;
  const HEADER_SCROLL_OFFSET = 96;
  const MAP_SCROLL_OFFSET = 110;
  const INITIAL_MAP_VIEW = {
    lat: -30.02,
    lng: -51.18,
    zoom: 11
  };

  /**
   * Pontos CRGR exibidos no mapa.
   * Cada item contém:
   * - name: nome legível
   * - lat/lng: coordenadas
   * - zoom: zoom ao focar no ponto
   * - popup: conteúdo HTML do popup
   */
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
    },

    padrecacique: {
      name: "Padre Cacique",
      lat: -30.140122365657504,
      lng: -51.1268772051727,
      zoom: 16,
      popup: `
        <div style="font-family:'Archivo Condensed',sans-serif;">
          <strong>Padre Cacique</strong><br>
          Região de Belém Novo<br>
          Porto Alegre/RS
        </div>
      `
    }
  };

  /* =========================================================
   * HELPERS DE DOM
   * ========================================================= */

  /**
   * Retorna o primeiro elemento que casar com o seletor.
   * @param {string} selector
   * @param {ParentNode} [scope=document]
   * @returns {Element|null}
   */
  const $ = (selector, scope = document) => scope.querySelector(selector);

  /**
   * Retorna todos os elementos do seletor como array.
   * @param {string} selector
   * @param {ParentNode} [scope=document]
   * @returns {Element[]}
   */
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /**
   * Verifica se o usuário prefere reduzir animações.
   * @returns {boolean}
   */
  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Faz scroll suave até um elemento com compensação para cabeçalho fixo.
   * @param {Element|null} target
   * @param {number} [offset=HEADER_SCROLL_OFFSET]
   */
  function safeScrollTo(target, offset = HEADER_SCROLL_OFFSET) {
    if (!target) return;

    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({
      top,
      behavior: "smooth"
    });
  }

  /**
   * Atualiza o texto de um elemento se ele existir.
   * @param {Element|null} element
   * @param {string} text
   */
  function setTextIfExists(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  /* =========================================================
   * ANO AUTOMÁTICO NO RODAPÉ
   * ========================================================= */
  const yearEl = $("#year");
  setTextIfExists(yearEl, String(new Date().getFullYear()));

  /* =========================================================
   * BOTÕES DE ENTRADA / LOGIN
   * ========================================================= */

  /**
   * Redireciona para a página de login.
   */
  function goToLogin() {
    window.location.href = LOGIN_URL;
  }

  const btnEntrar = $("#btnEntrar");
  const btnEntrarHero = $("#btnEntrarHero");

  [btnEntrar, btnEntrarHero].forEach((button) => {
    if (!button) return;

    button.addEventListener("click", goToLogin);
  });

  /* =========================================================
   * MENU MOBILE
   * ========================================================= */
  const menuBtn = $("#menuBtn");
  const mainNav = $("#mainNav");

  /**
   * Fecha o menu mobile.
   */
  function closeMobileMenu() {
    if (!menuBtn || !mainNav) return;

    menuBtn.setAttribute("aria-expanded", "false");
    mainNav.classList.remove("open");
  }

  /**
   * Abre o menu mobile.
   */
  function openMobileMenu() {
    if (!menuBtn || !mainNav) return;

    menuBtn.setAttribute("aria-expanded", "true");
    mainNav.classList.add("open");
  }

  /**
   * Alterna o estado do menu mobile.
   */
  function toggleMobileMenu() {
    if (!menuBtn) return;

    const isExpanded = menuBtn.getAttribute("aria-expanded") === "true";
    if (isExpanded) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  if (menuBtn && mainNav) {
    menuBtn.addEventListener("click", toggleMobileMenu);

    /* Fecha o menu ao clicar em qualquer link no mobile */
    $$("a", mainNav).forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth <= MOBILE_BREAKPOINT) {
          closeMobileMenu();
        }
      });
    });

    /* Garante que, ao voltar para desktop, o menu mobile feche */
    window.addEventListener("resize", () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        closeMobileMenu();
      }
    });
  }

  /* =========================================================
   * GLOW DO CURSOR
   * ========================================================= */
  const cursorGlow = $("#cursorGlow");

  if (cursorGlow && !isReducedMotion()) {
    let rafId = null;
    let mouseX = -9999;
    let mouseY = -9999;

    /**
     * Atualiza as variáveis CSS do glow.
     */
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

    window.addEventListener("blur", () => {
      cursorGlow.style.opacity = "0";
    });
  }

  /* =========================================================
   * REVEAL DE ELEMENTOS
   * ========================================================= */
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

      revealEls.forEach((element) => revealObserver.observe(element));
    } else {
      revealEls.forEach((element) => element.classList.add("in"));
    }
  }

  /* =========================================================
   * CONTADOR ANIMADO
   * ========================================================= */
  const countEls = $$(".kcount");

  /**
   * Anima um contador numérico até o valor definido em data-count.
   * @param {Element} element
   */
  function animateCount(element) {
    const target = Number(element.dataset.count || 0);
    const duration = 1400;

    if (!Number.isFinite(target)) {
      element.textContent = "0";
      return;
    }

    if (isReducedMotion()) {
      element.textContent = target.toLocaleString("pt-BR");
      return;
    }

    const start = performance.now();

    function frame(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);

      element.textContent = current.toLocaleString("pt-BR");

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        element.textContent = target.toLocaleString("pt-BR");
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
        {
          threshold: 0.45
        }
      );

      countEls.forEach((element) => countObserver.observe(element));
    } else {
      countEls.forEach((element) => animateCount(element));
    }
  }

  /* =========================================================
   * FAQ - MANTÉM APENAS UM ITEM ABERTO
   * ========================================================= */
  const faqDetails = $$("details.faq-item, details");

  faqDetails.forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;

      faqDetails.forEach((other) => {
        if (other !== detail) {
          other.open = false;
        }
      });
    });
  });

  /* =========================================================
   * LINKS INTERNOS COM SCROLL SUAVE
   * ========================================================= */
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

  /* =========================================================
   * MAPA LEAFLET
   * ========================================================= */
  const mapEl = $("#map");
  let map = null;
  const markers = {};

  /**
   * Inicializa o mapa Leaflet uma única vez.
   * @returns {any|null}
   */
  function initMap() {
    if (!mapEl || map || typeof L === "undefined") {
      return map;
    }

    map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([INITIAL_MAP_VIEW.lat, INITIAL_MAP_VIEW.lng], INITIAL_MAP_VIEW.zoom);

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

  /**
   * Foca um ponto do mapa pelo identificador.
   * @param {string} pointKey
   */
  function focusPoint(pointKey) {
    const point = CRGR_POINTS[pointKey];
    if (!point || !mapEl) return;

    const mapInstance = initMap();
    if (!mapInstance) return;

    safeScrollTo(mapEl, MAP_SCROLL_OFFSET);

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

    $$("[data-focus-point]").forEach((button) => {
      button.addEventListener("click", () => {
        const pointKey = button.getAttribute("data-focus-point");
        focusPoint(pointKey);
      });
    });

    const openMapBtn = $("[data-open-map]");
    if (openMapBtn) {
      openMapBtn.addEventListener("click", () => {
        safeScrollTo(mapEl, MAP_SCROLL_OFFSET);

        setTimeout(() => {
          if (map) {
            map.invalidateSize();
          }
        }, 260);
      });
    }
  }

  /* =========================================================
   * POSICIONAMENTO INICIAL POR HASH
   * ========================================================= */
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);

    if (target) {
      setTimeout(() => {
        safeScrollTo(target);
      }, 120);
    }
  }
});