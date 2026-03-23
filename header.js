// ===============================
// MENU MOBILE
// ===============================
const menuBtn = document.getElementById("menuBtn");
const mainNav = document.getElementById("mainNav");

if (menuBtn && mainNav) {
  menuBtn.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", isOpen);
  });
}

// ===============================
// LINK ATIVO AUTOMÁTICO
// ===============================
const currentPath = window.location.pathname;

document.querySelectorAll(".nav-link").forEach(link => {
  const href = link.getAttribute("href");

  if (href && currentPath.includes(href.replace("/", ""))) {
    link.classList.add("active");
  }
});