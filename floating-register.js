/* =========================================================
   FLOATING REGISTER BOT • NSRU
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setupFloatingRegisterBot();
});

function setupFloatingRegisterBot() {
  const openButton = document.getElementById("openRegisterBot");
  const closeButton = document.getElementById("closeRegisterBot");
  const bot = document.getElementById("registerBot");
  const wrapper = document.getElementById("floatingRegister");

  if (!openButton || !closeButton || !bot || !wrapper) {
    return;
  }

  function openBot() {
    bot.classList.add("show");
    openButton.classList.add("active");
    openButton.setAttribute("aria-expanded", "true");
  }

  function closeBot() {
    bot.classList.remove("show");
    openButton.classList.remove("active");
    openButton.setAttribute("aria-expanded", "false");
  }

  function toggleBot(event) {
    event.stopPropagation();

    if (bot.classList.contains("show")) {
      closeBot();
    } else {
      openBot();
    }
  }

  openButton.setAttribute("aria-expanded", "false");
  openButton.setAttribute("aria-controls", "registerBot");

  openButton.addEventListener("click", toggleBot);

  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closeBot();
  });

  bot.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) {
      closeBot();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeBot();
    }
  });

  document.querySelectorAll(".register-bot-link").forEach((link) => {
    link.addEventListener("click", closeBot);
  });

  setTimeout(() => {
    openButton.classList.add("loaded");
  }, 600);
}