import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

const STATE = {
  user: null,
  userDoc: null,
  raw: [],
  filtered: [],
  charts: {
    main: null,
    secA: null,
    secB: null,
    secC: null
  }
};

const COLOR = {
  green: "#81B92A",
  blue: "#53ACDE",
  orange: "#EF6B22",
  black: "#3C3A39"
};

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}

function fmtInt(n) {
  return (Number(n || 0)).toLocaleString("pt-BR");
}

function fmtKg(n) {
  return `${(Number(n || 0)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
}

function todayISO() {
  const d = new Date();
  const tzOff = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOff).toISOString().slice(0, 10);
}

function startOfMonthISO(d = new Date()) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  const tzOff = dt.getTimezoneOffset() * 60000;
  return new Date(dt.getTime() - tzOff).toISOString().slice(0, 10);
}

function unique(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function sum(arr, getter) {
  return arr.reduce((acc, item) => acc + (getter(item) || 0), 0);
}

function destroyChart(instance) {
  if (instance && typeof instance.destroy === "function") instance.destroy();
}

async function loadUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function canViewAll(role) {
  return ["admin", "governanca", "gestor"].includes(role || "");
}

function buildQuery(userDoc) {
  const baseRef = collection(db, "coletas");

  if (canViewAll(userDoc?.role)) {
    return query(baseRef, orderBy("createdAt", "desc"));
  }

  return query(
    baseRef,
    where("territoryId", "==", userDoc.territoryId),
    orderBy("createdAt", "desc")
  );
}

function normalizeRow(row) {
  const recebimento = row.recebimento || {};
  const finalTurno = row.finalTurno || {};

  const pesoBase =
    row.flowType === "recebimento"
      ? Number(recebimento.pesoResiduoSecoKg || 0)
      : Number(finalTurno.pesoRejeitoGeralKg || 0);

  const rejeito =
    Number(recebimento.pesoRejeitoKg || 0) +
    Number(finalTurno.pesoRejeitoGeralKg || 0);

  return {
    ...row,
    opDate: row.opDate || null,
    participantName: row.participantName || "—",
    participantCode: row.participantCode || "—",
    territoryLabel: row.territoryLabel || row.territoryId || "—",
    flowType: row.flowType || "—",
    deliveryType: row.deliveryType || "—",
    createdByName: row.createdByName || "—",
    observacao: row.observacao || recebimento.observacao || "",
    pesoBase,
    rejeito,
    recebimento,
    finalTurno
  };
}

function refreshFilterOptions() {
  const allRows = STATE.raw;

  const territorios = unique(allRows.map(r => r.territoryLabel));
  const entregas = unique(allRows.map(r => r.deliveryType));

  const fTerritorio = $("fTerritorio");
  const fEntrega = $("fEntrega");

  const tValue = fTerritorio.value || "__all__";
  const eValue = fEntrega.value || "__all__";

  fTerritorio.innerHTML =
    `<option value="__all__">Todos</option>` +
    territorios.map(v => `<option value="${v}">${v}</option>`).join("");

  fEntrega.innerHTML =
    `<option value="__all__">Todos</option>` +
    entregas.map(v => `<option value="${v}">${v}</option>`).join("");

  fTerritorio.value = territorios.includes(tValue) ? tValue : "__all__";
  fEntrega.value = entregas.includes(eValue) ? eValue : "__all__";
}

function applyFilters() {
  const territorio = $("fTerritorio").value;
  const fluxo = $("fFluxo").value;
  const entrega = $("fEntrega").value;
  const ini = $("fIni").value;
  const fim = $("fFim").value;
  const busca = ($("fBusca").value || "").trim().toLowerCase();

  STATE.filtered = STATE.raw.filter((row) => {
    if (territorio !== "__all__" && row.territoryLabel !== territorio) return false;
    if (fluxo !== "__all__" && row.flowType !== fluxo) return false;
    if (entrega !== "__all__" && row.deliveryType !== entrega) return false;

    if (ini && row.opDate && row.opDate < ini) return false;
    if (fim && row.opDate && row.opDate > fim) return false;

    if (busca) {
      const hay =
        `${row.participantName} ${row.participantCode} ${row.observacao} ${row.createdByName} ${row.territoryLabel}`.toLowerCase();
      if (!hay.includes(busca)) return false;
    }

    return true;
  });

  renderAll();
}

function clearFilters() {
  $("fTerritorio").value = "__all__";
  $("fFluxo").value = "__all__";
  $("fEntrega").value = "__all__";
  $("fIni").value = startOfMonthISO();
  $("fFim").value = todayISO();
  $("fBusca").value = "";
  applyFilters();
}

function summarize(rows) {
  const participantes = new Set();
  const territorios = new Set();
  const porData = new Map();
  const porFluxo = new Map();
  const porEntrega = new Map();
  const porTerritorio = new Map();

  for (const row of rows) {
    if (row.participantCode && row.participantCode !== "—") participantes.add(row.participantCode);
    if (row.territoryLabel) territorios.add(row.territoryLabel);

    porData.set(row.opDate, (porData.get(row.opDate) || 0) + 1);
    porFluxo.set(row.flowType, (porFluxo.get(row.flowType) || 0) + 1);
    porEntrega.set(row.deliveryType, (porEntrega.get(row.deliveryType) || 0) + 1);
    porTerritorio.set(row.territoryLabel, (porTerritorio.get(row.territoryLabel) || 0) + 1);
  }

  return {
    totalColetas: rows.length,
    participantesCount: participantes.size,
    totalResiduoSeco: sum(rows, r => Number(r.recebimento?.pesoResiduoSecoKg || 0)),
    totalRejeito: sum(rows, r => Number(r.rejeito || 0)),
    totalFinalTurno: rows.filter(r => r.flowType === "final_turno").length,
    territoriosAtivos: territorios.size,
    porData,
    porFluxo,
    porEntrega,
    porTerritorio
  };
}

function renderKpis(stats) {
  setText("k_totalColetas", fmtInt(stats.totalColetas));
  setText("k_participantes", fmtInt(stats.participantesCount));
  setText("k_residuoSeco", fmtKg(stats.totalResiduoSeco));
  setText("k_rejeito", fmtKg(stats.totalRejeito));
  setText("k_finalTurno", fmtInt(stats.totalFinalTurno));
  setText("k_territoriosAtivos", fmtInt(stats.territoriosAtivos));
  setText("txtRegistrosTopo", fmtInt(stats.totalColetas));
}

function renderMainChart(stats) {
  destroyChart(STATE.charts.main);

  const labels = Array.from(stats.porData.keys()).sort();
  const values = labels.map(label => stats.porData.get(label) || 0);

  STATE.charts.main = new Chart($("mainChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Registros",
        data: values,
        borderColor: COLOR.blue,
        backgroundColor: "rgba(83,172,222,.18)",
        fill: true,
        tension: .28,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#3C3A39", font: { weight: "700" } }
        }
      },
      scales: {
        x: {
          ticks: { color: "#6B6866" },
          grid: { color: "rgba(60,58,57,.06)" }
        },
        y: {
          ticks: { color: "#6B6866" },
          grid: { color: "rgba(60,58,57,.06)" }
        }
      }
    }
  });
}

function renderSecA(stats) {
  destroyChart(STATE.charts.secA);

  const labels = Array.from(stats.porFluxo.keys());
  const values = labels.map(label => stats.porFluxo.get(label) || 0);

  STATE.charts.secA = new Chart($("secA"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ["rgba(129,185,42,.70)", "rgba(83,172,222,.70)", "rgba(239,107,34,.70)"],
        borderColor: ["#81B92A", "#53ACDE", "#EF6B22"],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#3C3A39", font: { weight: "700" } }
        }
      }
    }
  });
}

function renderSecB(stats) {
  destroyChart(STATE.charts.secB);

  const labels = Array.from(stats.porEntrega.keys());
  const values = labels.map(label => stats.porEntrega.get(label) || 0);

  STATE.charts.secB = new Chart($("secB"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Entregas",
        data: values,
        backgroundColor: "rgba(129,185,42,.35)",
        borderColor: "#81B92A",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: "#6B6866" },
          grid: { display: false }
        },
        y: {
          ticks: { color: "#6B6866" },
          grid: { color: "rgba(60,58,57,.06)" }
        }
      }
    }
  });
}

function renderSecC(stats) {
  destroyChart(STATE.charts.secC);

  const labels = Array.from(stats.porTerritorio.keys());
  const values = labels.map(label => stats.porTerritorio.get(label) || 0);

  STATE.charts.secC = new Chart($("secC"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Territórios",
        data: values,
        backgroundColor: "rgba(83,172,222,.28)",
        borderColor: "#53ACDE",
        borderWidth: 2
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: "#6B6866" },
          grid: { color: "rgba(60,58,57,.06)" }
        },
        y: {
          ticks: { color: "#6B6866" },
          grid: { display: false }
        }
      }
    }
  });
}

function renderTable(rows) {
  const tbody = $("tableColetasBody");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">Nenhuma coleta encontrada no filtro atual.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .slice()
    .sort((a, b) => String(b.opDate || "").localeCompare(String(a.opDate || "")))
    .slice(0, 250)
    .map((row) => `
      <tr>
        <td>${row.opDate || "—"}</td>
        <td>${row.territoryLabel || "—"}</td>
        <td>${row.participantName || "—"}</td>
        <td>${row.participantCode || "—"}</td>
        <td>${row.flowType || "—"}</td>
        <td>${row.deliveryType || "—"}</td>
        <td>${row.createdByName || "—"}</td>
        <td>${fmtKg(row.pesoBase || 0)}</td>
        <td>${row.observacao || "—"}</td>
      </tr>
    `)
    .join("");
}

function renderAll() {
  const stats = summarize(STATE.filtered);
  renderKpis(stats);
  renderMainChart(stats);
  renderSecA(stats);
  renderSecB(stats);
  renderSecC(stats);
  renderTable(STATE.filtered);

  const ini = $("fIni").value || "—";
  const fim = $("fFim").value || "—";
  setText("txtPeriodo", `${ini} → ${fim}`);
}

function wireUI() {
  $("btnAplicar")?.addEventListener("click", applyFilters);
  $("btnLimpar")?.addEventListener("click", clearFilters);
  $("btnPrint")?.addEventListener("click", () => window.print());

  $("fBusca")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyFilters();
  });

  const glow = $("cursorGlow");
  const motionOK = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  if (glow && motionOK && !coarsePointer) {
    window.addEventListener("mousemove", (e) => {
      glow.style.left = e.clientX + "px";
      glow.style.top = e.clientY + "px";
      glow.style.opacity = "1";
    });

    window.addEventListener("mouseleave", () => {
      glow.style.opacity = "0";
    });
  }
}

async function bootstrapDashboard(user) {
  STATE.user = user;
  const userDoc = await loadUserDoc(user.uid);
  STATE.userDoc = userDoc;

  if (!userDoc) {
    alert("Usuário sem perfil no Firestore.");
    window.location.href = "./index.html";
    return;
  }

  setText("userDisplayName", user.displayName || userDoc.name || user.email || "Usuário");
  setText("userRole", userDoc.role || "—");
  setText("userTerritory", userDoc.territoryLabel || userDoc.territoryId || "—");
  setText("dbStatus", "conectado");

  const qy = buildQuery(userDoc);

  onSnapshot(qy, (snap) => {
    STATE.raw = snap.docs.map(d => normalizeRow({ id: d.id, ...d.data() }));

    refreshFilterOptions();

    if (!$("fIni").value) $("fIni").value = startOfMonthISO();
    if (!$("fFim").value) $("fFim").value = todayISO();

    applyFilters();
  }, (err) => {
    console.error("Erro ao ler coletas:", err);
    setText("dbStatus", "erro");
  });
}

async function init() {
  wireUI();

  setText("year", new Date().getFullYear());
  $("fIni").value = startOfMonthISO();
  $("fFim").value = todayISO();

  try {
    await auth.authStateReady();

    const user = auth.currentUser;
    if (!user) {
      window.location.href = "./index.html";
      return;
    }

    await bootstrapDashboard(user);

    onAuthStateChanged(auth, (nextUser) => {
      if (!nextUser) window.location.href = "./index.html";
    });
  } catch (e) {
    console.error(e);
    setText("dbStatus", "erro");
  }
}

init();