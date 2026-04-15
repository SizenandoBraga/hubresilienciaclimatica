document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    revealEls.forEach((el) => observer.observe(el));
  }

  function initHeroCarousel() {
    const root = document.getElementById("heroCarousel");
    if (!root) return;

    const slides = $$(".hero-slide", root);
    const dots = $$(".carousel-dot", root);
    const prevBtn = document.getElementById("carouselPrev");
    const nextBtn = document.getElementById("carouselNext");

    if (!slides.length) return;

    let currentIndex = 0;
    let intervalId = null;
    const delay = 4500;

    function render() {
      slides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === currentIndex);
      });

      dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === currentIndex);
      });
    }

    function goTo(index) {
      if (index < 0) currentIndex = slides.length - 1;
      else if (index >= slides.length) currentIndex = 0;
      else currentIndex = index;
      render();
    }

    function next() {
      goTo(currentIndex + 1);
    }

    function prev() {
      goTo(currentIndex - 1);
    }

    function stopAuto() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (isReducedMotion()) return;
      intervalId = setInterval(next, delay);
    }

    prevBtn?.addEventListener("click", () => {
      prev();
      startAuto();
    });

    nextBtn?.addEventListener("click", () => {
      next();
      startAuto();
    });

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        goTo(Number(dot.dataset.slide || 0));
        startAuto();
      });
    });

    root.addEventListener("mouseenter", stopAuto);
    root.addEventListener("mouseleave", startAuto);
    root.addEventListener("focusin", stopAuto);
    root.addEventListener("focusout", startAuto);

    render();
    startAuto();
  }

  initReveal();
  initHeroCarousel();
});