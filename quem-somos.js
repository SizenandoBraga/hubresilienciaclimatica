/* =========================================================
   QUEM SOMOS - JS
   Animações leves + acessibilidade
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));

  function initReveal() {
    if (!revealItems.length) return;

    if (!("IntersectionObserver" in window) || prefersReducedMotion) {
      revealItems.forEach((item) => item.classList.add("in"));
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
        threshold: 0.14,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  function initCardsKeyboardFocus() {
    const interactiveCards = document.querySelectorAll(
      ".card, .logo-card, .side-item"
    );

    interactiveCards.forEach((card) => {
      card.addEventListener("focusin", () => {
        card.classList.add("is-focused");
      });

      card.addEventListener("focusout", () => {
        card.classList.remove("is-focused");
      });
    });
  }

  function initSoftParallax() {
    const sideCard = document.querySelector(".about-side-card");

    if (!sideCard || prefersReducedMotion) return;

    window.addEventListener(
      "scroll",
      () => {
        const rect = sideCard.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        if (rect.top > windowHeight || rect.bottom < 0) return;

        const movement = Math.min(10, Math.max(-10, rect.top * -0.015));
        sideCard.style.transform = `translateY(${movement}px)`;
      },
      { passive: true }
    );
  }

  initReveal();
  initCardsKeyboardFocus();
  initSoftParallax();
});