import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* Corrige os ícones padrão do Leaflet em bundlers */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

document.addEventListener("DOMContentLoaded", () => {
  const LOGIN_URL = "./login.html";

  const CRGR_POINTS = {
    cooadesc: {
      name: "COOADESC",
      lat: -30.003,
      lng: -51.206,
      zoom: 15,
      popup: `
        <div style="font-family: 'Archivo Condensed', sans-serif;">
          <strong>COOADESC</strong><br>
          Rua Seis (Vila Esperança), 113<br>
          Farrapos • Porto Alegre/RS
        </div>
      `
    },
    vilapinto: {
      name: "Vila Pinto",
      lat: -30.036111,
      lng: -51.158333,
      zoom: 15,
      popup: `
        <div style="font-family: 'Archivo Condensed', sans-serif;">
          <strong>Vila Pinto</strong><br>
          Região da Bom Jesus / Jardim Carvalho<br>
          Porto Alegre/RS
        </div>
      `
    }
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function safeScrollTo(target, offset = 88) {
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  }

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /* Ano no footer */
  const yearEl = $("#year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* Botões de login */
  const btnEntrar = $("#btnEntrar");
  const btnEntrarHero = $("#btnEntrarHero");

  [btnEntrar, btnEntrarHero].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      window.location.href = LOGIN_URL;
    });
  });

  /* Menu mobile */
  const menuBtn = $("#menuBtn");
  const mobileNav = $("#mobileNav");

  function closeMobileMenu() {
    if (!menuBtn || !mobileNav) return;
    menuBtn.setAttribute("aria-expanded", "false");
    mobileNav.hidden = true;
    mobileNav.classList.remove("open");
  }

  function openMobileMenu() {
    if (!menuBtn || !mobileNav) return;
    menuBtn.setAttribute("aria-expanded", "true");
    mobileNav.hidden = false;
    mobileNav.classList.add("open");
  }

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", () => {
      const expanded = menuBtn.getAttribute("aria-expanded") === "true";
      if (expanded) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    $$("a", mobileNav).forEach((link) => {
      link.addEventListener("click", () => {
        closeMobileMenu();
      });
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) {
        closeMobileMenu();
      }
    });
  }

  /* Cursor glow */
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

      if (!rafId) {
        rafId = requestAnimationFrame(updateGlow);
      }
    });

    window.addEventListener("mouseleave", () => {
      cursorGlow.style.opacity = "0";
    });

    window.addEventListener("blur", () => {
      cursorGlow.style.opacity = "0";
    });
  }

  /* Reveal ao rolar */
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

  /* Contadores */
  const countEls = $$(".kcount");

  function animateCount(el) {
    const target = Number(el.dataset.count || 0);
    const duration = 1400;

    if (!Number.isFinite(target)) {
      el.textContent = "0";
      return;
    }

    if (isReducedMotion()) {
      el.textContent = String(target);
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

  /* FAQ: abre um por vez */
  $$("details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;

      $$("details").forEach((other) => {
        if (other !== detail) {
          other.open = false;
        }
      });
    });
  });

  /* Âncoras com offset */
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

  /* Leaflet */
  const mapEl = $("#map");
  let map = null;
  const markers = {};

  function initMap() {
    if (!mapEl || map) return map;

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
  }

  /* Hash inicial */
  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => safeScrollTo(target), 120);
    }
  }
});