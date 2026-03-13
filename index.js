document.addEventListener("DOMContentLoaded", () => {
  const LOGIN_URL = "/html/login.html";

  const CRGR_POINTS = {
    cooadesc: {
      name: "COOADESC",
      lat: -30.003,
      lng: -51.206,
      zoom: 15
    },
    vilapinto: {
      name: "Vila Pinto",
      lat: -30.036111,
      lng: -51.158333,
      zoom: 15
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

  const yearEl = $("#year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const btnEntrar = $("#btnEntrar");
  const btnEntrarHero = $("#btnEntrarHero");

  [btnEntrar, btnEntrarHero].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", () => {
      window.location.href = LOGIN_URL;
    });
  });

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
      if (expanded) closeMobileMenu();
      else openMobileMenu();
    });

    $$("a", mobileNav).forEach((link) => {
      link.addEventListener("click", () => closeMobileMenu());
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) {
        closeMobileMenu();
      }
    });
  }

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

  $$("details").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      if (!detail.open) return;

      $$("details").forEach((other) => {
        if (other !== detail) other.open = false;
      });
    });
  });

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

  let mapInstance = null;
  let markers = {};

  function buildMap() {
    if (mapInstance || typeof L === "undefined") return mapInstance;

    const mapEl = $("#map");
    if (!mapEl) return null;

    mapInstance = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false
    }).setView([-30.02, -51.18], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap"
    }).addTo(mapInstance);

    Object.entries(CRGR_POINTS).forEach(([key, point]) => {
      const marker = L.marker([point.lat, point.lng]).addTo(mapInstance);
      marker.bindPopup(`<strong>${point.name}</strong>`);
      markers[key] = marker;
    });

    setTimeout(() => mapInstance.invalidateSize(), 200);

    return mapInstance;
  }

  function focusPoint(pointKey) {
    const point = CRGR_POINTS[pointKey];
    if (!point) return;

    const map = buildMap();
    const mapEl = $("#map");
    if (!map || !mapEl) return;

    safeScrollTo(mapEl, 110);

    setTimeout(() => {
      map.invalidateSize();
      map.setView([point.lat, point.lng], point.zoom || 15, { animate: true });

      if (markers[pointKey]) {
        markers[pointKey].openPopup();
      }
    }, 260);
  }

  buildMap();

  $$("[data-focus-point]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pointKey = btn.getAttribute("data-focus-point");
      focusPoint(pointKey);
    });
  });

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => safeScrollTo(target), 120);
    }
  }
});