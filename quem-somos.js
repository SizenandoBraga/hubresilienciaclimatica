const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
  }

  const cursorGlow = document.getElementById("cursorGlow");

  if (cursorGlow && window.matchMedia("(pointer:fine)").matches) {
    window.addEventListener("mousemove", (event) => {
        cursorGlow.style.transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
          });

            window.addEventListener("mouseleave", () => {
                cursorGlow.style.opacity = "0";
                  });

                    window.addEventListener("mouseenter", () => {
                        cursorGlow.style.opacity = ".22";
                          });
                          }

                          const revealItems = document.querySelectorAll("[data-reveal]");

                          if ("IntersectionObserver" in window && revealItems.length) {
                            const observer = new IntersectionObserver((entries) => {
                                entries.forEach((entry) => {
                                      if (entry.isIntersecting) {
                                              entry.target.classList.add("is-visible");
                                                      observer.unobserve(entry.target);
                                                            }
                                                                });
                                                                  }, {
                                                                      threshold: 0.15
                                                                        });

                                                                          revealItems.forEach((item) => observer.observe(item));
                                                                          } else {
                                                                            revealItems.forEach((item) => item.classList.add("is-visible"));
                                                                            }

                                                                            const btnEntrar = document.getElementById("btnEntrar");

                                                                            if (btnEntrar) {
                                                                              btnEntrar.addEventListener("click", () => {
                                                                                  window.location.href = "../html/login.html";
                                                                                    });
                                                                                    }