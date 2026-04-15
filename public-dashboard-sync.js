import { db } from "./firebase-init.js";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
UTILS
========================= */

function cleanKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function readFirst(item, keys = []) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function getTerritoryId(item = {}) {
  return (
    readFirst(item, [
      "territoryId",
      "territory",
      "territoryCode",
      "crgrId",
      "cooperativaId",
      "code"
    ]) || null
  );
}

function getTerritoryLabel(item = {}) {
  return (
    readFirst(item, [
      "territoryLabel",
      "territoryName",
      "territory",
      "cooperativaNome",
      "name",
      "label",
      "title"
    ]) || null
  );
}

/* =========================
NORMALIZA TERRITÓRIOS
========================= */

function normalizeTerritories(raw = []) {
  const map = new Map();

  raw.forEach((item) => {
    const id =
      readFirst(item, ["territoryId", "code", "id"]) ||
      null;

    if (!id) return;

    const label =
      readFirst(item, [
        "territoryLabel",
        "name",
        "label",
        "title",
        "cooperativaNome",
        "code",
        "id"
      ]) || id;

    if (!map.has(id)) {
      map.set(id, {
        territoryId: id,
        territoryLabel: label,
        active: item.active ?? (String(item.status || "").toLowerCase() === "active")
      });
    }
  });

  return Array.from(map.values());
}

/* =========================
SOMA RESÍDUOS
========================= */

/*
  Regra flexível:
  - soma campos numéricos conhecidos na raiz
  - soma mapas internos como recebimento, residuos, materiais
  - ignora coordenadas e campos administrativos
*/
function sumNumericLeaves(obj, path = "") {
  if (!isObject(obj)) return 0;

  let total = 0;

  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = cleanKey(key);
    const fullPath = path ? `${path}.${normalizedKey}` : normalizedKey;

    if (
      [
        "lat",
        "lng",
        "latitude",
        "longitude",
        "createdat",
        "updatedat",
        "opdate",
        "territoryid",
        "participantid",
        "createdby"
      ].includes(normalizedKey)
    ) {
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      total += value;
      continue;
    }

    if (isObject(value)) {
      total += sumNumericLeaves(value, fullPath);
    }
  }

  return total;
}

function getResiduosFromColeta(coleta = {}) {
  const direct = toNumber(
    readFirst(coleta, [
      "residuosCount",
      "residuosQtd",
      "quantidadeResiduos",
      "totalResiduos",
      "itemsCount"
    ])
  );

  if (direct > 0) return direct;

  let total = 0;

  const nestedTargets = [
    coleta.recebimento,
    coleta.residuos,
    coleta.materiais,
    coleta.materials
  ];

  nestedTargets.forEach((target) => {
    if (isObject(target)) total += sumNumericLeaves(target);
  });

  if (total > 0) return total;

  return sumNumericLeaves(coleta);
}

/* =========================
MEMBROS DE COOPERATIVA
========================= */

function isCooperativaMember(user = {}) {
  const role = cleanKey(user.role);
  const profile = cleanKey(user.profile);
  const type = cleanKey(user.userType);

  const rolesMap = isObject(user.roles) ? user.roles : {};

  return (
    role === "cooperativa" ||
    role === "integrante" ||
    role === "catador" ||
    role === "member" ||
    profile === "cooperativa" ||
    profile === "integrante" ||
    type === "cooperativa" ||
    type === "integrante" ||
    rolesMap.cooperativa === true ||
    rolesMap.integrante === true
  );
}

/* =========================
LEITURA SEGURA
========================= */

async function readCollectionSafe(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data()
  }));
}

/* =========================
CÁLCULO PRINCIPAL
========================= */

export async function syncPublicDashboard() {
  const [
    users,
    participants,
    coletas,
    territories,
    cooperativas,
    crgrs
  ] = await Promise.all([
    readCollectionSafe("users"),
    readCollectionSafe("participants"),
    readCollectionSafe("coletas"),
    readCollectionSafe("territories"),
    readCollectionSafe("cooperativas"),
    readCollectionSafe("crgrs")
  ]);

  const normalizedTerritories = normalizeTerritories([
    ...territories,
    ...cooperativas,
    ...crgrs
  ]);

  const territoryMap = new Map();

  normalizedTerritories.forEach((territory) => {
    territoryMap.set(territory.territoryId, {
      territoryId: territory.territoryId,
      territoryLabel: territory.territoryLabel,
      coletasCount: 0,
      residuosCount: 0,
      participantsCount: 0,
      cooperativaMembersCount: 0
    });
  });

  coletas.forEach((item) => {
    const territoryId = getTerritoryId(item);
    if (!territoryId || !territoryMap.has(territoryId)) return;

    const bucket = territoryMap.get(territoryId);
    bucket.coletasCount += 1;
    bucket.residuosCount += getResiduosFromColeta(item);
  });

  participants.forEach((item) => {
    const territoryId = getTerritoryId(item);
    if (!territoryId || !territoryMap.has(territoryId)) return;

    const bucket = territoryMap.get(territoryId);
    bucket.participantsCount += 1;
  });

  users.forEach((item) => {
    const territoryId = getTerritoryId(item);
    if (!territoryId || !territoryMap.has(territoryId)) return;
    if (!isCooperativaMember(item)) return;

    const bucket = territoryMap.get(territoryId);
    bucket.cooperativaMembersCount += 1;
  });

  const territoryDocs = Array.from(territoryMap.values());

  const globalSummary = territoryDocs.reduce(
    (acc, item) => {
      acc.coletasCount += item.coletasCount;
      acc.residuosCount += item.residuosCount;
      acc.participantsCount += item.participantsCount;
      acc.cooperativaMembersCount += item.cooperativaMembersCount;
      return acc;
    },
    {
      territoriesCount: territoryDocs.length,
      coletasCount: 0,
      residuosCount: 0,
      participantsCount: 0,
      cooperativaMembersCount: 0
    }
  );

  await setDoc(
    doc(db, "publicDashboard", "index"),
    {
      ...globalSummary,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await Promise.all(
    territoryDocs.map((item) =>
      setDoc(
        doc(db, "publicDashboard", `territory_${item.territoryId}`),
        {
          ...item,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      )
    )
  );

  console.log("[NSRU] publicDashboard sincronizado", {
    globalSummary,
    territoryDocs
  });

  return { globalSummary, territoryDocs };
}