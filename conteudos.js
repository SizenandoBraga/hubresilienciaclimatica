document.addEventListener("DOMContentLoaded", () => {
  const menuButton = document.getElementById("menuToggle");
  const mobileNav = document.getElementById("mobileNav");
  const siteHeader = document.getElementById("siteHeader");
  const revealItems = document.querySelectorAll(".reveal");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  initMobileMenu(menuButton, mobileNav);
  initHeaderScroll(siteHeader);
  initRevealAnimations(revealItems, prefersReducedMotion);
});

function initMobileMenu(menuButton, mobileNav) {
  if (!menuButton || !mobileNav) return;

  const navLinks = mobileNav.querySelectorAll("a");

  const openMenu = () => {
    mobileNav.classList.add("open");
    menuButton.classList.add("active");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "Fechar menu");
    document.body.classList.add("menu-open");
  };

  const closeMenu = () => {
    mobileNav.classList.remove("open");
    menuButton.classList.remove("active");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Abrir menu");
    document.body.classList.remove("menu-open");
  };

  const toggleMenu = () => {
    const isOpen = mobileNav.classList.contains("open");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  menuButton.addEventListener("click", toggleMenu);

  navLinks.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobileNav.classList.contains("open")) {
      closeMenu();
    }
  });

  document.addEventListener("click", (event) => {
    const clickedOutside =
      !mobileNav.contains(event.target) &&
      !menuButton.contains(event.target);

    if (mobileNav.classList.contains("open") && clickedOutside) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920 && mobileNav.classList.contains("open")) {
      closeMenu();
    }
  });
}

function initHeaderScroll(siteHeader) {
  if (!siteHeader) return;

  const updateHeaderState = () => {
    if (window.scrollY > 8) {
      siteHeader.classList.add("scrolled");
    } else {
      siteHeader.classList.remove("scrolled");
    }
  };

  updateHeaderState();
  window.addEventListener("scroll", updateHeaderState, { passive: true });
}

function initRevealAnimations(revealItems, prefersReducedMotion) {
  if (!revealItems.length) return;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  revealItems.forEach((item) => observer.observe(item));
}