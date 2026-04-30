import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIGURAÇÃO DA PÁGINA
========================= */
/* =========================
   CONFIGURAÇÃO DA PÁGINA (DINÂMICA)
========================= */

const TERRITORY_FALLBACKS = {
  "vila-pinto": {
    territoryId: "vila-pinto",
    territoryLabel: "Centro de Triagem Vila Pinto",
    backUrl: "cooperativa-vila-pinto.html"
  },
  "cooadesc": {
    territoryId: "cooadesc",
    territoryLabel: "COOADESC",
    backUrl: "cooperativa-cooadesc.html"
  },
  "padre-cacique": {
    territoryId: "padre-cacique",
    territoryLabel: "Padre Cacique",
    backUrl: "cooperativa-padre-cacique.html"
  }
};

function getPageTerritoryConfig() {
  const body = document.body;
  const territoryId = body?.dataset?.territoryId || "vila-pinto";
  const fallback = TERRITORY_FALLBACKS[territoryId] || TERRITORY_FALLBACKS["vila-pinto"];

  return {
    territoryId,
    territoryLabel: body?.dataset?.territoryLabel || fallback.territoryLabel,
    backUrl: body?.dataset?.backUrl || fallback.backUrl
  };
}

const PAGE_TERRITORY = getPageTerritoryConfig();

/* Código padrão para família quando o campo Código ficar vazio */
const DEFAULT_FAMILY_CODE = "F000";

/* =========================
   STATE GLOBAL
========================= */

const STATE = {
  territoryId: PAGE_TERRITORY.territoryId,
  operacao: null,
  salvando: false,
  user: null,
  userDoc: null
};