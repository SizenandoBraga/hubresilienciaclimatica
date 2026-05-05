document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  function initHeroStatic() {
    const hero = document.querySelector(".about-hero-shell, .hero-copy");
    if (!hero) return;

    hero.classList.add("hero-ready");
  }

  initReveal();
  initHeroStatic();
});