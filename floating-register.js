/* =========================================================
   FLOATING REGISTER BOT • NSRU
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupFloatingRegisterBot();
  }
);

/* =========================================================
   INIT
========================================================= */

function setupFloatingRegisterBot() {

  const openButton =
    document.getElementById(
      "openRegisterBot"
    );

  const closeButton =
    document.getElementById(
      "closeRegisterBot"
    );

  const bot =
    document.getElementById(
      "registerBot"
    );

  const wrapper =
    document.getElementById(
      "floatingRegister"
    );

  if (
    !openButton ||
    !closeButton ||
    !bot
  ) {

    return;
  }

  /* =====================================================
     ABRIR / FECHAR
  ===================================================== */

  openButton.addEventListener(
    "click",
    () => {

      bot.classList.toggle(
        "show"
      );

      openButton.classList.toggle(
        "active"
      );
    }
  );

  closeButton.addEventListener(
    "click",
    () => {

      closeRegisterBot();
    }
  );

  /* =====================================================
     CLICK FORA FECHA
  ===================================================== */

  document.addEventListener(
    "click",
    (event) => {

      if (
        !wrapper.contains(
          event.target
        )
      ) {

        closeRegisterBot();
      }
    }
  );

  /* =====================================================
     ESC FECHA
  ===================================================== */

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape"
      ) {

        closeRegisterBot();
      }
    }
  );

  /* =====================================================
     ANIMAÇÃO ENTRADA
  ===================================================== */

  setTimeout(() => {

    openButton.classList.add(
      "loaded"
    );

  }, 600);
}

/* =========================================================
   FECHAR BOT
========================================================= */

function closeRegisterBot() {

  const bot =
    document.getElementById(
      "registerBot"
    );

  const openButton =
    document.getElementById(
      "openRegisterBot"
    );

  if (bot) {

    bot.classList.remove(
      "show"
    );
  }

  if (openButton) {

    openButton.classList.remove(
      "active"
    );
  }
}