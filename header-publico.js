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

function normalizePath(pathname) {
  let path = pathname.split("/").pop();

  if (!path || path === "/") path = "index.html";

  return path.toLowerCase();
}

function markActivePublicNav() {
  const currentPage = normalizePath(window.location.pathname);
  const currentHash = window.location.hash;

  const links = document.querySelectorAll(
    ".header-nav-link, .header-nav-sublink"
  );

  links.forEach((link) => {
    link.classList.remove("is-active");
  });

  const dropdown = document.getElementById("headerCrgrDropdown");
  const toggle = document.getElementById("headerCrgrToggle");

  if (dropdown) dropdown.classList.remove("has-active-child");
  if (toggle) toggle.classList.remove("is-active");

  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http")) return;

    const linkUrl = new URL(href, window.location.origin);
    const linkPage = normalizePath(linkUrl.pathname);
    const linkHash = linkUrl.hash;

    const samePage = linkPage === currentPage;
    const sameHash = linkHash && linkHash === currentHash;
    const normalPageMatch = samePage && !linkHash && !currentHash;
    const indexHashMatch = samePage && sameHash;

    if (normalPageMatch || indexHashMatch) {
      link.classList.add("is-active");

      if (link.classList.contains("header-nav-sublink")) {
        if (dropdown) dropdown.classList.add("has-active-child");
        if (toggle) toggle.classList.add("is-active");
      }
    }
  });
}