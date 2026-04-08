/**
 * =========================================================
 * VILA PINTO - SCRIPT COMPLETO (FINAL)
 * =========================================================
 * - Usa firebase-config.js
 * - Busca participants e coletas por territoryID
 * - Atualiza indicadores reais
 * - Renderiza mapa com participantes
 * =========================================================
 */

/* =========================================================
   IMPORTS
 * ========================================================= */
import { db } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================================================
   DADOS DO TERRITÓRIO
 * ========================================================= */
const territoryData = {
  id: "vila-pinto",
  map: {
    center: [-30.0463, -51.1194],
    zoom: 14
  }
};

/* =========================================================
   ESTADO
 * ========================================================= */
const state = {
  map: null,
  markersLayer: null,
  participants: [],
  stats: {
    cooperados: 0,
    coletas: 0,
    pontos: 0,
    emOperacao: 0
  }
};

/* =========================================================
   HELPERS
 * ========================================================= */
function $(selector) {
  return document.querySelector(selector);
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function animate(el, value) {
  if (!el) return;
  el.textContent = formatNumber(value);
}

/* =========================================================
   FIREBASE QUERIES
 * ========================================================= */
async function getParticipants() {
  const q = query(
    collection(db, "participants"),
    where("territoryID", "==", territoryData.id)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

async function getColetas() {
  const q = query(
    collection(db, "coletas"),
    where("territoryID", "==", territoryData.id)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/* =========================================================
   MAPEAMENTO
 * ========================================================= */
function normalizeParticipants(data) {
  return data.map(p => {
    const coords =
      p.coordinates ||
      p.coordenadas ||
      p.location ||
      null;

    const lat =
      coords?.lat ??
      coords?.latitude ??
      p.lat ??
      null;

    const lng =
      coords?.lng ??
      coords?.longitude ??
      p.lng ??
      null;

    return {
      id: p.id,
      name: p.name || p.nome || "Sem nome",
      phone: p.phone || p.telefone || "—",
      address: p.address || p.endereco || "—",
      inOperation: p.inOperation || p.emOperacao || false,
      hasCoordinates: lat !== null && lng !== null,
      lat,
      lng
    };
  });
}

/* =========================================================
   INDICADORES
 * ========================================================= */
function calculateStats(participants, coletas) {
  return {
    cooperados: participants.length,
    coletas: coletas.length,
    pontos: participants.filter(p => p.hasCoordinates).length,
    emOperacao: participants.filter(p => p.inOperation).length
  };
}

function renderStats() {
  animate($("#cooperadosValue"), state.stats.cooperados);
  animate($("#coletasValue"), state.stats.coletas);
  animate($("#pontosValue"), state.stats.pontos);
  animate($("#operacaoValue"), state.stats.emOperacao);
}

/* =========================================================
   MAPA
 * ========================================================= */
function initMap() {
  if (!window.L) return;

  state.map = L.map("map").setView(
    territoryData.map.center,
    territoryData.map.zoom
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")
    .addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
}

function renderMap() {
  if (!state.map) return;

  state.markersLayer.clearLayers();

  const valid = state.participants.filter(p => p.hasCoordinates);

  valid.forEach(p => {
    L.marker([p.lat, p.lng])
      .bindPopup(`<strong>${p.name}</strong>`)
      .addTo(state.markersLayer);
  });
}

/* =========================================================
   CARREGAMENTO PRINCIPAL
 * ========================================================= */
async function loadData() {
  try {
    const [participantsRaw, coletasRaw] = await Promise.all([
      getParticipants(),
      getColetas()
    ]);

    const participants = normalizeParticipants(participantsRaw);

    state.participants = participants;
    state.stats = calculateStats(participants, coletasRaw);

    renderStats();
    renderMap();

  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  }
}

/* =========================================================
   INIT
 * ========================================================= */
async function init() {
  initMap();
  await loadData();
}

document.addEventListener("DOMContentLoaded", init);