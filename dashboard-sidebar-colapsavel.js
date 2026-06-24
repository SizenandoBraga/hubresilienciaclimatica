/* ==========================================================
   Sidebar colapsável por card — Dashboard NSRU
   Arquivo: dashboard-sidebar-colapsavel.js
========================================================== */

(function () {
  const STORAGE_PREFIX = "nsru-dashboard-sidebar-section:";

  function getSectionTitle(section) {
    const title = section.querySelector(".side-section-title h3 span") ||
      section.querySelector(".side-section-title h3");

    return (title?.textContent || "Seção").trim();
  }

  function setCollapsed(section, collapsed) {
    const button = section.querySelector("[data-sidebar-toggle]");
    const label = section.querySelector(".side-toggle-label");
    const title = getSectionTitle(section);

    section.classList.toggle("is-collapsed", collapsed);

    if (button) {
      button.setAttribute("aria-expanded", String(!collapsed));
      button.setAttribute(
        "aria-label",
        collapsed ? `Expandir ${title}` : `Minimizar ${title}`
      );
      button.title = collapsed ? `Expandir ${title}` : `Minimizar ${title}`;
    }

    if (label) {
      label.textContent = collapsed ? "Expandir" : "Minimizar";
    }

    const sectionId = section.dataset.sidebarSection;
    if (sectionId) {
      localStorage.setItem(
        STORAGE_PREFIX + sectionId,
        collapsed ? "collapsed" : "expanded"
      );
    }
  }

  function initSidebarCollapsibleSections() {
    const sections = document.querySelectorAll(".collapsible-side-section[data-sidebar-section]");

    sections.forEach((section) => {
      const button = section.querySelector("[data-sidebar-toggle]");
      const sectionId = section.dataset.sidebarSection;

      if (!button || !sectionId) return;

      const saved = localStorage.getItem(STORAGE_PREFIX + sectionId);
      setCollapsed(section, saved === "collapsed");

      button.addEventListener("click", () => {
        const nextState = !section.classList.contains("is-collapsed");
        setCollapsed(section, nextState);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSidebarCollapsibleSections);
  } else {
    initSidebarCollapsibleSections();
  }
})();
