async function loadPublicHeader() {
  const mountPoint = document.getElementById("site-header");
  if (!mountPoint) return;

  try {
    const response = await fetch("header-publico.html", { cache: "no-store" });
    const html = await response.text();
    mountPoint.innerHTML = html;

    setupPublicHeaderMenu();
    setupPublicHeaderDropdown();
    markActivePublicNav();
  } catch (error) {
    console.error("Erro ao carregar header público:", error);
  }
}

function setupPublicHeaderMenu() {
  const btn = document.getElementById("headerMenuBtn");
  const nav = document.getElementById("headerMainNav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", String(isOpen));
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
    if (window.innerWidth > 920) {
      const btn = document.getElementById("headerMenuBtn");
      if (btn && nav) {
        btn.setAttribute("aria-expanded", "false");
      }
    }
  });
}

function markActivePublicNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  const hash = window.location.hash || "";

  const map = {
    "index.html": "index",
    "quem-somos.html": "quem-somos",
    "conteudos.html": "conteudos"
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
    if (link.dataset.nav === activeKey) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  document.querySelectorAll(".header-nav-sublink").forEach((link) => {
    if (link.dataset.navSub === activeSubKey) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });

  if (activeSubKey) {
    const dropdown = document.getElementById("headerCrgrDropdown");
    const toggle = document.getElementById("headerCrgrToggle");

    if (dropdown) dropdown.classList.add("has-active-child");
    if (toggle) toggle.classList.add("is-active");
  }
}

document.addEventListener("DOMContentLoaded", loadPublicHeader);