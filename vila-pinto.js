import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
    getDoc,
      collection,
        query,
          where,
            getDocs
            } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
            import "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

            const els = {
              menuToggle: document.getElementById("menuToggle"),
                mobileMenu: document.getElementById("mobileMenu"),

                  territoryHeroTitle: document.getElementById("territoryHeroTitle"),
                    territoryHeroLead: document.getElementById("territoryHeroLead"),

                      cooperadosValue: document.getElementById("cooperadosValue"),
                        coletasValue: document.getElementById("coletasValue"),
                          volumeValue: document.getElementById("volumeValue"),
                            pontosValue: document.getElementById("pontosValue"),

                              territoryLabelText: document.getElementById("territoryLabelText"),
                                territoryRegionText: document.getElementById("territoryRegionText"),
                                  territoryProfileText: document.getElementById("territoryProfileText"),
                                    territoryFocusText: document.getElementById("territoryFocusText"),

                                      coopNameText: document.getElementById("coopNameText"),
                                        coopDescriptionText: document.getElementById("coopDescriptionText"),

                                          map: document.getElementById("map")
                                          };

                                          let territoryMap = null;
                                          let territoryMarkers = [];

                                          /* MENU */
                                          if (els.menuToggle && els.mobileMenu) {
                                            els.menuToggle.addEventListener("click", () => {
                                                els.mobileMenu.classList.toggle("show");
                                                  });
                                                  }

                                                  /* HELPERS */
                                                  async function getUserProfile(uid) {
                                                    const snap = await getDoc(doc(db, "users", uid));
                                                      if (!snap.exists()) throw new Error("Usuário não encontrado.");
                                                        return snap.data();
                                                        }

                                                        function validateProfile(profile) {
                                                          if (!profile) throw new Error("Perfil não encontrado.");
                                                            if (profile.status !== "active") throw new Error("Usuário sem acesso ativo.");
                                                              if (!profile.territoryId) throw new Error("Usuário sem territoryId.");
                                                              }

                                                              function setText(el, value, fallback = "-") {
                                                                if (!el) return;
                                                                  el.textContent = value || fallback;
                                                                  }

                                                                  function formatTon(valueKg) {
                                                                    const tons = Number(valueKg || 0) / 1000;
                                                                      return `${tons.toFixed(1).replace(".", ",")} t`;
                                                                      }

                                                                      function sumColetasVolume(items) {
                                                                        return items.reduce((sum, item) => {
                                                                            const qty = Number(item.quantity || 0);
                                                                                return sum + (Number.isFinite(qty) ? qty : 0);
                                                                                  }, 0);
                                                                                  }

                                                                                  /* MAPA */
                                                                                  function clearMarkers() {
                                                                                    territoryMarkers.forEach((marker) => {
                                                                                        territoryMap?.removeLayer(marker);
                                                                                          });
                                                                                            territoryMarkers = [];
                                                                                            }

                                                                                            function ensureMap(center = [-30.036111, -51.158333], zoom = 14) {
                                                                                              if (!els.map || typeof L === "undefined") return null;

                                                                                                if (!territoryMap) {
                                                                                                    territoryMap = L.map("map", {
                                                                                                          zoomControl: true
                                                                                                              }).setView(center, zoom);

                                                                                                                  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                                                                                                                        attribution: "&copy; OpenStreetMap"
                                                                                                                            }).addTo(territoryMap);
                                                                                                                              }

                                                                                                                                return territoryMap;
                                                                                                                                }

                                                                                                                                function renderMapPoints(points) {
                                                                                                                                  const safePoints = Array.isArray(points) ? points : [];
                                                                                                                                    const fallbackCenter = safePoints.length
                                                                                                                                        ? [safePoints[0].geo.lat, safePoints[0].geo.lng]
                                                                                                                                            : [-30.036111, -51.158333];

                                                                                                                                              const map = ensureMap(fallbackCenter, 14);
                                                                                                                                                if (!map) return;

                                                                                                                                                  clearMarkers();

                                                                                                                                                    const bounds = [];

                                                                                                                                                      safePoints.forEach((point) => {
                                                                                                                                                          const lat = Number(point?.geo?.lat);
                                                                                                                                                              const lng = Number(point?.geo?.lng);

                                                                                                                                                                  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                                                                                                                                                                      const marker = L.marker([lat, lng]).addTo(map);
                                                                                                                                                                          marker.bindPopup(`
                                                                                                                                                                                <strong>${point.name || "Ponto de coleta"}</strong><br>
                                                                                                                                                                                      ${point.address || "Endereço não informado"}<br>
                                                                                                                                                                                            Tipo: ${point.type || "seletiva"}
                                                                                                                                                                                                `);

                                                                                                                                                                                                    territoryMarkers.push(marker);
                                                                                                                                                                                                        bounds.push([lat, lng]);
                                                                                                                                                                                                          });

                                                                                                                                                                                                            if (bounds.length === 1) {
                                                                                                                                                                                                                map.setView(bounds[0], 14);
                                                                                                                                                                                                                  } else if (bounds.length > 1) {
                                                                                                                                                                                                                      map.fitBounds(bounds, { padding: [30, 30] });
                                                                                                                                                                                                                        }

                                                                                                                                                                                                                          setTimeout(() => {
                                                                                                                                                                                                                              map.invalidateSize();
                                                                                                                                                                                                                                }, 120);
                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                /* FIRESTORE */
                                                                                                                                                                                                                                async function loadParticipants(territoryId) {
                                                                                                                                                                                                                                  const q = query(
                                                                                                                                                                                                                                      collection(db, "participants"),
                                                                                                                                                                                                                                          where("territoryId", "==", territoryId)
                                                                                                                                                                                                                                            );

                                                                                                                                                                                                                                              const snap = await getDocs(q);
                                                                                                                                                                                                                                                return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                async function loadColetas(territoryId) {
                                                                                                                                                                                                                                                  const q = query(
                                                                                                                                                                                                                                                      collection(db, "coletas"),
                                                                                                                                                                                                                                                          where("territoryId", "==", territoryId)
                                                                                                                                                                                                                                                            );

                                                                                                                                                                                                                                                              const snap = await getDocs(q);
                                                                                                                                                                                                                                                                return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                                async function loadPontosColeta(territoryId) {
                                                                                                                                                                                                                                                                  const q = query(
                                                                                                                                                                                                                                                                      collection(db, "pontos_coleta"),
                                                                                                                                                                                                                                                                          where("territoryId", "==", territoryId)
                                                                                                                                                                                                                                                                            );

                                                                                                                                                                                                                                                                              const snap = await getDocs(q);
                                                                                                                                                                                                                                                                                return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                                                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                                                /* UI */
                                                                                                                                                                                                                                                                                function fillTerritoryHeader(profile) {
                                                                                                                                                                                                                                                                                  const heroName =
                                                                                                                                                                                                                                                                                      profile.territoryShortName ||
                                                                                                                                                                                                                                                                                          profile.territoryName ||
                                                                                                                                                                                                                                                                                              profile.territoryLabel ||
                                                                                                                                                                                                                                                                                                  "Território";

                                                                                                                                                                                                                                                                                                    setText(els.territoryHeroTitle, heroName, "Território");
                                                                                                                                                                                                                                                                                                      setText(
                                                                                                                                                                                                                                                                                                          els.territoryHeroLead,
                                                                                                                                                                                                                                                                                                              profile.territoryLead ||
                                                                                                                                                                                                                                                                                                                    "Página territorial com visão integrada da operação local, indicadores, cooperativa vinculada, mapa de referência e acessos rápidos para as rotinas do território."
                                                                                                                                                                                                                                                                                                                      );

                                                                                                                                                                                                                                                                                                                        setText(els.territoryLabelText, profile.territoryLabel, "Território");
                                                                                                                                                                                                                                                                                                                          setText(els.territoryRegionText, profile.regionLabel || "Porto Alegre / RS");
                                                                                                                                                                                                                                                                                                                            setText(els.territoryProfileText, profile.territoryProfile || "Operação comunitária e cooperativa");
                                                                                                                                                                                                                                                                                                                              setText(
                                                                                                                                                                                                                                                                                                                                  els.territoryFocusText,
                                                                                                                                                                                                                                                                                                                                      profile.territoryFocus || "Coleta seletiva, triagem e fortalecimento territorial"
                                                                                                                                                                                                                                                                                                                                        );

                                                                                                                                                                                                                                                                                                                                          setText(els.coopNameText, profile.territoryLabel || "Cooperativa");
                                                                                                                                                                                                                                                                                                                                            setText(
                                                                                                                                                                                                                                                                                                                                                els.coopDescriptionText,
                                                                                                                                                                                                                                                                                                                                                    profile.coopDescription ||
                                                                                                                                                                                                                                                                                                                                                          "Núcleo territorial com atuação na triagem, articulação comunitária e fortalecimento da cadeia local de reciclagem."
                                                                                                                                                                                                                                                                                                                                                            );
                                                                                                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                                                                                                            function fillStats({ participants, coletas, pontos }) {
                                                                                                                                                                                                                                                                                                                                                              const totalParticipants = participants.length;
                                                                                                                                                                                                                                                                                                                                                                const totalColetas = coletas.length;
                                                                                                                                                                                                                                                                                                                                                                  const totalVolumeKg = sumColetasVolume(coletas);
                                                                                                                                                                                                                                                                                                                                                                    const totalPontos = pontos.length;

                                                                                                                                                                                                                                                                                                                                                                      if (els.cooperadosValue) els.cooperadosValue.textContent = String(totalParticipants);
                                                                                                                                                                                                                                                                                                                                                                        if (els.coletasValue) els.coletasValue.textContent = String(totalColetas);
                                                                                                                                                                                                                                                                                                                                                                          if (els.volumeValue) els.volumeValue.textContent = formatTon(totalVolumeKg);
                                                                                                                                                                                                                                                                                                                                                                            if (els.pontosValue) els.pontosValue.textContent = String(totalPontos);
                                                                                                                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                                                                                                                            async function bootPage(user) {
                                                                                                                                                                                                                                                                                                                                                                              const profile = await getUserProfile(user.uid);
                                                                                                                                                                                                                                                                                                                                                                                validateProfile(profile);

                                                                                                                                                                                                                                                                                                                                                                                  fillTerritoryHeader(profile);

                                                                                                                                                                                                                                                                                                                                                                                    const [participants, coletas, pontos] = await Promise.all([
                                                                                                                                                                                                                                                                                                                                                                                        loadParticipants(profile.territoryId),
                                                                                                                                                                                                                                                                                                                                                                                            loadColetas(profile.territoryId),
                                                                                                                                                                                                                                                                                                                                                                                                loadPontosColeta(profile.territoryId)
                                                                                                                                                                                                                                                                                                                                                                                                  ]);

                                                                                                                                                                                                                                                                                                                                                                                                    fillStats({ participants, coletas, pontos });
                                                                                                                                                                                                                                                                                                                                                                                                      renderMapPoints(pontos);
                                                                                                                                                                                                                                                                                                                                                                                                      }

                                                                                                                                                                                                                                                                                                                                                                                                      onAuthStateChanged(auth, async (user) => {
                                                                                                                                                                                                                                                                                                                                                                                                        try {
                                                                                                                                                                                                                                                                                                                                                                                                            if (!user) {
                                                                                                                                                                                                                                                                                                                                                                                                                  window.location.href = "../html/login.html";
                                                                                                                                                                                                                                                                                                                                                                                                                        return;
                                                                                                                                                                                                                                                                                                                                                                                                                            }

                                                                                                                                                                                                                                                                                                                                                                                                                                await bootPage(user);
                                                                                                                                                                                                                                                                                                                                                                                                                                  } catch (error) {
                                                                                                                                                                                                                                                                                                                                                                                                                                      console.error("Erro ao carregar território:", error);
                                                                                                                                                                                                                                                                                                                                                                                                                                          alert(error.message || "Não foi possível carregar os dados do território.");
                                                                                                                                                                                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                                                                                                                                                                                            });