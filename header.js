document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menuBtn");
  const mainNav = document.getElementById("mainNav");

  // Toggle menu mobile
  if (menuBtn && mainNav) {
    menuBtn.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", isOpen);
    });
  }

  // Ativar link correto
  const currentPage = window.location.pathname.split("/").pop();

  document.querySelectorAll(".nav-link").forEach(link => {
    const page = link.getAttribute("data-page");

    if (
      (page === "index" && currentPage === "index.html") ||
      (page === "quem-somos" && currentPage === "quem-somos.html") ||
      (page === "conteudos" && currentPage === "conteudos.html")
    ) {
      link.classList.add("active");
    }
  });
});