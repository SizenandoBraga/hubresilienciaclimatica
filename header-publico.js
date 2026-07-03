/* =========================================================
   HEADER PÚBLICO NSRU
========================================================= */

async function loadPublicHeader() {
  const mountPoint = document.getElementById("site-header");

  if (!mountPoint) return;

  try {
    const response = await fetch("header-publico.html", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Não foi possível carregar o header.");
    }

    mountPoint.innerHTML = await response.text();

    ensurePlatformAccessButton();

    setupPublicHeaderMenu();

    setupPublicHeaderDropdown();

    markActivePublicNav();

  } catch (err) {

    console.error("Erro ao carregar header:", err);

  }
}

/* =========================================================
   BOTÃO MOBILE
========================================================= */

function ensurePlatformAccessButton() {

  const nav = document.getElementById("headerMainNav");

  if (!nav) return;

  if (nav.querySelector(".header-mobile-cta")) return;

  const link = document.createElement("a");

  link.href = "login.html";

  link.className =
    "header-nav-link header-mobile-cta";

  link.dataset.nav = "login";

  link.textContent = "Acessar Plataforma";

  nav.appendChild(link);

}

/* =========================================================
   MENU MOBILE
========================================================= */

function setupPublicHeaderMenu() {

  const btn = document.getElementById("headerMenuBtn");

  const nav = document.getElementById("headerMainNav");

  if (!btn || !nav) return;

  btn.addEventListener("click", () => {

    const opened = nav.classList.toggle("is-open");

    btn.setAttribute("aria-expanded", opened);

  });

  nav.querySelectorAll("a").forEach(link => {

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

/* =========================================================
   DROPDOWN CRGR
========================================================= */

function setupPublicHeaderDropdown() {

  const dropdown = document.getElementById("headerCrgrDropdown");

  const toggle = document.getElementById("headerCrgrToggle");

  const submenu = document.getElementById("headerCrgrSubmenu");

  const nav = document.getElementById("headerMainNav");

  if (!dropdown || !toggle || !submenu) return;

  toggle.addEventListener("click", e => {

    e.preventDefault();

    e.stopPropagation();

    const opened = dropdown.classList.toggle("is-open");

    toggle.setAttribute("aria-expanded", opened);

  });

  document.addEventListener("click", e => {

    if (!dropdown.contains(e.target)) {

      dropdown.classList.remove("is-open");

      toggle.setAttribute("aria-expanded", "false");

    }

  });

  submenu.querySelectorAll("a").forEach(link => {

    link.addEventListener("click", () => {

      dropdown.classList.remove("is-open");

      toggle.setAttribute("aria-expanded", "false");

      if (window.innerWidth <= 920 && nav) {

        nav.classList.remove("is-open");

        const btn = document.getElementById("headerMenuBtn");

        if (btn)

          btn.setAttribute("aria-expanded", "false");

      }

    });

  });

}

/* =========================================================
   MENU ATIVO
========================================================= */

function markActivePublicNav() {

  const url = new URL(window.location.href);

  let page = url.pathname.split("/").pop();

  if (page === "") page = "index.html";

  const hash = url.hash;

  const map = {

    "index.html": "index",

    "quem-somos.html": "quem-somos",

    "guardioes.html": "guardioes",

    "conteudos.html": "conteudos",

    "login.html": "login"

  };

  const subMap = {

    "vila-pinto.html": "vila-pinto",

    "cooadesc.html": "cooadesc",

    "ccpa.html": "padre-cacique",

    "padre-cacique.html": "padre-cacique"

  };

  let active = map[page] || null;

  if (page === "index.html") {

    if (hash === "#indicadores") {

      active = "indicadores";

    }

    if (hash === "#faq") {

      active = "faq";

    }

  }

  const activeSub = subMap[page];

  document
    .querySelectorAll(".header-nav-link")
    .forEach(link => {

      link.classList.remove("is-active");

      if (link.dataset.nav === active) {

        link.classList.add("is-active");

      }

    });

  document
    .querySelectorAll(".header-nav-sublink")
    .forEach(link => {

      link.classList.remove("is-active");

      if (link.dataset.navSub === activeSub) {

        link.classList.add("is-active");

      }

    });

  const dropdown =
    document.getElementById("headerCrgrDropdown");

  const toggle =
    document.getElementById("headerCrgrToggle");

  if (dropdown)

    dropdown.classList.remove("has-active-child");

  if (toggle)

    toggle.classList.remove("is-active");

  if (activeSub) {

    if (dropdown)

      dropdown.classList.add("has-active-child");

    if (toggle)

      toggle.classList.add("is-active");

  }

}

/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  loadPublicHeader
);