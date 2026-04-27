async function loadPublicHeader() {
  const mountPoint = document.getElementById("site-header");
  if (!mountPoint) return;

  try {
    const response = await fetch("header-publico.html", { cache: "no-store" });
    const html = await response.text();
    mountPoint.innerHTML = html;

    ensurePlatformAccessButton();
    setupPublicHeaderMenu();
    setupPublicHeaderDropdown();
    markActivePublicNav();
  } catch (error) {
    console.error("Erro ao carregar header público:", error);
  }
}

function ensurePlatformAccessButton() {
  const nav = document.getElementById("headerMainNav");
  if (!nav) return;

  const alreadyExists = nav.querySelector(".header-mobile-cta");
  if (alreadyExists) return;

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

  submenu.querySelectorAll(".header-nav-sublink").forEach((link) => {
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

  window.addEventListener("resize", () => {
    const btn = document.getElementById("headerMenuBtn");

    if (window.innerWidth > 920) {
      if (nav) nav.classList.remove("is-open");
      if (btn) btn.setAttribute("aria-expanded", "false");
    }
  });
}

function markActivePublicNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const hash = window.location.hash || "";

  const map = {
    "index.html": "index",
    "quem-somos.html": "quem-somos",
    "conteudos.html": "conteudos",
    "login.html": "login"
  };

  const subMap = {
    "vila-pinto.html": "vila-pinto",
    "cooadesc.html": "cooadesc",
    "padre-cacique.html": "padre-cacique"
  };

  let activeKey = map[path];
  const activeSubKey = subMap[path];

  if (path === "index.html" && hash === "#indicadores") {
    activeKey = "indicadores";
  }

  if (path === "index.html" && hash === "#faq") {
    activeKey = "faq";
  }

  document.querySelectorAll(".header-nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === activeKey);
  });

  document.querySelectorAll(".header-nav-sublink").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.navSub === activeSubKey);
  });

  if (activeSubKey) {
    const dropdown = document.getElementById("headerCrgrDropdown");
    const toggle = document.getElementById("headerCrgrToggle");

    if (dropdown) dropdown.classList.add("has-active-child");
    if (toggle) toggle.classList.add("is-active");
  }
}

document.addEventListener("DOMContentLoaded", loadPublicHeader);