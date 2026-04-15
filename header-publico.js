async function loadPublicHeader() {
  const mountPoint = document.getElementById("site-header");
  if (!mountPoint) return;

  try {
    const response = await fetch("header-publico.html", { cache: "no-store" });
    const html = await response.text();
    mountPoint.innerHTML = html;

    setupPublicHeaderMenu();
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

function markActivePublicNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";

  const map = {
    "index.html": "index",
    "quem-somos.html": "quem-somos",
    "conteudos.html": "conteudos",
    "dados-relatorios.html": "dados-relatorios",
    "faq.html": "faq"
  };

  const activeKey = map[path];
  if (!activeKey) return;

  document.querySelectorAll(".header-nav-link").forEach((link) => {
    if (link.dataset.nav === activeKey) {
      link.classList.add("is-active");
    } else {
      link.classList.remove("is-active");
    }
  });
}

document.addEventListener("DOMContentLoaded", loadPublicHeader);