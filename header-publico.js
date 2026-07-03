/* =========================================================
   HEADER PÚBLICO NSRU
========================================================= */

document.addEventListener("DOMContentLoaded", loadPublicHeader);

async function loadPublicHeader() {
  const mountPoint = document.getElementById("site-header");
  if (!mountPoint) return;

  try {
    const response = await fetch("header-publico.html", { cache: "no-store" });
    if (!response.ok) throw new Error("Erro ao carregar header-publico.html");

    mountPoint.innerHTML = await response.text();

    ensurePlatformAccessButton();
    setupPublicHeaderMenu();
    setupPublicHeaderDropdown();
    markActivePublicNav();

    window.addEventListener("hashchange", markActivePublicNav);
  } catch (error) {
    console.error("Erro ao carregar header público:", error);
  }
}

function ensurePlatformAccessButton() {
  const nav = document.getElementById("headerMainNav");
  if (!nav || nav.querySelector(".header-mobile-cta")) return;

  const link = document.createElement("a");
  link.href = "login.html";
  link.className = "header-nav-link header-mobile-cta";
  link.textContent = "Acessar plataforma";
  link.dataset.nav = "login";

  nav.appendChild(link);
}

function setupPublicHeaderMenu() {
  const btn = document.getElementById("headerMenuBtn");
  const nav = document.getElementById("headerMainNav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 920) {
        nav.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) {
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
}

function setupPublicHeaderDropdown() {
  const dropdown = document.getElementById("headerCrgrDropdown");
  const toggle = document.getElementById("headerCrgrToggle");
  const submenu = document.getElementById("headerCrgrSubmenu");
  const nav = document.getElementById("headerMainNav");

  if (!dropdown || !toggle || !submenu) return;

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const isOpen = dropdown.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target)) {
      dropdown.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  submenu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      dropdown.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");

      if (window.innerWidth <= 920 && nav) {
        nav.classList.remove("is-open");

        const btn = document.getElementById("headerMenuBtn");
        if (btn) btn.setAttribute("aria-expanded", "false");
      }
    });
  });
}

/* =========================================================
   MENU ATIVO
========================================================= */

function normalizePage(value) {
  if (!value) return "index";

  let page = value
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
    .pop();

  if (!page) return "index";

  page = page.toLowerCase();

  if (page === "index.html" || page === "index") return "index";

  return page.replace(".html", "");
}

function markActivePublicNav() {
  const currentPage = normalizePage(window.location.pathname);
  const currentHash = window.location.hash;

  const navLinks = document.querySelectorAll(".header-nav-link");
  const subLinks = document.querySelectorAll(".header-nav-sublink");

  navLinks.forEach((link) => link.classList.remove("is-active"));
  subLinks.forEach((link) => link.classList.remove("is-active"));

  const dropdown = document.getElementById("headerCrgrDropdown");
  const toggle = document.getElementById("headerCrgrToggle");

  if (dropdown) dropdown.classList.remove("has-active-child");
  if (toggle) toggle.classList.remove("is-active");

  const pageToNav = {
    index: "index",
    "quem-somos": "quem-somos",
    guardioes: "guardioes",
    conteudos: "conteudos",
    login: "login"
  };

  const pageToSubNav = {
    "vila-pinto": "vila-pinto",
    cooadesc: "cooadesc",
    ccpa: "padre-cacique",
    "padre-cacique": "padre-cacique"
  };

  let activeNav = pageToNav[currentPage] || null;
  const activeSubNav = pageToSubNav[currentPage] || null;

  if (currentPage === "index" && currentHash === "#indicadores") {
    activeNav = "indicadores";
  }

  if (currentPage === "index" && currentHash === "#faq") {
    activeNav = "faq";
  }

  navLinks.forEach((link) => {
    if (link.dataset.nav === activeNav) {
      link.classList.add("is-active");
    }
  });

  subLinks.forEach((link) => {
    if (link.dataset.navSub === activeSubNav) {
      link.classList.add("is-active");

      if (dropdown) dropdown.classList.add("has-active-child");
      if (toggle) toggle.classList.add("is-active");
    }
  });
}