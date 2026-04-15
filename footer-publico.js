async function loadPublicFooter() {
  const mountPoint = document.getElementById("site-footer");
  if (!mountPoint) return;

  try {
    const response = await fetch("footer-publico.html", { cache: "no-store" });
    const html = await response.text();
    mountPoint.innerHTML = html;

    const yearEl = document.getElementById("footerYear");
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  } catch (error) {
    console.error("Erro ao carregar footer público:", error);
  }
}

document.addEventListener("DOMContentLoaded", loadPublicFooter);