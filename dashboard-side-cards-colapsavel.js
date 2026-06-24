/* ==========================================================
   Cards da sidebar com minimizar / maximizar individual
   Dashboard NSRU — CCPA
   Arquivo: dashboard-side-cards-colapsavel.js
========================================================== */

(function () {
  const STORAGE_PREFIX = "nsru-dashboard-ccpa-side-card:";

  function getTitle(section) {
    const title = section.querySelector(".side-card-title h3 span") ||
      section.querySelector(".side-card-title h3");

    return (title?.textContent || "seção").trim();
  }

  function setCardState(section, collapsed) {
    const key = section.dataset.sideCard;
    const button = section.querySelector("[data-side-card-toggle]");
    const label = section.querySelector(".side-card-toggle-label");
    const title = getTitle(section);

    section.classList.toggle("is-collapsed", collapsed);

    if (button) {
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.setAttribute(
        "aria-label",
        collapsed ? `Maximizar ${title}` : `Minimizar ${title}`
      );
      button.title = collapsed ? `Maximizar ${title}` : `Minimizar ${title}`;
    }

    if (label) {
      label.textContent = collapsed ? "Maximizar" : "Minimizar";
    }

    if (key) {
      localStorage.setItem(
        STORAGE_PREFIX + key,
        collapsed ? "collapsed" : "expanded"
      );
    }
  }

  function initSideCards() {
    const cards = Array.from(
      document.querySelectorAll(".side-card-collapsible[data-side-card]")
    );

    cards.forEach((section) => {
      const key = section.dataset.sideCard;
      const button = section.querySelector("[data-side-card-toggle]");

      if (!key || !button) return;

      const saved = localStorage.getItem(STORAGE_PREFIX + key);
      setCardState(section, saved === "collapsed");

      button.addEventListener("click", () => {
        setCardState(section, !section.classList.contains("is-collapsed"));
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSideCards);
  } else {
    initSideCards();
  }
})();
