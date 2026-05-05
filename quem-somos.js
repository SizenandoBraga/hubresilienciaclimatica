/* =========================================================
   QUEM SOMOS - JS
   Função: animação de entrada e acessibilidade
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =========================
     HELPERS
  ========================= */

  const $$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* =========================
     REVEAL ANIMATION
  ========================= */

  function initReveal() {
    const elements = $$("[data-reveal]");

    if (!elements.length) return;

    // Se navegador não suporta ou usuário prefere menos animação
    if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
      elements.forEach((el) => el.classList.add("in"));
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

    elements.forEach((el) => observer.observe(el));
  }

  /* =========================
     INIT
  ========================= */

  initReveal();
});