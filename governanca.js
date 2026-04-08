/* =========================
   NAVEGAÇÃO DAS SEÇÕES
========================= */

const navButtons = document.querySelectorAll(".gov-nav-btn");
const sections = document.querySelectorAll(".gov-section");

function showSection(sectionName) {
  navButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.section === sectionName);
  });

  sections.forEach((section) => {
    const isVisible = section.id === `section-${sectionName}`;
    section.classList.toggle("is-visible", isVisible);
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    showSection(btn.dataset.section);
  });
});

/* =========================
   MÉTRICAS INICIAIS
   depois você pode trocar
   pelos dados do Firebase
========================= */

const metrics = {
  crgrAtivos: 3,
  usuarios: 43,
  residencias: 23,
  brigadistas: 6,
  acoesAndamento: 7,
  acoesCriticas: 3,
  residuoSeco: 234,
  rejeito: 23
};

function setMetric(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value ?? 0);
}

function renderMetrics(data) {
  setMetric("metricCrgrAtivos", data.crgrAtivos);
  setMetric("metricUsuarios", data.usuarios);
  setMetric("metricResidencias", data.residencias);
  setMetric("metricBrigadistas", data.brigadistas);
  setMetric("metricAcoesAndamento", data.acoesAndamento);
  setMetric("metricAcoesCriticas", data.acoesCriticas);
  setMetric("metricResiduoSeco", data.residuoSeco);
  setMetric("metricRejeito", data.rejeito);
}

renderMetrics(metrics);

/* =========================
   GANCHO PARA FIREBASE
   deixe comentado por enquanto
========================= */


import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));

  if (!userSnap.exists()) {
    window.location.href = "./login.html";
    return;
  }

  const userData = userSnap.data();

  const isGovernanca =
    userData?.status === "active" &&
    (
      userData?.role === "governanca" ||
      (userData?.roles && userData.roles.governanca === true)
    );

  if (!isGovernanca) {
    window.location.href = "./cooperativas.html";
    return;
  }

  await loadDashboard();
});

async function loadDashboard() {
  const territoriesSnap = await getDocs(collection(db, "territories"));
  const usersSnap = await getDocs(collection(db, "users"));
  const participantsSnap = await getDocs(collection(db, "participants"));
  const coletasSnap = await getDocs(collection(db, "coletas"));

  const territories = territoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const participants = participantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const coletas = coletasSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const data = {
    crgrAtivos: territories.filter((t) => t.active !== false).length,
    usuarios: users.length,
    residencias: participants.length,
    brigadistas: users.filter((u) => u.role === "brigadista").length,
    acoesAndamento: 0,
    acoesCriticas: 0,
    residuoSeco: sumColetasKg(coletas, "seco"),
    rejeito: sumColetasKg(coletas, "rejeito")
  };

  renderMetrics(data);
}

function sumColetasKg(coletas, tipo) {
  let total = 0;

  for (const coleta of coletas) {
    if (!coleta?.recebimento) continue;

    for (const key in coleta.recebimento) {
      const item = coleta.recebimento[key];
      if (!item) continue;

      if (tipo === "seco" && typeof item.peso === "number") {
        total += item.peso;
      }

      if (tipo === "rejeito" && key.toLowerCase().includes("rejeito")) {
        if (typeof item.peso === "number") total += item.peso;
      }
    }
  }

  return Math.round(total);
}
