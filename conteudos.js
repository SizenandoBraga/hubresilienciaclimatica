document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const byId = (id) => document.getElementById(id);

  function isReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

      if (!rafId) rafId = requestAnimationFrame(updateGlowPosition);
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

  initCursorGlow();
  initReveal();
});