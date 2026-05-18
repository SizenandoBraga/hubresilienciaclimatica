/* =========================================================
   DASHBOARD COOPERATIVA
   FULL VERSION • POWER BI PRO
   FIREBASE • CHARTS • KPIs • TABLE
========================================================= */

import { auth, db } from "./firebase-init.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  query,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
   ELEMENTOS
========================================================= */

const els = {

  mainChart:
    document.getElementById("mainChart"),

  weightTimelineChart:
    document.getElementById("weightTimelineChart"),

  secA:
    document.getElementById("secA"),

  secB:
    document.getElementById("secB"),

  secC:
    document.getElementById("secC"),

  tableColetasBody:
    document.getElementById("tableColetasBody"),

  tableVisibleCount:
    document.getElementById("tableVisibleCount"),

  tableFilteredCount:
    document.getElementById("tableFilteredCount"),

  tableLastUpdate:
    document.getElementById("tableLastUpdate"),

  txtPeriodo:
    document.getElementById("txtPeriodo"),

  txtRegistrosTopo:
    document.getElementById("txtRegistrosTopo"),

  k_totalColetas:
    document.getElementById("k_totalColetas"),

  k_participantes:
    document.getElementById("k_participantes"),

  k_residuoSeco:
    document.getElementById("k_residuoSeco"),

  k_rejeito:
    document.getElementById("k_rejeito"),

  k_finalTurno:
    document.getElementById("k_finalTurno")
};

/* =========================================================
   STATE
========================================================= */

const STATE = {

  coletas: [],
  participantes: [],

  charts: {

    main: null,
    weight: null,
    secA: null,
    secB: null,
    secC: null
  }
};

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {

  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function toNumber(value) {

  if (typeof value === "number") {

    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;
  }

  const parsed = Number(
    String(value)
      .trim()
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function formatKg(value) {

  return `${Number(value || 0)
    .toLocaleString("pt-BR")} kg`;
}

function formatDateBR(dateISO) {

  if (!dateISO) return "—";

  const [year, month, day] =
    String(dateISO).split("-");

  return `${day}/${month}/${year}`;
}

/* =========================================================
   RESOLVERS
========================================================= */

function inferDateISO(item = {}) {

  const possible =
    item.dataColeta ||
    item.coletaData ||
    item.createdAt ||
    item.createdAtISO ||
    item.data ||
    item.date ||
    item.payloadSnapshot?.dataColeta ||
    item.payloadSnapshot?.data ||
    null;

  if (!possible) return "";

  if (
    typeof possible?.toDate ===
    "function"
  ) {

    return possible
      .toDate()
      .toISOString()
      .slice(0, 10);
  }

  const parsed =
    new Date(possible);

  if (
    !Number.isNaN(parsed.getTime())
  ) {

    return parsed
      .toISOString()
      .slice(0, 10);
  }

  return "";
}

function inferFluxo(item = {}) {

  const value =
    item.flowType ||
    item.fluxo ||
    item.tipoColeta ||
    item.tipoRecebimento ||
    item.payloadSnapshot?.flowType ||
    "recebimento";

  const normalized =
    normalizeText(value)
      .replaceAll("-", "_");

  if (
    normalized.includes("final")
  ) {

    return "final_turno";
  }

  return "recebimento";
}

function inferPesoReciclavel(item = {}) {

  return (
    toNumber(item.pesoRecebido) ||
    toNumber(item.totalKg) ||
    toNumber(item.pesoTotal) ||
    toNumber(item.kg) ||
    toNumber(
      item.payloadSnapshot?.pesoRecebido
    ) ||
    0
  );
}

function inferPesoRejeito(item = {}) {

  return (
    toNumber(item.rejeito) ||
    toNumber(item.totalRejeito) ||
    toNumber(
      item.payloadSnapshot?.rejeito
    ) ||
    0
  );
}

function getParticipantCode(item = {}) {

  return String(
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.payloadSnapshot
      ?.participantCode ||
    ""
  ).trim();
}

function getParticipantName(item = {}) {

  return (
    item.participantName ||
    item.nomeParticipante ||
    item.nome ||
    item.payloadSnapshot
      ?.participantName ||
    getParticipantCode(item) ||
    "-"
  );
}

/* =========================================================
   DAILY SERIES
   AGRUPA POR DATA
========================================================= */

function buildDailySeries(items = []) {

  const map = new Map();

  items.forEach((item) => {

    const date =
      inferDateISO(item);

    if (!date) return;

    if (!map.has(date)) {

      map.set(date, 0);
    }

    map.set(
      date,
      map.get(date) + 1
    );
  });

  const ordered =
    Array.from(map.keys())
      .sort();

  return {

    labels: ordered.map((date) => {

      const [year, month, day] =
        date.split("-");

      return `${day}/${month}`;
    }),

    values: ordered.map((date) =>
      map.get(date)
    )
  };
}

/* =========================================================
   WEIGHT SERIES
========================================================= */

function buildWeightSeries(items = []) {

  const map = new Map();

  items.forEach((item) => {

    const date =
      inferDateISO(item);

    if (!date) return;

    if (!map.has(date)) {

      map.set(date, {

        reciclavel: 0,
        rejeito: 0
      });
    }

    const current =
      map.get(date);

    current.reciclavel +=
      inferPesoReciclavel(item);

    current.rejeito +=
      inferPesoRejeito(item);
  });

  const ordered =
    Array.from(map.keys())
      .sort();

  return {

    labels: ordered.map((date) => {

      const [year, month, day] =
        date.split("-");

      return `${day}/${month}`;
    }),

    reciclavel: ordered.map((date) =>
      map.get(date).reciclavel
    ),

    rejeito: ordered.map((date) =>
      map.get(date).rejeito
    )
  };
}

/* =========================================================
   FLOW SERIES
========================================================= */

function buildFlowSeries(items = []) {

  const flows = {

    recebimento: 0,
    final_turno: 0
  };

  items.forEach((item) => {

    const fluxo =
      inferFluxo(item);

    if (
      fluxo === "final_turno"
    ) {

      flows.final_turno += 1;

    } else {

      flows.recebimento += 1;
    }
  });

  return {

    labels: [

      "Recebimento",
      "Final do turno"
    ],

    values: [

      flows.recebimento,
      flows.final_turno
    ]
  };
}

/* =========================================================
   MATERIAL SERIES
========================================================= */

function buildMaterialSeries(items = []) {

  const totals = {

    plastico: 0,
    vidro: 0,
    papel: 0,
    metal: 0
  };

  items.forEach((item) => {

    totals.plastico +=
      toNumber(item.plasticoKg);

    totals.vidro +=
      toNumber(item.vidroKg);

    totals.papel +=
      toNumber(item.papelKg);

    totals.metal +=
      toNumber(item.aluminioMetalKg);
  });

  return {

    labels: [

      "Plástico",
      "Vidro",
      "Papel",
      "Metal"
    ],

    values: [

      totals.plastico,
      totals.vidro,
      totals.papel,
      totals.metal
    ]
  };
}

/* =========================================================
   TOP PARTICIPANTES
========================================================= */

function buildCollectionPointsSeries(items = []) {

  const map = new Map();

  items.forEach((item) => {

    const code =
      getParticipantCode(item);

    if (!code) return;

    if (!map.has(code)) {

      map.set(code, 0);
    }

    map.set(
      code,
      map.get(code) + 1
    );
  });

  const ordered =
    Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

  return {

    labels: ordered.map(
      ([label]) => label
    ),

    values: ordered.map(
      ([, value]) => value
    )
  };
}

/* =========================================================
   CHART OPTIONS
========================================================= */

function baseChartOptions() {

  return {

    responsive: true,

    maintainAspectRatio: false,

    plugins: {

      legend: {

        labels: {

          color: "#3C3A39",

          font: {

            size: 12,
            weight: "700"
          }
        }
      }
    },

    scales: {

      x: {

        grid: {

          display: false
        },

        ticks: {

          color: "#64748B"
        }
      },

      y: {

        beginAtZero: true,

        grid: {

          color:
            "rgba(148,163,184,.15)"
        },

        ticks: {

          color: "#64748B"
        }
      }
    }
  };
}

/* =========================================================
   RENDER CHARTS
========================================================= */

function renderCharts(items = []) {

  if (
    typeof Chart === "undefined"
  ) {

    return;
  }

  Object.values(
    STATE.charts
  ).forEach((chart) => {

    if (chart) {
      chart.destroy();
    }
  });

  const daily =
    buildDailySeries(items);

  const weights =
    buildWeightSeries(items);

  const flows =
    buildFlowSeries(items);

  const materials =
    buildMaterialSeries(items);

  const points =
    buildCollectionPointsSeries(items);

  /* =========================================
     MAIN CHART
  ========================================= */

  if (els.mainChart) {

    STATE.charts.main =
      new Chart(
        els.mainChart,
        {

          type: "bar",

          data: {

            labels:
              daily.labels,

            datasets: [
              {

                label:
                  "Quantidade de coletas",

                data:
                  daily.values,

                backgroundColor:
                  "rgba(83,172,222,.75)",

                borderRadius: 10,

                maxBarThickness: 42
              }
            ]
          },

          options:
            baseChartOptions()
        }
      );
  }

  /* =========================================
     PESOS
  ========================================= */

  if (
    els.weightTimelineChart
  ) {

    STATE.charts.weight =
      new Chart(
        els.weightTimelineChart,
        {

          type: "bar",

          data: {

            labels:
              weights.labels,

            datasets: [
              {

                label:
                  "Reciclável",

                data:
                  weights.reciclavel,

                backgroundColor:
                  "rgba(129,185,42,.78)",

                borderRadius: 10
              },

              {

                label:
                  "Rejeito",

                data:
                  weights.rejeito,

                backgroundColor:
                  "rgba(239,107,34,.78)",

                borderRadius: 10
              }
            ]
          },

          options:
            baseChartOptions()
        }
      );
  }

  /* =========================================
     FLUXOS
  ========================================= */

  if (els.secA) {

    STATE.charts.secA =
      new Chart(
        els.secA,
        {

          type: "doughnut",

          data: {

            labels:
              flows.labels,

            datasets: [
              {

                data:
                  flows.values,

                backgroundColor: [

                  "rgba(83,172,222,.85)",
                  "rgba(129,185,42,.85)"
                ],

                borderWidth: 0
              }
            ]
          },

          options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

              legend: {

                position:
                  "bottom"
              }
            }
          }
        }
      );
  }

  /* =========================================
     MATERIAIS
  ========================================= */

  if (els.secB) {

    STATE.charts.secB =
      new Chart(
        els.secB,
        {

          type: "bar",

          data: {

            labels:
              materials.labels,

            datasets: [
              {

                label:
                  "KG",

                data:
                  materials.values,

                backgroundColor:
                  "rgba(129,185,42,.75)",

                borderRadius: 10
              }
            ]
          },

          options:
            baseChartOptions()
        }
      );
  }

  /* =========================================
     TOP PARTICIPANTES
  ========================================= */

  if (els.secC) {

    STATE.charts.secC =
      new Chart(
        els.secC,
        {

          type: "bar",

          data: {

            labels:
              points.labels,

            datasets: [
              {

                label:
                  "Operações",

                data:
                  points.values,

                backgroundColor:
                  "rgba(239,107,34,.75)",

                borderRadius: 10
              }
            ]
          },

          options: {

            ...baseChartOptions(),

            indexAxis: "y"
          }
        }
      );
  }
}

/* =========================================================
   KPIs
========================================================= */

function renderKpis(items = []) {

  const participantes =
    new Set();

  let reciclavel = 0;
  let rejeito = 0;
  let finalTurno = 0;

  items.forEach((item) => {

    participantes.add(
      getParticipantCode(item)
    );

    reciclavel +=
      inferPesoReciclavel(item);

    rejeito +=
      inferPesoRejeito(item);

    if (
      inferFluxo(item) ===
      "final_turno"
    ) {

      finalTurno += 1;
    }
  });

  if (els.k_totalColetas) {

    els.k_totalColetas.textContent =
      items.length;
  }

  if (els.k_participantes) {

    els.k_participantes.textContent =
      participantes.size;
  }

  if (els.k_residuoSeco) {

    els.k_residuoSeco.textContent =
      formatKg(reciclavel);
  }

  if (els.k_rejeito) {

    els.k_rejeito.textContent =
      formatKg(rejeito);
  }

  if (els.k_finalTurno) {

    els.k_finalTurno.textContent =
      finalTurno;
  }

  if (els.txtRegistrosTopo) {

    els.txtRegistrosTopo.textContent =
      `${items.length} registros`;
  }

  if (els.tableVisibleCount) {

    els.tableVisibleCount.textContent =
      items.length;
  }

  if (els.tableFilteredCount) {

    els.tableFilteredCount.textContent =
      items.length;
  }

  if (els.tableLastUpdate) {

    els.tableLastUpdate.textContent =
      new Date()
        .toLocaleString("pt-BR");
  }
}

/* =========================================================
   TABELA
========================================================= */

function renderTable(items = []) {

  if (
    !els.tableColetasBody
  ) {
    return;
  }

  if (!items.length) {

    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="7">
          Nenhuma coleta encontrada.
        </td>
      </tr>
    `;

    return;
  }

  els.tableColetasBody.innerHTML =
    items.map((item) => {

      return `
        <tr>

          <td>
            ${formatDateBR(
              inferDateISO(item)
            )}
          </td>

          <td>
            ${getParticipantName(item)}
          </td>

          <td>
            ${getParticipantCode(item)}
          </td>

          <td>
            ${inferFluxo(item)}
          </td>

          <td>
            ${formatKg(
              inferPesoReciclavel(item)
            )}
          </td>

          <td>
            ${formatKg(
              inferPesoRejeito(item)
            )}
          </td>

          <td>
            <button
              class="table-action-link"
            >
              Ver coleta
            </button>
          </td>

        </tr>
      `;
    })
    .join("");
}

/* =========================================================
   RENDER ALL
========================================================= */

function renderAll() {

  renderKpis(
    STATE.coletas
  );

  renderCharts(
    STATE.coletas
  );

  renderTable(
    STATE.coletas
  );
}

/* =========================================================
   FIREBASE
========================================================= */

function listenCollections() {

  const qColetas =
    query(
      collection(
        db,
        "coletas"
      )
    );

  onSnapshot(
    qColetas,

    (snapshot) => {

      STATE.coletas =
        snapshot.docs.map(
          (doc) => ({

            id: doc.id,
            ...doc.data()
          })
        );

      renderAll();
    }
  );

  const qParticipantes =
    query(
      collection(
        db,
        "participants"
      )
    );

  onSnapshot(
    qParticipantes,

    (snapshot) => {

      STATE.participantes =
        snapshot.docs.map(
          (doc) => ({

            id: doc.id,
            ...doc.data()
          })
        );
    }
  );
}

/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(
  auth,

  async (user) => {

    if (!user) {

      window.location.href =
        "login.html";

      return;
    }

    listenCollections();
  }
);