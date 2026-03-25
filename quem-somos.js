/**
 * quem-somos.js
 * Página "Quem Somos"
 *
 * Funções:
 * - Atualiza o ano do rodapé
 * - Controla o efeito glow do cursor em desktop
 * - Mostra elementos com animação ao entrar na viewport
 * - Controla o menu mobile do header
 * - Fecha menu ao clicar em link, pressionar ESC ou voltar para desktop
 */

document.addEventListener("DOMContentLoaded", () => {
  updateFooterYear();
  initCursorGlow();
  initRevealOnScroll();
  initMobileMenu();
});

/* =========================================
   ANO DO RODAPÉ
========================================= */
function updateFooterYear() {
  const yearEl = document.getElementById("year");

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

/* =========================================
   CURSOR GLOW
   Ativo apenas em dispositivos com ponteiro fino
========================================= */
function initCursorGlow() {
  const cursorGlow = document.getElementById("cursorGlow");
  const hasFinePointer = window.matchMedia("(pointer:fine)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!cursorGlow || !hasFinePointer || prefersReducedMotion) {
    if (cursorGlow) {
      cursorGlow.style.display = "none";
    }
    return;
  }

  let rafId = null;

  function updateGlowPosition(clientX, clientY) {
    cursorGlow.style.transform =
      `translate(${clientX}px, ${clientY}px) translate(-50%, -50%)`;
  }

  window.addEventListener("mousemove", (event) => {
    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      updateGlowPosition(event.clientX, event.clientY);
    });
  });

  window.addEventListener("mouseenter", () => {
    cursorGlow.style.opacity = "0.22";
  });

  window.addEventListener("mouseleave", () => {
    cursorGlow.style.opacity = "0";
  });
}

/* =========================================
   REVEAL AO SCROLL
========================================= */
function initRevealOnScroll() {
  const revealItems = document.querySelectorAll("[data-reveal]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!revealItems.length) return;

  if (prefersReducedMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -20px 0px"
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
}

/* =========================================
   MENU MOBILE
========================================= */
function initMobileMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const mainNav = document.getElementById("mainNav");

  if (!menuBtn || !mainNav) return;

  const navLinks = mainNav.querySelectorAll(".nav-link");
  const desktopMediaQuery = window.matchMedia("(min-width: 861px)");

  function openMenu() {
    mainNav.classList.add("open");
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Fechar menu");
    menuBtn.innerHTML = "✕";
    document.body.classList.add("menu-open");
  }

  function closeMenu() {
    mainNav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Abrir menu");
    menuBtn.innerHTML = "☰";
    document.body.classList.remove("menu-open");
  }

  function isMenuOpen() {
    return mainNav.classList.contains("open");
  }

  function toggleMenu() {
    if (isMenuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  menuBtn.addEventListener("click", toggleMenu);

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 860) {
        closeMenu();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isMenuOpen()) {
      closeMenu();
      menuBtn.focus();
    }
  });

  if (typeof desktopMediaQuery.addEventListener === "function") {
    desktopMediaQuery.addEventListener("change", (event) => {
      if (event.matches) {
        closeMenu();
      }
    });
  } else if (typeof desktopMediaQuery.addListener === "function") {
    desktopMediaQuery.addListener((event) => {
      if (event.matches) {
        closeMenu();
      }
    });
  }

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860 && isMenuOpen()) {
      closeMenu();
    }
  });

  closeMenu();
}