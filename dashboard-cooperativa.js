/* =========================
   GRÁFICOS
========================= */

function getChartOptions(type, horizontal = false) {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom"
      }
    }
  };

  if (type === "doughnut" || type === "pie") return base;

  return {
    ...base,
    scales: horizontal
      ? { x: { beginAtZero: true } }
      : { y: { beginAtZero: true } }
  };
}

function renderWeightTimeline(items) {
  const canvas = document.getElementById("weightTimelineChart");
  if (!canvas || typeof Chart === "undefined") return;

  const valid = [...items]
    .filter((item) => getStatus(item) !== "cancelado")
    .sort((a, b) => String(inferDateTimeISO(a)).localeCompare(String(inferDateTimeISO(b))))
    .slice(-40);

  const labels = valid.map((item) => String(inferDateISO(item)).slice(5, 10));
  const reciclavel = valid.map((item) => {
    const somaMateriais = MATERIAL_META.reduce((acc, mat) => acc + getMaterialValue(item, mat.key), 0);
    return isFinalTurno(item) ? somaMateriais : (somaMateriais > 0 ? somaMateriais : inferResiduoSeco(item));
  });
  const rejeito = valid.map((item) => inferRejeito(item));

  if (weightTimelineChart) weightTimelineChart.destroy();

  weightTimelineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Peso do rejeito", data: rejeito, backgroundColor: "rgba(239,107,34,.75)" },
        { label: "Peso do reciclável", data: reciclavel, backgroundColor: "rgba(129,185,42,.75)" }
      ]
    },
    options: getChartOptions("bar")
  });
}

function buildDailySeries(items) {
  const map = new Map();
  items.filter((i) => getStatus(i) !== "cancelado").forEach((item) => {
    const d = inferDateISO(item);
    if (d) map.set(d, (map.get(d) || 0) + 1);
  });
  const labels = Array.from(map.keys()).sort();
  return { labels, values: labels.map((l) => map.get(l)) };
}

function buildFlowSeries(items) {
  const map = { recebimento: 0, final_turno: 0 };
  items.filter((i) => getStatus(i) !== "cancelado").forEach((item) => {
    const fluxo = inferFluxo(item);
    if (map[fluxo] !== undefined) map[fluxo] += 1;
  });
  return {
    labels: ["recebimento", "final_turno"],
    values: [map.recebimento, map.final_turno]
  };
}

function buildMaterialSeries(items) {
  const totals = sumMaterials(items);
  const filtered = MATERIAL_META.filter((mat) => (totals[mat.key] || 0) > 0);
  return {
    labels: filtered.map((m) => m.label),
    values: filtered.map((m) => totals[m.key] || 0)
  };
}

function buildCollectionPointsSeries(items) {
  const map = new Map();
  items.filter((i) => getStatus(i) !== "cancelado").forEach((item) => {
    const participant = resolveParticipant(item);
    const key = participant.localColeta || participant.address || inferEntrega(item) || "Ponto não informado";
    map.set(key, (map.get(key) || 0) + 1);
  });
  const labels = Array.from(map.keys());
  return { labels, values: labels.map((l) => map.get(l)) };
}

function renderCharts(items) {
  const ctxMain = document.getElementById("mainChart");
  const ctxA = document.getElementById("secA");
  const ctxB = document.getElementById("secB");
  const ctxC = document.getElementById("secC");

  if (typeof Chart === "undefined") return;
  if (!ctxMain && !ctxA && !ctxB && !ctxC) return;

  [mainChart, secA, secB, secC].forEach((chart) => {
    if (chart) chart.destroy();
  });

  const daily = buildDailySeries(items);
  const flow = buildFlowSeries(items);
  const material = buildMaterialSeries(items);
  const points = buildCollectionPointsSeries(items);

  const mainType = els.chartMainType?.value || "line";
  const flowType = els.chartFlowType?.value || "doughnut";
  const materialType = els.chartDeliveryType?.value || "bar";
  const pointsType = els.chartTerritoryType?.value || "bar";

  if (ctxMain) {
    mainChart = new Chart(ctxMain, {
      type: mainType,
      data: {
        labels: daily.labels,
        datasets: [{
          label: "Quantidade de coletas",
          data: daily.values,
          borderColor: CHART_COLORS.blue,
          backgroundColor: "rgba(83,172,222,.20)",
          fill: mainType === "line",
          tension: 0.35,
          pointRadius: mainType === "line" ? 4 : 0
        }]
      },
      options: getChartOptions(mainType)
    });
  }

  if (ctxA) {
    secA = new Chart(ctxA, {
      type: flowType,
      data: {
        labels: flow.labels,
        datasets: [{
          label: "Tipos de coletas",
          data: flow.values,
          backgroundColor: ["rgba(83,172,222,.78)", "rgba(129,185,42,.78)"],
          borderColor: [CHART_COLORS.blue, CHART_COLORS.green],
          borderWidth: flowType === "bar" ? 1.5 : 0
        }]
      },
      options: getChartOptions(flowType)
    });
  }

  if (ctxB) {
    secB = new Chart(ctxB, {
      type: materialType,
      data: {
        labels: material.labels,
        datasets: [{
          label: "Coletas por materiais",
          data: material.values,
          backgroundColor: material.labels.map(() => "rgba(129,185,42,.40)"),
          borderColor: material.labels.map(() => CHART_COLORS.green),
          borderWidth: materialType === "line" ? 3 : 1.5,
          fill: materialType === "line"
        }]
      },
      options: getChartOptions(materialType)
    });
  }

  if (ctxC) {
    secC = new Chart(ctxC, {
      type: pointsType,
      data: {
        labels: points.labels,
        datasets: [{
          label: "Pontos de coleta",
          data: points.values,
          backgroundColor: points.labels.map(() => "rgba(83,172,222,.28)"),
          borderColor: points.labels.map(() => CHART_COLORS.blue),
          borderWidth: pointsType === "line" ? 3 : 1.5,
          fill: pointsType === "line"
        }]
      },
      options: {
        ...getChartOptions(pointsType, pointsType === "bar"),
        indexAxis: pointsType === "bar" ? "y" : "x"
      }
    });
  }
}

/* =========================
   MAPA E ROTA
========================= */

function getCoopBaseLatLng() {
  const aliases = getTerritoryAliases(pageTerritoryId);
  const territoryKey = aliases[0] || "vila-pinto";
  return COOP_BASES[territoryKey] || COOP_BASES["vila-pinto"];
}

function initCollectionRouteMap() {
  const mapEl = document.getElementById("collectionRouteMap");
  if (!mapEl || typeof L === "undefined") return;

  if (routeMap) {
    routeMap.invalidateSize();
    return;
  }

  const base = getCoopBaseLatLng();

  routeMap = L.map("collectionRouteMap", { zoomControl: true }).setView([base.lat, base.lng], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(routeMap);

  L.marker([base.lat, base.lng]).addTo(routeMap).bindPopup("Cooperativa");
}

function setRouteSummary(origin, dest, summary = null) {
  if (els.routeOriginLabel) els.routeOriginLabel.textContent = origin || "—";
  if (els.routeDestLabel) els.routeDestLabel.textContent = dest || "—";

  if (!summary) {
    if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = "—";
    if (els.routeTimeLabel) els.routeTimeLabel.textContent = "—";
    return;
  }

  const km = (summary.totalDistance || 0) / 1000;
  const min = Math.round((summary.totalTime || 0) / 60);

  if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
  if (els.routeTimeLabel) els.routeTimeLabel.textContent = `${min} min`;
}

function clearRouteControl() {
  if (routeControl && routeMap) {
    routeMap.removeControl(routeControl);
    routeControl = null;
  }
  if (destinationMarker && routeMap) {
    routeMap.removeLayer(destinationMarker);
    destinationMarker = null;
  }
}


function isValidLatLngPoint(point) {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/* Remove duplicados e limita pontos para evitar erro/travamento no OSRM público */
function sanitizeRoutePoints(points, limit = 24) {
  const seen = new Set();
  const valid = [];

  points.forEach((point) => {
    if (!isValidLatLngPoint(point)) return;

    const lat = Number(point.lat);
    const lng = Number(point.lng);
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;

    if (seen.has(key)) return;
    seen.add(key);

    valid.push({
      ...point,
      lat,
      lng
    });
  });

  return valid.slice(0, limit);
}

function distanceApproxKm(a, b) {
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);

  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  const r = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);

  const h =
    s1 * s1 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      s2 * s2;

  return 2 * r * Math.asin(Math.sqrt(h));
}

/* Ordenação simples por vizinho mais próximo para deixar a rota mais prática */
function orderPointsNearestNeighbor(origin, points) {
  const remaining = [...points];
  const ordered = [];
  let current = origin;

  while (remaining.length) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((point, index) => {
      const d = distanceApproxKm(current, point);
      if (d < bestDistance) {
        bestDistance = d;
        bestIndex = index;
      }
    });

    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }

  return ordered;
}

function clearFullCollectionRoute() {
  if (routeFullLayer && routeMap) {
    routeMap.removeLayer(routeFullLayer);
    routeFullLayer = null;
  }

  if (routeMarkersLayer && routeMap) {
    routeMap.removeLayer(routeMarkersLayer);
    routeMarkersLayer = null;
  }
}

/*
  Rota geral da coleta:
  - origem: cooperativa
  - destino: pontos filtrados da tabela/dashboard
  - formato OSRM: longitude,latitude
*/
async function drawFullCollectionRoute(points) {
  if (!routeMap || typeof L === "undefined") return;

  const requestId = ++routeRequestSeq;
  const base = getCoopBaseLatLng();
  const origin = {
    lat: Number(base.lat),
    lng: Number(base.lng),
    name: "Cooperativa",
    code: "Origem"
  };

  const validPoints = sanitizeRoutePoints(points, 24);
  clearRouteControl();
  clearFullCollectionRoute();

  routeMarkersLayer = L.layerGroup().addTo(routeMap);

  L.marker([origin.lat, origin.lng])
    .addTo(routeMarkersLayer)
    .bindPopup("<strong>Cooperativa</strong><br>Origem da rota");

  validPoints.forEach((point, index) => {
    L.marker([point.lat, point.lng])
      .addTo(routeMarkersLayer)
      .bindPopup(`
        <strong>${escapeHtml(point.name || "Ponto de coleta")}</strong><br>
        Código: ${escapeHtml(point.code || "—")}<br>
        Ordem sugerida: ${index + 1}
      `);
  });

  if (!validPoints.length) {
    setRouteSummary("Cooperativa", "Nenhum ponto com coordenadas", null);
    routeMap.setView([origin.lat, origin.lng], 12);
    return;
  }

  const ordered = orderPointsNearestNeighbor(origin, validPoints);
  const osrmPoints = [origin, ...ordered];

  const coords = osrmPoints
    .map((point) => `${Number(point.lng)},${Number(point.lat)}`)
    .join(";");

  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  try {
    setRouteSummary("Cooperativa", `${ordered.length} ponto(s) de coleta`, null);

    const response = await fetch(url);

    if (requestId !== routeRequestSeq) return;

    if (!response.ok) {
      throw new Error(`Falha ao calcular rota real. Status ${response.status}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route?.geometry) {
      throw new Error("OSRM não retornou geometria da rota.");
    }

    routeFullLayer = L.geoJSON(route.geometry, {
      style: {
        color: "#53ACDE",
        opacity: 0.92,
        weight: 6
      }
    }).addTo(routeMap);

    const km = (route.distance || 0) / 1000;
    const min = Math.round((route.duration || 0) / 60);

    if (els.routeOriginLabel) els.routeOriginLabel.textContent = "Cooperativa";
    if (els.routeDestLabel) els.routeDestLabel.textContent = `${ordered.length} ponto(s) de coleta`;
    if (els.routeDistanceLabel) {
      els.routeDistanceLabel.textContent = `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
    }
    if (els.routeTimeLabel) {
      els.routeTimeLabel.textContent = `${min} min`;
    }

    const bounds = routeFullLayer.getBounds();
    if (bounds.isValid()) {
      routeMap.fitBounds(bounds, { padding: [28, 28] });
    }
  } catch (error) {
    console.error("Erro ao calcular rota da coleta:", error);

    const bounds = L.latLngBounds([
      [origin.lat, origin.lng],
      ...validPoints.map((point) => [point.lat, point.lng])
    ]);

    if (bounds.isValid()) {
      routeMap.fitBounds(bounds, { padding: [28, 28] });
    }

    if (els.routeOriginLabel) els.routeOriginLabel.textContent = "Cooperativa";
    if (els.routeDestLabel) els.routeDestLabel.textContent = `${validPoints.length} ponto(s) sem rota real`;
    if (els.routeDistanceLabel) els.routeDistanceLabel.textContent = "rota indisponível";
    if (els.routeTimeLabel) els.routeTimeLabel.textContent = "—";
  }
}


function drawRouteToPoint(point) {
  if (!routeMap || !point?.lat || !point?.lng || typeof L === "undefined" || !L.Routing) return;

  const base = getCoopBaseLatLng();
  clearFullCollectionRoute();
  clearRouteControl();

  destinationMarker = L.marker([point.lat, point.lng]).addTo(routeMap).bindPopup(point.name || "Destino");

  routeControl = L.Routing.control({
    waypoints: [L.latLng(base.lat, base.lng), L.latLng(point.lat, point.lng)],
    routeWhileDragging: false,
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false,
    lineOptions: {
      styles: [{ color: "#53ACDE", opacity: 0.9, weight: 6 }]
    },
    createMarker: () => null
  }).addTo(routeMap);

  routeControl.on("routesfound", (e) => {
    const route = e.routes?.[0];
    setRouteSummary("Cooperativa", point.name || "Ponto de coleta", route?.summary || null);
  });

  setRouteSummary("Cooperativa", point.name || "Ponto de coleta", null);
}

function getParticipantPointDataFromMapItems(items) {
  const map = new Map();

  items.forEach((item) => {
    const participant = resolveParticipant(item);
    if (!participant.name || participant.name === "Sem participante vinculado") return;
    if (!participant.lat || !participant.lng) return;

    const key = participant.code || participant.name;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: participant.name,
        code: participant.code,
        address: participant.address || "Endereço não informado",
        localColeta: participant.localColeta || inferEntrega(item) || "Coleta",
        territory: inferTerritorio(item),
        lat: participant.lat,
        lng: participant.lng
      });
    }
  });

  return Array.from(map.values());
}

function renderCollectionPoints(items) {
  initCollectionRouteMap();
  if (!els.collectionPointsGrid) return;

  const points = getParticipantPointDataFromMapItems(items);

  if (!points.length) {
    els.collectionPointsGrid.innerHTML = `
      <div class="point-card">
        <h4>Pontos de coleta</h4>
        <div class="point-address">Nenhum ponto de coleta com coordenadas cadastrado para os filtros atuais.</div>
      </div>
    `;
    setRouteSummary("—", "—", null);
    clearRouteControl();
    clearFullCollectionRoute();
    return;
  }

  els.collectionPointsGrid.innerHTML = points.map((point) => `
    <article class="point-card ${selectedPointKey === point.key ? "active" : ""}" data-route-point="${escapeHtml(point.key)}">
      <div class="point-code">${escapeHtml(point.code || "sem código")}</div>
      <h4>${escapeHtml(point.name)}</h4>
      <div class="point-address">${escapeHtml(point.address || "Endereço não informado")}</div>
      <div class="point-meta">
        <span class="point-chip">📍 ${escapeHtml(point.localColeta || "Coleta")}</span>
        <span class="point-chip">🗺️ ${escapeHtml(point.territory || "Território")}</span>
      </div>
    </article>
  `).join("");

  if (!selectedPointKey) selectedPointKey = points[0].key;

  /* Desenha a rota geral da coleta usando todos os pontos filtrados com coordenadas */
  drawFullCollectionRoute(points);
}

/* =========================
   TABELA
========================= */

function renderStatusBadge(item) {
  const status = getStatus(item);

  if (status === "cancelado") {
    return `<span class="status-badge status-cancelado">Cancelado</span>`;
  }
  if (item.updatedAt) {
    return `<span class="status-badge status-editado">Editado</span>`;
  }
  return `<span class="status-badge status-ok">Ativo</span>`;
}

function resolveHumanStatus(item) {
  const status = getStatus(item);
  if (status === "cancelado") return "cancelado";
  if (item.updatedAt) return "editado";
  return "ativo";
}

function getParticipantTypeForTable(item) {
  const participant = resolveParticipant(item);
  const type = normalizeText(participant.type);
  if (type === "participante" || type === "condominio" || type === "comercio") return type;
  return "outro";
}

function populateTableFilters(items) {
  if (!els.tEntrega) return;
  const entregas = new Set();
  items.forEach((item) => {
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "—") entregas.add(entrega);
  });

  const current = els.tEntrega.value || "__all__";
  els.tEntrega.innerHTML =
    `<option value="__all__">Todas</option>` +
    Array.from(entregas)
      .sort()
      .map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`)
      .join("");

  els.tEntrega.value = Array.from(entregas).includes(current) ? current : "__all__";
}

function updateTableSummary() {
  if (els.tableVisibleCount) els.tableVisibleCount.textContent = String(tableFilteredColetas.length);
  if (els.tableFilteredCount) els.tableFilteredCount.textContent = String(filteredColetas.length);
  if (els.tableLastUpdate) {
    const latest = tableFilteredColetas[0] ? inferDateTimeISO(tableFilteredColetas[0]) : "";
    els.tableLastUpdate.textContent = latest ? formatDateTimeBR(latest) : "—";
  }
}

function openCollectionDetailsModal(itemId) {
  const item = allColetas.find((x) => x.id === itemId);
  if (!item) return;

  const modal = ensureCollectionDetailsModal();
  const content = document.getElementById("collectionDetailsContent");
  if (!content) return;

  const participant = resolveParticipant(item);
  const photos = getColetaPhotoUrls(item);

  const materialsHtml = ALL_MATERIAL_META
    .map((mat) => {
      const value = getMaterialValue(item, mat.key);
      if (!value) return "";
      return `<div><strong>${escapeHtml(mat.label)}:</strong> ${formatKg(value)}</div>`;
    })
    .filter(Boolean)
    .join("");

  const rawPayload = escapeHtml(JSON.stringify(item, null, 2));

  content.innerHTML = `
    <div class="collection-details-grid">
      <div class="collection-details-fields">
        <div class="read-box"><strong>Data:</strong> ${escapeHtml(formatDateBR(inferDateISO(item)))}</div>
        <div class="read-box"><strong>Fluxo:</strong> ${escapeHtml(inferFluxo(item))}</div>
        <div class="read-box"><strong>Participante:</strong> ${escapeHtml(participant.name)}</div>
        <div class="read-box"><strong>Código:</strong> ${escapeHtml(participant.code)}</div>
        <div class="read-box"><strong>Entrega:</strong> ${escapeHtml(inferEntrega(item))}</div>
        <div class="read-box"><strong>Status:</strong> ${escapeHtml(resolveHumanStatus(item))}</div>
        <div class="read-box"><strong>Tipo cadastro:</strong> ${escapeHtml(inferParticipantExtraInfo(item))}</div>
        <div class="read-box"><strong>Criado por:</strong> ${escapeHtml(inferCreatorLabel(item))}</div>

        <div class="read-box collection-span-full">
          <strong>Endereço:</strong> ${escapeHtml(participant.address || "—")}
        </div>

        <div class="read-box"><strong>Resíduo seco:</strong> ${escapeHtml(formatKg(inferResiduoSeco(item)))}</div>
        <div class="read-box"><strong>Rejeito:</strong> ${escapeHtml(formatKg(inferRejeito(item)))}</div>
        <div class="read-box"><strong>Não comercializado:</strong> ${escapeHtml(formatKg(inferNaoComercializado(item)))}</div>
        <div class="read-box"><strong>Qualidade:</strong> ${escapeHtml(getQualidade(item) || "—")}</div>

        <div class="read-box collection-span-full">
          <strong>Observação:</strong> ${escapeHtml(inferObservacao(item) || "—")}
        </div>
      </div>

      <div class="read-box">
        <strong>Materiais informados</strong>
        <div class="collection-details-list">
          ${materialsHtml || "<div>Nenhum material detalhado informado.</div>"}
        </div>
      </div>

      <div class="read-box">
        <strong>Foto(s) do registro</strong>
        <div class="collection-details-actions">
          ${
            photos.length
              ? photos.map((url, index) => `
                  <button
                    type="button"
                    class="action-btn edit"
                    data-photo="${escapeHtml(url)}"
                  >
                    Abrir foto ${index + 1}
                  </button>
                `).join("")
              : `<div>Nenhuma foto vinculada ao registro.</div>`
          }
        </div>
      </div>

      <details class="read-box">
        <summary class="collection-details-summary">Ver payload salvo do registro</summary>
        <pre class="collection-details-payload">${rawPayload}</pre>
      </details>
    </div>
  `;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function renderMainTable(items) {
  if (!els.tableColetasBody) return;

  if (!items.length) {
    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="7">Nenhum registro encontrado para o filtro atual.</td>
      </tr>
    `;
    updateTableSummary();
    return;
  }

  els.tableColetasBody.innerHTML = items.map((item) => {
    const participant = resolveParticipant(item);
    const canceled = getStatus(item) === "cancelado";

    return `
      <tr class="${canceled ? "row-muted" : ""}">
        <td>${formatDateBR(inferDateISO(item))}</td>
        <td>${escapeHtml(participant.name)}</td>
        <td>${escapeHtml(participant.code)}</td>
        <td>${escapeHtml(inferFluxo(item))}</td>
        <td>${renderStatusBadge(item)}</td>
        <td>
          <button class="action-btn edit" type="button" data-view-details="${item.id}">
            Ver coleta
          </button>
        </td>
        <td>
          <div class="table-actions">
            <button class="action-btn edit" data-edit="${item.id}" ${canceled ? "disabled" : ""}>Editar</button>
            <button class="action-btn cancel" data-cancel="${item.id}" ${canceled ? "disabled" : ""}>Cancelar</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  updateTableSummary();
}

function applyTableFilters() {
  const search = normalizeText(els.tSearch?.value || "");
  const fluxo = els.tFluxo?.value || "__all__";
  const entrega = els.tEntrega?.value || "__all__";
  const status = els.tStatus?.value || "__all__";
  const tipoCadastro = els.tTipoCadastro?.value || "__all__";

  tableFilteredColetas = filteredColetas.filter((item) => {
    const participant = resolveParticipant(item);

    const haystack = normalizeText([
      participant.name,
      participant.code,
      inferObservacao(item),
      inferEntrega(item),
      inferFluxo(item),
      ...ALL_MATERIAL_META.map((m) => m.label)
    ].join(" "));

    if (search && !haystack.includes(search)) return false;
    if (fluxo !== "__all__" && inferFluxo(item) !== fluxo) return false;
    if (entrega !== "__all__" && inferEntrega(item) !== entrega) return false;
    if (status !== "__all__" && resolveHumanStatus(item) !== status) return false;
    if (tipoCadastro !== "__all__" && getParticipantTypeForTable(item) !== tipoCadastro) return false;

    return true;
  });

  renderMainTable(tableFilteredColetas);
}

/* =========================
   EXPORTAÇÕES
========================= */

async function exportToExcel() {
  try {
    const items = getExportBaseItems();

    if (!items.length) {
      alert("Nenhum registro encontrado para exportar.");
      return;
    }

    const XLSX = await ensureXLSX();
    const rows = getExportRows(items).map((row) => ({
      "Data": row.data,
      "Participante": row.participante,
      "Código": row.codigo,
      "Fluxo": row.fluxo,
      "Entrega": row.entrega,
      "Território": row.territorio,
      "Tipo cadastro": row.tipoCadastro,
      "Status": row.status,
      "Reciclável total (kg)": row.reciclavelKg,
      "Plástico (kg)": row.plasticoKg,
      "Vidro (kg)": row.vidroKg,
      "Metal / Alumínio (kg)": row.aluminioMetalKg,
      "Sacaria (kg)": row.sacariaKg,
      "Papel misto (kg)": row.papelMistoKg,
      "Papelão (kg)": row.papelaoKg,
      "Isopor (kg)": row.isoporKg,
      "Óleo de cozinha (kg)": row.oleoKg,
      "Rejeito (kg)": row.rejeitoKg,
      "Não comercializado (kg)": row.naoComercializadoKg,
      "Qualidade": row.qualidade,
      "Observação": row.observacao
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    const colWidths = [
      { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
      { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
      { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 12 },
      { wch: 40 }
    ];
    worksheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio");
    XLSX.writeFile(workbook, `relatorio-coletas_${buildExportFileStamp()}.xlsx`);
  } catch (error) {
    console.error("Erro ao exportar Excel:", error);
    alert("Não foi possível exportar o Excel.");
  }
}

async function exportToPDF() {
  try {
    const items = getExportBaseItems();

    if (!items.length) {
      alert("Nenhum registro encontrado para exportar.");
      return;
    }

    const jsPDF = await ensureJsPDF();
    const rows = getExportRows(items);

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    let y = 14;
    const marginX = 10;
    const rowHeight = 7;
    const colX = {
      data: 10,
      participante: 30,
      codigo: 95,
      fluxo: 128,
      entrega: 158,
      reciclavel: 196,
      rejeito: 225,
      status: 252
    };

    const drawHeader = () => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text("Relatório geral de coletas", marginX, y);
      y += 7;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(`Território: ${coopProfile?.territoryLabel || coopProfile?.territoryId || pageTerritoryId || "Território"}`, marginX, y);
      y += 5;
      pdf.text(`Período: ${els.txtPeriodo?.textContent || "—"}`, marginX, y);
      y += 5;
      pdf.text(`Registros exportados: ${rows.length}`, marginX, y);
      y += 8;

      pdf.setDrawColor(180);
      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 5;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text("Data", colX.data, y);
      pdf.text("Participante", colX.participante, y);
      pdf.text("Código", colX.codigo, y);
      pdf.text("Fluxo", colX.fluxo, y);
      pdf.text("Entrega", colX.entrega, y);
      pdf.text("Reciclável", colX.reciclavel, y, { align: "right" });
      pdf.text("Rejeito", colX.rejeito, y, { align: "right" });
      pdf.text("Status", colX.status, y);
      y += 3;

      pdf.line(marginX, y, pageWidth - marginX, y);
      y += 5;
    };

    const addPageIfNeeded = (extraHeight = rowHeight) => {
      if (y + extraHeight > pageHeight - 12) {
        pdf.addPage();
        y = 14;
        drawHeader();
      }
    };

    drawHeader();

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);

    rows.forEach((row) => {
      addPageIfNeeded(10);

      const participante = String(row.participante || "—").slice(0, 32);
      const codigo = String(row.codigo || "—").slice(0, 18);
      const fluxo = String(row.fluxo || "—").slice(0, 18);
      const entrega = String(row.entrega || "—").slice(0, 20);
      const status = String(row.status || "—").slice(0, 12);

      pdf.text(String(row.data || "—"), colX.data, y);
      pdf.text(participante, colX.participante, y);
      pdf.text(codigo, colX.codigo, y);
      pdf.text(fluxo, colX.fluxo, y);
      pdf.text(entrega, colX.entrega, y);
      pdf.text(formatNumber(row.reciclavelKg), colX.reciclavel, y, { align: "right" });
      pdf.text(formatNumber(row.rejeitoKg), colX.rejeito, y, { align: "right" });
      pdf.text(status, colX.status, y);

      y += rowHeight;
    });

    pdf.save(`relatorio-coletas_${buildExportFileStamp()}.pdf`);
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    alert("Não foi possível exportar o PDF.");
  }
}

/* =========================
   MODAIS / AÇÕES
========================= */

function openPhoto(url) {
  if (!url || !els.photoModal || !els.photoModalImg) return;

  const detailsModal = document.getElementById("collectionDetailsModal");
  if (detailsModal?.classList.contains("open")) {
    detailsModal.classList.remove("open");
    detailsModal.setAttribute("aria-hidden", "true");
  }

  els.photoModalImg.src = url;
  els.photoModal.classList.add("open");
  els.photoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (id === "photoModal") {
    const detailsModal = document.getElementById("collectionDetailsModal");
    if (detailsModal) {
      detailsModal.classList.add("open");
      detailsModal.setAttribute("aria-hidden", "false");
    }
  }

  const hasAnyOpenModal = document.querySelector(".modal.open");
  if (!hasAnyOpenModal) {
    document.body.classList.remove("modal-open");
  }
}


function openEditModal(itemId) {
  const item = allColetas.find((x) => x.id === itemId);
  if (!item) return;

  const participant = resolveParticipant(item);
  activeEditId = itemId;

  if (els.editParticipantName) els.editParticipantName.textContent = `${participant.name} • ${participant.code}`;
  if (els.editFluxo) els.editFluxo.value = inferFluxo(item) === "—" ? "recebimento" : inferFluxo(item);
  if (els.editEntrega) els.editEntrega.value = inferEntrega(item) === "—" ? "" : inferEntrega(item);
  if (els.editPesoBase) els.editPesoBase.value = String(inferResiduoSeco(item) || "");
  if (els.editQualidade) els.editQualidade.value = getQualidade(item);
  if (els.editRejeito) els.editRejeito.value = String(inferRejeito(item) || "");
  if (els.editNaoComercializado) els.editNaoComercializado.value = String(inferNaoComercializado(item) || "");

  /* Preenche as frações de resíduos, tanto de recebimento quanto de final de turno */
  if (els.editPlasticoKg) els.editPlasticoKg.value = String(getMaterialValue(item, "plasticoKg") || "");
  if (els.editVidroKg) els.editVidroKg.value = String(getMaterialValue(item, "vidroKg") || "");
  if (els.editAluminioMetalKg) els.editAluminioMetalKg.value = String(getMaterialValue(item, "aluminioMetalKg") || "");
  if (els.editSacariaKg) els.editSacariaKg.value = String(getMaterialValue(item, "sacariaKg") || "");
  if (els.editPapelMistoKg) els.editPapelMistoKg.value = String(getMaterialValue(item, "papelMistoKg") || "");
  if (els.editPapelaoKg) els.editPapelaoKg.value = String(getMaterialValue(item, "papelaoKg") || "");
  if (els.editIsoporKg) els.editIsoporKg.value = String(getMaterialValue(item, "isoporKg") || "");
  if (els.editOleoKg) els.editOleoKg.value = String(getMaterialValue(item, "oleoKg") || "");

  if (els.editObs) els.editObs.value = inferObservacao(item);

 if (els.editModal) {
  els.editModal.classList.add("open");
  els.editModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
}

async function saveEdit() {
  if (!activeEditId) return;

  const ref = doc(db, "coletas", activeEditId);
  const isEditFinalTurno = els.editFluxo?.value === "final_turno";

  const payload = {
    flowType: els.editFluxo?.value || "recebimento",
    deliveryType: els.editEntrega?.value?.trim?.() || "",
    observacao: els.editObs?.value?.trim?.() || "",
    updatedAt: serverTimestamp()
  };

  const qualityValue = els.editQualidade?.value ? Number(els.editQualidade.value) : null;

  const materiaisPayload = {
    plasticoKg: Number(els.editPlasticoKg?.value || 0),
    vidroKg: Number(els.editVidroKg?.value || 0),
    aluminioMetalKg: Number(els.editAluminioMetalKg?.value || 0),
    sacariaKg: Number(els.editSacariaKg?.value || 0),
    papelMistoKg: Number(els.editPapelMistoKg?.value || 0),
    papelaoKg: Number(els.editPapelaoKg?.value || 0),
    isoporKg: Number(els.editIsoporKg?.value || 0),
    oleoKg: Number(els.editOleoKg?.value || 0)
  };

  if (isEditFinalTurno) {
    payload["finalTurno.observacao"] = els.editObs?.value?.trim?.() || "";
    payload["finalTurno.pesoResiduoSecoKg"] = Number(els.editPesoBase?.value || 0);
    payload["finalTurno.qualidadeNota"] = qualityValue;
    payload["finalTurno.pesoRejeitoKg"] = Number(els.editRejeito?.value || 0);
    payload["finalTurno.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado?.value || 0);
    payload["finalTurno.materiais"] = materiaisPayload;
    payload.materiais = materiaisPayload;
  } else {
    payload["recebimento.observacao"] = els.editObs?.value?.trim?.() || "";
    payload["recebimento.pesoResiduoSecoKg"] = Number(els.editPesoBase?.value || 0);
    payload["recebimento.qualidadeNota"] = qualityValue;
    payload["recebimento.pesoRejeitoKg"] = Number(els.editRejeito?.value || 0);
    payload["recebimento.pesoNaoComercializadoKg"] = Number(els.editNaoComercializado?.value || 0);
    payload["recebimento.materiais"] = materiaisPayload;
    payload.materiais = materiaisPayload;
  }

  await updateDoc(ref, payload);

  closeModal("editModal");
  activeEditId = null;
}

async function cancelRegistro(itemId) {
  const ok = window.confirm(
    "Deseja realmente cancelar este registro? Ele continuará no histórico, mas não contará nos indicadores ativos."
  );
  if (!ok) return;

  const ref = doc(db, "coletas", itemId);
  await updateDoc(ref, {
    status: "cancelado",
    canceledAt: serverTimestamp()
  });
}

/* =========================
   UI
========================= */

function initCursorGlow() {
  const glow = document.getElementById("cursorGlow");
  if (!glow) return;

  window.addEventListener("mousemove", (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top = `${e.clientY}px`;
    glow.style.opacity = ".9";
  });

  window.addEventListener("mouseleave", () => {
    glow.style.opacity = "0";
  });
}

function bindUI() {
  ensureCollectionDetailsModal();
  ensureRefreshButton();
  
  document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal.open").forEach((modal) => {
      closeModal(modal.id);
    });
  }
});

  els.btnAplicar?.addEventListener("click", applyFilters);
  els.btnLimpar?.addEventListener("click", clearFilters);
  els.btnPrint?.addEventListener("click", () => window.print());
  els.btnExportPDF?.addEventListener("click", exportToPDF);
  els.btnExportExcel?.addEventListener("click", exportToExcel);
  els.btnSaveEdit?.addEventListener("click", saveEdit);

  els.fParticipantCode?.addEventListener("input", () => {
    showQuickParticipantPreviewByCode(els.fParticipantCode.value);
  });

  [
    els.chartMainType,
    els.chartFlowType,
    els.chartDeliveryType,
    els.chartTerritoryType
  ].forEach((el) => {
    el?.addEventListener("change", () => renderCharts(filteredColetas));
  });

  [
    els.fFluxo,
    els.fEntrega,
    els.fIni,
    els.fFim,
    els.fSearchType
  ].forEach((el) => {
    el?.addEventListener("change", applyFilters);
  });

  els.fBusca?.addEventListener("input", applyFilters);

  els.btnApplyTableFilters?.addEventListener("click", applyTableFilters);
  els.btnClearTableFilters?.addEventListener("click", () => {
    if (els.tSearch) els.tSearch.value = "";
    if (els.tFluxo) els.tFluxo.value = "__all__";
    if (els.tEntrega) els.tEntrega.value = "__all__";
    if (els.tStatus) els.tStatus.value = "__all__";
    if (els.tTipoCadastro) els.tTipoCadastro.value = "__all__";
    applyTableFilters();
  });

  document.addEventListener("click", async (event) => {
    const photo = event.target.closest("[data-photo]");
    if (photo) {
      openPhoto(photo.dataset.photo);
      return;
    }

    const routePointBtn = event.target.closest("[data-route-point]");
    if (routePointBtn) {
      selectedPointKey = routePointBtn.dataset.routePoint;
      renderCollectionPoints(filteredColetas);
      return;
    }

    const detailsBtn = event.target.closest("[data-view-details]");
    if (detailsBtn) {
      openCollectionDetailsModal(detailsBtn.dataset.viewDetails);
      return;
    }

    const editBtn = event.target.closest("[data-edit]");
    if (editBtn) {
      openEditModal(editBtn.dataset.edit);
      return;
    }

    const cancelBtn = event.target.closest("[data-cancel]");
    if (cancelBtn) {
      try {
        await cancelRegistro(cancelBtn.dataset.cancel);
      } catch (error) {
        console.error(error);
        alert("Não foi possível cancelar o registro.");
      }
      return;
    }


    const closer = event.target.closest("[data-close]");
    if (closer) {
      closeModal(closer.dataset.close);
    }
  });
}

/* =========================
   BOOT
========================= */

async function boot() {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  initCursorGlow();
  bindUI();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const profile = await getUserProfile(user.uid);
      validateProfile(profile);
      coopProfile = profile;

      pageTerritoryId = resolvePageTerritory(profile);

      if (!pageTerritoryId) {
        throw new Error("Território da página não definido.");
      }

      fillUser(profile);
      loadParticipantsMap();
      listenColetas();

      const urlParams = new URLSearchParams(window.location.search);
      const codigo = urlParams.get("codigo");
      if (codigo && els.fParticipantCode) {
        els.fParticipantCode.value = codigo;
        showQuickParticipantPreviewByCode(codigo);
      }
    } catch (error) {
      console.error("Erro ao iniciar dashboard:", error);
      alert(error.message || "Não foi possível carregar o dashboard.");
      window.location.href = "login.html";
    }
  });
}

boot();