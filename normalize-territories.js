/**
 * Script de migração para padronizar territoryId no Firestore
 *
 * Requisitos:
 * npm install firebase-admin
 *
 * Uso:
 * 1. Baixe sua service account JSON do Firebase
 * 2. Salve como ./serviceAccountKey.json
 * 3. Rode:
 *    node normalize-territories.js
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const COLLECTIONS = [
  "users",
  "participants",
  "approvalRequests",
  "coletas",
  "alerts",
  "dashboard_public_by_cooperativa",
  "publicDashboard"
];

function normalizeTerritory(value) {
  const v = String(value || "").trim().toLowerCase().replace(/_/g, "-");

  if (v === "vila-pinto" || v === "crgr-vila-pinto") {
    return "vila-pinto";
  }

  if (v === "cooadesc" || v === "crgr-cooadesc") {
    return "cooadesc";
  }

  if (v === "padre-cacique" || v === "crgr-padre-cacique") {
    return "padre-cacique";
  }

  return value || "";
}

function normalizeTerritoryLabel(territoryId, currentLabel) {
  const normalized = normalizeTerritory(territoryId);

  if (normalized === "vila-pinto") return "Centro de Triagem Vila Pinto";
  if (normalized === "cooadesc") return "COOADESC";
  if (normalized === "padre-cacique") return "Padre Cacique";

  return currentLabel || "";
}

async function updateCollection(collectionName) {
  const snap = await db.collection(collectionName).get();

  if (snap.empty) {
    console.log(`[${collectionName}] sem documentos.`);
    return;
  }

  let batch = db.batch();
  let opCount = 0;
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const updates = {};

    if (typeof data.territoryId === "string" && data.territoryId.trim()) {
      const normalizedId = normalizeTerritory(data.territoryId);

      if (normalizedId !== data.territoryId) {
        updates.territoryId = normalizedId;
      }

      if (typeof data.territoryLabel === "string") {
        const normalizedLabel = normalizeTerritoryLabel(normalizedId, data.territoryLabel);
        if (normalizedLabel !== data.territoryLabel) {
          updates.territoryLabel = normalizedLabel;
        }
      }
    }

    if (collectionName === "approvalRequests" && data.payloadSnapshot && typeof data.payloadSnapshot === "object") {
      const payloadTerritoryId = data.payloadSnapshot.territoryId;
      if (typeof payloadTerritoryId === "string" && payloadTerritoryId.trim()) {
        const normalizedPayloadTerritoryId = normalizeTerritory(payloadTerritoryId);
        if (normalizedPayloadTerritoryId !== payloadTerritoryId) {
          updates["payloadSnapshot.territoryId"] = normalizedPayloadTerritoryId;
        }

        const currentPayloadLabel = data.payloadSnapshot.territoryLabel;
        if (typeof currentPayloadLabel === "string") {
          const normalizedPayloadLabel = normalizeTerritoryLabel(normalizedPayloadTerritoryId, currentPayloadLabel);
          if (normalizedPayloadLabel !== currentPayloadLabel) {
            updates["payloadSnapshot.territoryLabel"] = normalizedPayloadLabel;
          }
        }
      }
    }

    if (collectionName === "users" && typeof data.territoryId === "string" && data.territoryId.trim()) {
      const normalizedId = normalizeTerritory(data.territoryId);
      if (normalizedId !== data.territoryId) {
        updates.territoryId = normalizedId;
      }

      if (typeof data.territoryLabel === "string") {
        const normalizedLabel = normalizeTerritoryLabel(normalizedId, data.territoryLabel);
        if (normalizedLabel !== data.territoryLabel) {
          updates.territoryLabel = normalizedLabel;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      opCount += 1;
      updated += 1;
    }

    if (opCount === 450) {
      await batch.commit();
      console.log(`[${collectionName}] lote commitado (${updated} atualizados até agora).`);
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  console.log(`[${collectionName}] concluído. Documentos atualizados: ${updated}`);
}

async function main() {
  try {
    for (const collectionName of COLLECTIONS) {
      await updateCollection(collectionName);
    }
    console.log("Migração finalizada com sucesso.");
    process.exit(0);
  } catch (error) {
    console.error("Erro na migração:", error);
    process.exit(1);
  }
}

main();