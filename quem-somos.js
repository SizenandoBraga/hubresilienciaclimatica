/**
 * quem-somos.js
 * Script da página "Quem Somos"
 *
 * Responsabilidades:
 * 1. Atualizar ano do rodapé
 * 2. Carregar header global com fallback
 * 3. Aplicar efeito de cursor glow em desktop
 * 4. Aplicar animação de reveal ao rolar a página
 * 5. Garantir fallback seguro para botão de entrada, se existir no header
 */

document.addEventListener("DOMContentLoaded", () => {
  updateFooterYear();
  initCursorGlow();
  initRevealOnScroll();
  loadGlobalHeader();
});

/**
 * Atualiza o ano atual no rodapé.
 */
function updateFooterYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

/**
 * Inicializa o efeito visual do brilho seguindo o cursor.
 * Ativado apenas em dispositivos com mouse/pointer fino.
 */
function initCursorGlow() {
  const cursorGlow = document.getElementById("cursorGlow");
  const hasFinePointer = window.matchMedia("(pointer:fine)").matches;

  if (!cursorGlow || !hasFinePointer) return;

  window.addEventListener("mousemove", (event) => {
    cursorGlow.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  });

  window.addEventListener("mouseleave", () => {
    cursorGlow.style.opacity = "0";
  });

  window.addEventListener("mouseenter", () => {
    cursorGlow.style.opacity = "0.22";
  });
}

/**
 * Anima elementos com atributo [data-reveal] quando entram na viewport.
 * Usa IntersectionObserver para melhor performance.
 */
function initRevealOnScroll() {
  const revealItems = document.querySelectorAll("[data-reveal]");

  if (!revealItems.length) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.15
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  } else {
    /* Fallback para navegadores mais antigos */
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
}


/**
 * Injeta um script externo no body.
 * @param {string} src Caminho do script
 * @returns {Promise<void>}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Erro ao carregar script: ${src}`));

    document.body.appendChild(script);
  });
}

/**
 * Fallback para ações simples do header, caso existam elementos específicos.
 * Mantém o comportamento resiliente sem depender 100% do header.js.
 */
function bindHeaderFallbackActions() {
  const btnEntrar = document.getElementById("btnEntrar");
  if (btnEntrar) {
    btnEntrar.addEventListener("click", () => {
      window.location.href = "../html/login.html";
    });
  }

  /**
   * Caso o header tenha menu mobile com botão e nav,
   * este fallback ajuda a abrir/fechar o menu mesmo se o header.js
   * não estiver disponível ou não estiver tratando isso.
   */
  const menuBtn = document.querySelector(".menu-btn");
  const mainNav = document.querySelector(".main-nav");

  if (menuBtn && mainNav) {
    menuBtn.addEventListener("click", () => {
      const isOpen = mainNav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }
}