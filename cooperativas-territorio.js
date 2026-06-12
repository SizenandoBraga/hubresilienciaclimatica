import { auth, db } from "./firebase-init-coadesc.js";
import "./polyfills.js";
import { db as dbGuardioes } from "./firebase-init-guardioes.js";
import { registerAccessLog } from "./access-tracker.js";
import {onAuthStateChanged,signOut} from "firebase/auth";

import {
  doc,
  getDoc,
  collection,
  query,
  onSnapshot,
  updateDoc,
  orderBy,
  deleteDoc,
  serverTimestamp,
  getDocs
} from "firebase/firestore";

/* =========================================================
   CONFIG
========================================================= */

const bodyConfig = document.body.dataset || {};

function canonicalTerritoryId(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  if (!raw) return "vila-pinto";
  if (raw === "crgr-vila-pinto" || raw === "vila-pinto" || raw === "vp") return "vila-pinto";
  if (raw === "crgr-cooadesc" || raw === "crgr-coadesc" || raw === "cooadesc" || raw === "coadesc") return "cooadesc";
  if (raw === "crgr-padre-cacique" || raw === "padre-cacique" || raw === "padre") return "padre-cacique";

  return raw;
}

const PAGE_TERRITORY = {
  territoryId: canonicalTerritoryId(bodyConfig.territoryId || "vila-pinto"),
  territoryLabel: bodyConfig.territoryLabel || "Centro de Triagem Vila Pinto",
  cooperativeName: bodyConfig.cooperativeName || "Vila Pinto",
  participantUrl: bodyConfig.participantUrl || "cadastro-participantes-vila-pinto.html",
  participantsListUrl: bodyConfig.participantsListUrl || "usuarios-vila-pinto.html",
  coletasUrl: bodyConfig.coletasUrl || "cadastro-coletas-vila-pinto.html"
};
 
/* =========================================================
   ELEMENTOS
========================================================= */

const els = {
  sidebar: document.getElementById("sidebar"),
  menuBtn: document.getElementById("menuBtn"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  logoutLink: document.getElementById("logoutLink"),

  userNameTop: document.getElementById("userNameTop"),
  accessBanner: document.getElementById("accessBanner"),
  sidebarHelpText: document.getElementById("sidebarHelpText"),

  syncCoopDashboardBtn: document.getElementById("syncCoopDashboardBtn"),
  syncCoopDashboardStatus: document.getElementById("syncCoopDashboardStatus"),

  indicatorParticipants: document.getElementById("indicatorParticipants"),
  indicatorColetas: document.getElementById("indicatorColetas"),
  indicatorActions: document.getElementById("indicatorActions"),

  indicatorPesoRecebido: document.getElementById("indicatorPesoRecebido"),
  indicatorRejeito: document.getElementById("indicatorRejeito"),
  indicatorNaoComercializado: document.getElementById("indicatorNaoComercializado"),
  indicatorQualidadeMedia: document.getElementById("indicatorQualidadeMedia"),

  participantsTotalCount: document.getElementById("participantsTotalCount"),
  participantsPeopleCount: document.getElementById("participantsPeopleCount"),
  participantsCondoCount: document.getElementById("participantsCondoCount"),

  noticesList: document.getElementById("noticesList"),
  territoryCommunications: document.getElementById("territoryCommunications"),

  chartColetasMensais: document.getElementById("chartColetasMensais"),
  chartParticipantesPerfil: document.getElementById("chartParticipantesPerfil"),

  recentColetasTableBody:
    document.getElementById("tableColetasBody") ||
    document.getElementById("recentColetasTableBody") ||
    document.getElementById("latestColetasBody"),

  tableVisibleCount: document.getElementById("tableVisibleCount"),
  tableFilteredCount: document.getElementById("tableFilteredCount"),
  tableLastUpdate: document.getElementById("tableLastUpdate"),

  tSearch: document.getElementById("tSearch"),
  tFluxo: document.getElementById("tFluxo"),
  tEntrega: document.getElementById("tEntrega"),
  tStatus: document.getElementById("tStatus"),
  tTipoCadastro: document.getElementById("tTipoCadastro"),
  btnApplyTableFilters: document.getElementById("btnApplyTableFilters"),
  btnClearTableFilters: document.getElementById("btnClearTableFilters"),

  btnPrevColetas: document.getElementById("btnPrevColetas"),
  btnNextColetas: document.getElementById("btnNextColetas"),
  tablePageIndicator: document.getElementById("tablePageIndicator"),

  exportParticipantsPdfBtn: document.getElementById("exportParticipantsPdfBtn"),
  btnLoadMoreColetas: document.getElementById("btnLoadMoreColetas")
};

/* =========================================================
   STATE
========================================================= */

const STATE = {
  currentUser: null,
  profile: null,
  isAdmin: false,
  canEditAll: false,
  participants: [],
  coletas: [],
  approvalRequests: [],
  unsubscribers: [],
  recentPage: 0,
  recentPageSize: 10,
  recentLimit: 10
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(el, value) {
  if (!el) return;
  el.textContent = String(value ?? "");
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatKg(value) {
  return `${formatNumber(Number(value || 0))} kg`;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(
    String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(/kg|kgs|quilo|quilos|litros?|r\$/gi, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function animateNumber(el, value, suffix = "") {
  if (!el) return;

  const target = Number(value || 0);
  const current = Number(String(el.textContent || "0").replace(/[^\d.-]/g, "")) || 0;
  const duration = 450;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const next = Math.round(current + (target - current) * progress);

    el.textContent = next.toLocaleString("pt-BR") + suffix;

    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function isAdminUser(role) {
  return role === "admin";
}

function isGovernancaUser(role) {
  return role === "governanca" || role === "gestor";
}

/* =========================================================
   TERRITÓRIO
========================================================= */

function getParticipantCode(item = {}) {
  return String(
    item.participantCode ||
    item.codigoParticipante ||
    item.codigo ||
    item.code ||
    item.familyCode ||
    item.payloadSnapshot?.participantCode ||
    item.payloadSnapshot?.codigoParticipante ||
    item.payloadSnapshot?.familyCode ||
    item.recebimento?.participantCode ||
    item.finalTurno?.participantCode ||
    ""
  ).trim();
}

function itemBelongsToTerritory(item = {}) {
  const code = getParticipantCode(item).toUpperCase();

  const fields = [
    item.territoryId,
    item.territory,
    item.territorio,
    item.territoryLabel,
    item.cooperativeId,
    item.cooperativaId,
    item.cooperativeName,
    item.cooperativa,
    item.localCrgr,
    item.crgr,
    item.payloadSnapshot?.territoryId,
    item.payloadSnapshot?.territory,
    item.payloadSnapshot?.territorio,
    item.payloadSnapshot?.territoryLabel,
    item.payloadSnapshot?.cooperativeId,
    item.payloadSnapshot?.cooperativaId,
    item.payloadSnapshot?.cooperativa,
    item.payloadSnapshot?.localCrgr,
    item.payloadSnapshot?.crgr,
    item.recebimento?.territoryId,
    item.recebimento?.territory,
    item.recebimento?.cooperativeId,
    item.finalTurno?.territoryId,
    item.finalTurno?.territory,
    item.finalTurno?.cooperativeId
  ]
    .filter(Boolean)
    .map(canonicalTerritoryId);

  const current = PAGE_TERRITORY.territoryId;

  if (fields.includes(current)) return true;

  const hasOtherTerritory = fields.some((field) =>
    ["vila-pinto", "cooadesc", "padre-cacique"].includes(field) &&
    field !== current
  );

  if (hasOtherTerritory) return false;

  if (current === "vila-pinto") {
    if (
      code.startsWith("VPD") ||
      code.startsWith("VP") ||
      code.startsWith("C") ||
      code.startsWith("F") ||
      code === "FAMILIAS"
    ) return true;

    if (
      code.startsWith("COA") ||
      code.startsWith("COO") ||
      code.startsWith("PC") ||
      code.startsWith("PCA")
    ) return false;

    return true;
  }

  if (current === "cooadesc") {
    return code.startsWith("COA") || code.startsWith("COO") || code.startsWith("CD");
  }

  if (current === "padre-cacique") {
    return code.startsWith("PC") || code.startsWith("PCA") || code.startsWith("PDC");
  }

  return true;
}

/* =========================================================
   PARTICIPANTES / STATUS
========================================================= */

function getParticipantName(item = {}) {
  const code = getParticipantCode(item);

  return (
    item.participantName ||
    item.nomeParticipante ||
    item.nome ||
    item.name ||
    item.payloadSnapshot?.participantName ||
    item.payloadSnapshot?.name ||
    item.recebimento?.participantName ||
    item.finalTurno?.participantName ||
    code ||
    "-"
  );
}

function participantType(item = {}) {
  return normalizeText(
    item.participantType ||
    item.tipoParticipante ||
    item.tipoCadastro ||
    item.tipo ||
    item.localType ||
    item.codeLocalType ||
    item.payloadSnapshot?.participantType ||
    item.payloadSnapshot?.tipoCadastro ||
    item.payloadSnapshot?.localType ||
    item.payloadSnapshot?.codeLocalType
  );
}

function getParticipantTypeLabel(item = {}) {
  const type = participantType(item);

  if (type.includes("condominio")) return "condomínio";
  if (type.includes("comercio")) return "comércio";
  if (type.includes("casa")) return "participante";
  if (type.includes("familia")) return "participante";

  return type || "participante";
}

function isApprovedParticipant(item = {}) {
  const status = normalizeText(item.approvalStatus || item.status || item.decision);

  return (
    status === "approved" ||
    status === "aprovado" ||
    status === "active" ||
    status === "ativo" ||
    item.active === true ||
    item.ativo === true
  );
}

function isPendingParticipant(item = {}) {
  const status = normalizeText(item.status || item.decision || item.approvalStatus);

  return (
    status === "pending" ||
    status === "pendente" ||
    status === "waiting" ||
    status === "aguardando"
  );
}


function isColetaCancelada(item = {}) {
  const status = normalizeText(
    item.status ||
    item.situacao ||
    item.decision ||
    item.approvalStatus ||
    item.coletaStatus ||
    item.cancelStatus ||
    item.payloadSnapshot?.status ||
    item.payloadSnapshot?.coletaStatus ||
    ""
  );

  return (
    status.includes("cancel") ||
    item.cancelled === true ||
    item.cancelada === true ||
    item.cancelado === true ||
    Boolean(item.cancelledAt) ||
    Boolean(item.canceladaEm) ||
    Boolean(item.canceladoEm)
  );
}

function isColetaRealizada(item = {}) {
  if (isColetaCancelada(item)) return false;

  const status = normalizeText(
    item.status ||
    item.situacao ||
    item.decision ||
    item.approvalStatus ||
    item.coletaStatus ||
    "realizada"
  );

  return ![
    "cancelada",
    "cancelado",
    "rejected",
    "rejeitada",
    "rejeitado",
    "pendente",
    "pending",
    "rascunho",
    "draft"
  ].includes(status);
}

/* =========================================================
   DATA / TIPO / STATUS COLETA
========================================================= */

function getDateValue(item = {}) {
  const candidates = [
    item.opDate,
    item.dataOperacao,
    item.operationDate,
    item.dataColeta,
    item.coletaData,
    item.dateColeta,
    item.dataRegistro,
    item.createdAtISO,
    item.updatedAtISO,
    item.createdAt,
    item.updatedAt,
    item.date,
    item.data,

    item.payloadSnapshot?.opDate,
    item.payloadSnapshot?.dataOperacao,
    item.payloadSnapshot?.operationDate,
    item.payloadSnapshot?.dataColeta,
    item.payloadSnapshot?.coletaData,
    item.payloadSnapshot?.dataRegistro,
    item.payloadSnapshot?.createdAtISO,
    item.payloadSnapshot?.createdAt,
    item.payloadSnapshot?.data,

    item.recebimento?.dataColeta,
    item.recebimento?.dataOperacao,
    item.recebimento?.createdAt,
    item.finalTurno?.dataColeta,
    item.finalTurno?.dataOperacao,
    item.finalTurno?.createdAt
  ];

  for (const possible of candidates) {
    if (!possible) continue;

    if (typeof possible?.toDate === "function") {
      const date = possible.toDate();
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (typeof possible?.seconds === "number") {
      const date = new Date(possible.seconds * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (possible instanceof Date) {
      if (!Number.isNaN(possible.getTime())) return possible;
    }

    if (typeof possible === "string") {
      const clean = possible.trim();

      const brDate = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (brDate) {
        const date = new Date(
          Number(brDate[3]),
          Number(brDate[2]) - 1,
          Number(brDate[1])
        );
        if (!Number.isNaN(date.getTime())) return date;
      }

      const isoDate = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoDate) {
        const date = new Date(
          Number(isoDate[1]),
          Number(isoDate[2]) - 1,
          Number(isoDate[3])
        );
        if (!Number.isNaN(date.getTime())) return date;
      }

      const parsed = new Date(clean);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

function formatDateLabel(item = {}) {
  const date = getDateValue(item);
  return date ? date.toLocaleDateString("pt-BR") : "-";
}

function formatDateTimeLabel(date = new Date()) {
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function getTipoRecebimento(item = {}) {
  return (
    item.flowType ||
    item.fluxo ||
    item.tipoColeta ||
    item.tipoRecebimento ||
    item.receiptType ||
    item.tipo ||
    item.recebimento?.flowType ||
    item.recebimento?.fluxo ||
    item.finalTurno?.flowType ||
    item.finalTurno?.fluxo ||
    item.localType ||
    item.codeLocalType ||
    item.payloadSnapshot?.flowType ||
    item.payloadSnapshot?.fluxo ||
    item.payloadSnapshot?.tipoRecebimento ||
    item.payloadSnapshot?.localType ||
    "recebimento"
  );
}

function inferFluxoKey(item = {}) {
  const normalized = normalizeText(getTipoRecebimento(item)).replaceAll("-", "_");

  if (normalized.includes("final") || normalized.includes("turno")) return "final_turno";

  return "recebimento";
}

function formatFluxoLabel(value) {
  const normalized = normalizeText(value).replaceAll("-", "_");

  if (normalized === "recebimento") return "Recebimento";
  if (normalized === "final_turno") return "Final do turno";
  if (normalized.includes("final")) return "Final do turno";

  return value && value !== "-" ? String(value) : "Recebimento";
}

function getEntrega(item = {}) {
  return (
    item.deliveryType ||
    item.entrega ||
    item.tipoEntrega ||
    item.payloadSnapshot?.deliveryType ||
    item.payloadSnapshot?.entrega ||
    item.recebimento?.deliveryType ||
    item.recebimento?.entrega ||
    item.finalTurno?.deliveryType ||
    item.finalTurno?.entrega ||
    "Normal"
  );
}

function getColetaStatusLabel(item = {}) {
  if (isColetaCancelada(item)) return "Cancelado";

  const raw =
    item.status ||
    item.situacao ||
    item.decision ||
    item.approvalStatus ||
    item.coletaStatus ||
    "Realizada";

  const normalized = normalizeText(raw);

  if (normalized === "approved" || normalized === "aprovado") return "Ativo";
  if (normalized === "active" || normalized === "ativo") return "Ativo";
  if (normalized === "realizada") return "Ativo";
  if (normalized === "editado") return "Editado";
  if (normalized === "pending") return "Pendente";
  if (normalized === "rejected") return "Rejeitada";
  if (normalized === "cancelado" || normalized === "cancelada") return "Cancelado";

  return String(raw || "Ativo");
}

function statusBadge(statusOrItem) {
  const label =
    typeof statusOrItem === "object"
      ? getColetaStatusLabel(statusOrItem)
      : String(statusOrItem || "Ativo");

  const normalized = normalizeText(label);

  let className = "status-badge";

  if (normalized.includes("pend")) className += " pendente";
  if (normalized.includes("cancel") || normalized.includes("reje")) className += " rejeitado";
  if (normalized.includes("real") || normalized.includes("aprov") || normalized.includes("ativ")) {
    className += " realizada";
  }

  if (normalized.includes("edit")) className += " pendente";

  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

/* =========================================================
   MATERIAIS / PESOS / QUALIDADE
========================================================= */

function getMateriaisObject(coleta = {}) {
  return (
    coleta.materiais ||
    coleta.materials ||
    coleta.materiaisInformados ||
    coleta.recebimento?.materiais ||
    coleta.recebimento?.materials ||
    coleta.finalTurno?.materiais ||
    coleta.finalTurno?.materials ||
    coleta.payloadSnapshot?.materiais ||
    coleta.payloadSnapshot?.materials ||
    coleta.payloadSnapshot?.materiaisInformados ||
    {}
  );
}

function getFinalTurnoMateriais(item = {}) {
  return {
    "Plástico":
      toNumber(item.plasticoKg) ||
      toNumber(item.plastico) ||
      toNumber(item.finalTurno?.plasticoKg) ||
      toNumber(item.finalTurno?.plastico) ||
      toNumber(item.payloadSnapshot?.plasticoKg) ||
      toNumber(item.payloadSnapshot?.plastico),

    "Vidro":
      toNumber(item.vidroKg) ||
      toNumber(item.vidro) ||
      toNumber(item.finalTurno?.vidroKg) ||
      toNumber(item.finalTurno?.vidro) ||
      toNumber(item.payloadSnapshot?.vidroKg) ||
      toNumber(item.payloadSnapshot?.vidro),

    "Sacaria":
      toNumber(item.sacariaKg) ||
      toNumber(item.sacaria) ||
      toNumber(item.finalTurno?.sacariaKg) ||
      toNumber(item.finalTurno?.sacaria) ||
      toNumber(item.payloadSnapshot?.sacariaKg) ||
      toNumber(item.payloadSnapshot?.sacaria),

    "Papel misto":
      toNumber(item.papelMistoKg) ||
      toNumber(item.papelMisto) ||
      toNumber(item.finalTurno?.papelMistoKg) ||
      toNumber(item.finalTurno?.papelMisto) ||
      toNumber(item.payloadSnapshot?.papelMistoKg) ||
      toNumber(item.payloadSnapshot?.papelMisto),

    "Papelão":
      toNumber(item.papelaoKg) ||
      toNumber(item.papelao) ||
      toNumber(item.finalTurno?.papelaoKg) ||
      toNumber(item.finalTurno?.papelao) ||
      toNumber(item.payloadSnapshot?.papelaoKg) ||
      toNumber(item.payloadSnapshot?.papelao),

    "Metal / Alumínio":
      toNumber(item.aluminioMetalKg) ||
      toNumber(item.metalKg) ||
      toNumber(item.aluminioKg) ||
      toNumber(item.finalTurno?.aluminioMetalKg) ||
      toNumber(item.finalTurno?.metalKg) ||
      toNumber(item.finalTurno?.aluminioKg) ||
      toNumber(item.payloadSnapshot?.aluminioMetalKg) ||
      toNumber(item.payloadSnapshot?.metalKg) ||
      toNumber(item.payloadSnapshot?.aluminioKg),

    "Isopor":
      toNumber(item.isoporKg) ||
      toNumber(item.isopor) ||
      toNumber(item.finalTurno?.isoporKg) ||
      toNumber(item.finalTurno?.isopor) ||
      toNumber(item.payloadSnapshot?.isoporKg) ||
      toNumber(item.payloadSnapshot?.isopor),

    "Óleo":
      toNumber(item.oleoKg) ||
      toNumber(item.oleo) ||
      toNumber(item.finalTurno?.oleoKg) ||
      toNumber(item.finalTurno?.oleo) ||
      toNumber(item.payloadSnapshot?.oleoKg) ||
      toNumber(item.payloadSnapshot?.oleo)
  };
}

function somaMateriais(coleta = {}) {
  const fixedMaterials = getFinalTurnoMateriais(coleta);

  const fixedTotal = Object.values(fixedMaterials).reduce((acc, value) => {
    return acc + toNumber(value);
  }, 0);

  if (fixedTotal > 0) return fixedTotal;

  const materiais = getMateriaisObject(coleta);

  if (Array.isArray(materiais)) {
    return materiais.reduce((acc, item) => {
      return acc + toNumber(item.peso || item.kg || item.valor || item.quantidade);
    }, 0);
  }

  if (typeof materiais === "object" && materiais !== null) {
    return Object.values(materiais).reduce((acc, value) => {
      if (typeof value === "object" && value !== null) {
        return acc + toNumber(value.peso || value.kg || value.valor || value.quantidade);
      }

      return acc + toNumber(value);
    }, 0);
  }

  return 0;
}

function getPesoRecebido(coleta = {}) {
  return (
    toNumber(coleta.pesoRecebido) ||
    toNumber(coleta.peso_recebido) ||
    toNumber(coleta.totalPesoRecebido) ||
    toNumber(coleta.totalRecebido) ||
    toNumber(coleta.totalRecebidoKg) ||
    toNumber(coleta.totalKg) ||
    toNumber(coleta.pesoTotal) ||
    toNumber(coleta.peso) ||
    toNumber(coleta.kg) ||
    toNumber(coleta.recebimento?.pesoResiduoSecoKg) ||
    toNumber(coleta.recebimento?.pesoRecebido) ||
    toNumber(coleta.recebimento?.totalKg) ||
    toNumber(coleta.finalTurno?.pesoResiduoSecoKg) ||
    toNumber(coleta.finalTurno?.pesoRecebido) ||
    toNumber(coleta.finalTurno?.totalKg) ||
    toNumber(coleta.payloadSnapshot?.pesoRecebido) ||
    toNumber(coleta.payloadSnapshot?.totalKg) ||
    toNumber(coleta.payloadSnapshot?.pesoResiduoSecoKg) ||
    somaMateriais(coleta) ||
    0
  );
}

function getRejeito(coleta = {}) {
  return (
    toNumber(coleta.rejeito) ||
    toNumber(coleta.pesoRejeito) ||
    toNumber(coleta.totalRejeito) ||
    toNumber(coleta.totalRejeitoKg) ||
    toNumber(coleta.rejeitoKg) ||
    toNumber(coleta.rejeitos) ||
    toNumber(coleta.recebimento?.pesoRejeitoKg) ||
    toNumber(coleta.recebimento?.rejeito) ||
    toNumber(coleta.finalTurno?.pesoRejeitoKg) ||
    toNumber(coleta.finalTurno?.rejeito) ||
    toNumber(coleta.payloadSnapshot?.rejeito) ||
    toNumber(coleta.payloadSnapshot?.pesoRejeito) ||
    toNumber(coleta.payloadSnapshot?.totalRejeito) ||
    0
  );
}

function getNaoComercializado(coleta = {}) {
  return (
    toNumber(coleta.naoComercializado) ||
    toNumber(coleta.nao_comercializado) ||
    toNumber(coleta.totalNaoComercializado) ||
    toNumber(coleta.totalNaoComercializadoKg) ||
    toNumber(coleta.naoComercializadoKg) ||
    toNumber(coleta.materialNaoComercializado) ||
    toNumber(coleta.naoVenda) ||
    toNumber(coleta.semComercializacao) ||
    toNumber(coleta.recebimento?.pesoNaoComercializadoKg) ||
    toNumber(coleta.recebimento?.naoComercializado) ||
    toNumber(coleta.finalTurno?.pesoNaoComercializadoKg) ||
    toNumber(coleta.finalTurno?.naoComercializado) ||
    toNumber(coleta.payloadSnapshot?.naoComercializado) ||
    toNumber(coleta.payloadSnapshot?.totalNaoComercializado) ||
    0
  );
}

function getQualidade(coleta = {}) {
  return (
    toNumber(coleta.qualidade) ||
    toNumber(coleta.notaQualidade) ||
    toNumber(coleta.qualityScore) ||
    toNumber(coleta.recebimento?.qualidade) ||
    toNumber(coleta.recebimento?.notaQualidade) ||
    toNumber(coleta.recebimento?.qualidadeNota) ||
    toNumber(coleta.finalTurno?.qualidade) ||
    toNumber(coleta.finalTurno?.notaQualidade) ||
    toNumber(coleta.finalTurno?.qualidadeNota) ||
    toNumber(coleta.payloadSnapshot?.qualidade) ||
    toNumber(coleta.payloadSnapshot?.notaQualidade) ||
    toNumber(coleta.payloadSnapshot?.qualidadeNota) ||
    0
  );
}

function renderMaterialsList(item = {}) {
  const fixedMaterials = getFinalTurnoMateriais(item);

  const fixedEntries = Object.entries(fixedMaterials).filter(([, value]) => toNumber(value) > 0);

  if (fixedEntries.length) {
    return fixedEntries
      .map(([name, value]) => {
        return `
          <div class="material-line">
            <span>${escapeHtml(name)}</span>
            <strong>${escapeHtml(formatKg(value))}</strong>
          </div>
        `;
      })
      .join("");
  }

  const materiais = getMateriaisObject(item);
  let entries = [];

  if (Array.isArray(materiais)) {
    entries = materiais.map((mat) => [
      mat.nome || mat.material || mat.tipo || "Material",
      mat.peso || mat.kg || mat.valor || mat.quantidade || 0
    ]);
  } else if (typeof materiais === "object" && materiais !== null) {
    entries = Object.entries(materiais).map(([name, value]) => {
      if (typeof value === "object" && value !== null) {
        return [
          value.nome || value.material || name,
          value.peso || value.kg || value.valor || value.quantidade || 0
        ];
      }

      return [name, value];
    });
  }

  entries = entries.filter(([, value]) => toNumber(value) > 0);

  if (!entries.length) {
    return `<div class="empty-materials">Nenhum material informado.</div>`;
  }

  return entries
    .map(([name, value]) => {
      return `
        <div class="material-line">
          <span>${escapeHtml(name)}</span>
          <strong>${escapeHtml(formatKg(value))}</strong>
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   AUTH
========================================================= */

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    throw new Error("Usuário não encontrado.");
  }

  const data = {
    id: snap.id,
    ...snap.data()
  };

  if (data.territoryId) {
    data.territoryId = canonicalTerritoryId(data.territoryId);
  }

  return data;
}

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil de usuário inválido.");

  if (profile.status && profile.status !== "active") {
    throw new Error("Usuário sem acesso ativo.");
  }
}

/* =========================================================
   UI
========================================================= */

function setupSidebar() {
  function openSidebar() {
    els.sidebar?.classList.add("open");
    els.mobileOverlay?.classList.add("show");
    document.body.classList.add("menu-open");
  }

  function closeSidebar() {
    els.sidebar?.classList.remove("open");
    els.mobileOverlay?.classList.remove("show");
    document.body.classList.remove("menu-open");
  }

  els.menuBtn?.addEventListener("click", openSidebar);
  els.mobileOverlay?.addEventListener("click", closeSidebar);

  document.querySelectorAll(".sidebar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1180) closeSidebar();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) closeSidebar();
  });
}

function setupLogout() {
  els.logoutLink?.addEventListener("click", async (event) => {
    event.preventDefault();

    try {
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    } finally {
      window.location.href = "index.html";
    }
  });
}

function setupTopbarShadow() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  window.addEventListener("scroll", () => {
    topbar.style.boxShadow =
      window.scrollY > 8
        ? "0 10px 28px rgba(15,23,42,.08)"
        : "0 6px 20px rgba(15,23,42,.04)";
  });
}

function fillHeader(profile) {
  const isAdmin = isAdminUser(profile.role);
  const isGovernanca = isGovernancaUser(profile.role);

  const name =
    profile.displayName ||
    profile.name ||
    profile.nome ||
    (isAdmin ? "Administrador VP" : "Usuário");

  setText(els.userNameTop, name);

  if (els.accessBanner) {
    if (isGovernanca) {
      els.accessBanner.className = "access-banner show admin";
      els.accessBanner.innerHTML =
        `<strong>Acesso de governança ativo.</strong> Visualização geral dos indicadores do sistema.`;
    } else {
      els.accessBanner.className = "access-banner show cooperativa";
      els.accessBanner.innerHTML =
        `<strong>Acesso administrativo ativo.</strong> Indicadores vinculados à cooperativa ${PAGE_TERRITORY.cooperativeName}.`;
    }
  }

  if (els.sidebarHelpText) {
    els.sidebarHelpText.textContent =
      "Dashboard da cooperativa com dados operacionais, participantes e coletas.";
  }
}

function renderInfoList(container, items) {
  if (!container) return;

  container.innerHTML = items
    .map((item) => {
      return `
        <article class="info-item">
          <div class="info-copy">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.description)}</span>
          </div>
          ${item.meta ? `<span class="info-meta">${escapeHtml(item.meta)}</span>` : ""}
        </article>
      `;
    })
    .join("");
}

function fillStaticPanels() {
  renderInfoList(els.noticesList, [
    {
      title: "Indicadores atualizados",
      description: "Os dados do painel são sincronizados com os registros da cooperativa.",
      meta: "Sistema"
    },
    {
      title: "Acompanhamento operacional",
      description: "Use o dashboard para acompanhar participantes, coletas e ações pendentes.",
      meta: "Painel"
    }
  ]);

  renderInfoList(els.territoryCommunications, [
    {
      title: "Resumo da cooperativa",
      description: "Painel inicial otimizado para leitura rápida dos principais números.",
      meta: "Dashboard"
    },
    {
      title: "Dados integrados",
      description: "Participantes, coletas e solicitações são carregados diretamente do Firebase.",
      meta: "Firebase"
    }
  ]);
}

function setCoopSyncStatus(text) {
  setText(els.syncCoopDashboardStatus, text);
}

/* =========================================================
   FIREBASE
========================================================= */

function clearUnsubscribers() {
  STATE.unsubscribers.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (_) {}
  });

  STATE.unsubscribers = [];
}

function listenCollection(collectionName, callback) {
  try {
    const q = query(collection(db, collectionName));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data()
        }));

        callback(docs);
      },
      (error) => {
        console.error(`[${collectionName}] Erro ao carregar dados:`, error);
        callback([]);
      }
    );

    STATE.unsubscribers.push(unsubscribe);
  } catch (error) {
    console.error(`[${collectionName}] Erro ao iniciar listener:`, error);
    callback([]);
  }
}

/* =========================================================
   KPIs
========================================================= */

function computeDashboardData() {
  const approvedParticipants = STATE.participants.filter(isApprovedParticipant);
  const coletasRealizadas = STATE.coletas.filter(isColetaRealizada);

  const peopleCount = approvedParticipants.filter((item) =>
    ["morador", "familia", "família", "lideranca", "participante", "user", "usuario", "casa"].includes(participantType(item))
  ).length;

  const condoCount = approvedParticipants.filter((item) =>
    ["condominio", "condomínio"].includes(participantType(item))
  ).length;

  const pesoRecebido = coletasRealizadas.reduce((acc, item) => acc + getPesoRecebido(item), 0);
  const rejeito = coletasRealizadas.reduce((acc, item) => acc + getRejeito(item), 0);
  const naoComercializado = coletasRealizadas.reduce((acc, item) => acc + getNaoComercializado(item), 0);

  const qualidadeItens = coletasRealizadas
    .map(getQualidade)
    .filter((value) => value > 0);

  const qualidadeMedia = qualidadeItens.length
    ? (qualidadeItens.reduce((acc, value) => acc + value, 0) / qualidadeItens.length).toFixed(1)
    : "0";

  return {
    participants: approvedParticipants.length,
    people: peopleCount,
    condos: condoCount,
    coletas: coletasRealizadas.length,
    actions: STATE.approvalRequests.length,
    pesoRecebido,
    rejeito,
    naoComercializado,
    qualidadeMedia
  };
}

function updateKpis() {
  const data = computeDashboardData();

  animateNumber(els.indicatorParticipants, data.participants);
  animateNumber(els.indicatorColetas, data.coletas);
  animateNumber(els.indicatorActions, data.actions);

  animateNumber(els.participantsTotalCount, data.participants);
  animateNumber(els.participantsPeopleCount, data.people);
  animateNumber(els.participantsCondoCount, data.condos);

  setText(els.indicatorPesoRecebido, formatKg(data.pesoRecebido));
  setText(els.indicatorRejeito, formatKg(data.rejeito));
  setText(els.indicatorNaoComercializado, formatKg(data.naoComercializado));
  setText(els.indicatorQualidadeMedia, data.qualidadeMedia);

  renderRecentColetas();
  updateCharts(data);
}

/* =========================================================
   FILTROS DA TABELA
========================================================= */

function getTableFilters() {
  return {
    search: normalizeText(els.tSearch?.value || ""),
    fluxo: els.tFluxo?.value || "__all__",
    entrega: els.tEntrega?.value || "__all__",
    status: els.tStatus?.value || "__all__",
    tipoCadastro: els.tTipoCadastro?.value || "__all__"
  };
}

function populateEntregaFilter(items = []) {
  if (!els.tEntrega) return;

  const currentValue = els.tEntrega.value || "__all__";
  const entregas = new Set();

  items.forEach((item) => {
    const entrega = getEntrega(item);
    if (entrega && entrega !== "Normal") entregas.add(entrega);
  });

  els.tEntrega.innerHTML = `
    <option value="__all__">Todas</option>
    ${Array.from(entregas)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((entrega) => `<option value="${escapeHtml(entrega)}">${escapeHtml(entrega)}</option>`)
      .join("")}
  `;

  if ([...entregas].includes(currentValue)) {
    els.tEntrega.value = currentValue;
  }
}

function applyTableFilterToItems(items = []) {
  const filters = getTableFilters();

  return items.filter((item) => {
    const fluxo = inferFluxoKey(item);
    const entrega = getEntrega(item);
    const status = normalizeText(getColetaStatusLabel(item));
    const tipo = participantType(item);

    if (filters.fluxo !== "__all__" && fluxo !== filters.fluxo) return false;
    if (filters.entrega !== "__all__" && entrega !== filters.entrega) return false;

    if (filters.status !== "__all__") {
      if (filters.status === "ativo" && !status.includes("ativ")) return false;
      if (filters.status === "editado" && !status.includes("edit")) return false;
      if (filters.status === "cancelado" && !status.includes("cancel")) return false;
    }

    if (filters.tipoCadastro !== "__all__") {
      if (filters.tipoCadastro === "participante") {
        if (tipo.includes("condominio") || tipo.includes("comercio")) return false;
      }

      if (filters.tipoCadastro === "condominio" && !tipo.includes("condominio")) return false;
      if (filters.tipoCadastro === "comercio" && !tipo.includes("comercio")) return false;

      if (filters.tipoCadastro === "outro") {
        if (
          tipo.includes("participante") ||
          tipo.includes("familia") ||
          tipo.includes("casa") ||
          tipo.includes("condominio") ||
          tipo.includes("comercio")
        ) return false;
      }
    }

    if (filters.search) {
      const haystack = normalizeText([
        getParticipantName(item),
        getParticipantCode(item),
        getParticipantTypeLabel(item),
        formatFluxoLabel(getTipoRecebimento(item)),
        getEntrega(item),
        getColetaStatusLabel(item),
        JSON.stringify(item)
      ].join(" "));

      if (!haystack.includes(filters.search)) return false;
    }

    return true;
  });
}

function setupTableFilters() {
  els.btnApplyTableFilters?.addEventListener("click", () => {
    STATE.recentPage = 0;
    renderRecentColetas();
  });

  els.btnClearTableFilters?.addEventListener("click", () => {
    if (els.tSearch) els.tSearch.value = "";
    if (els.tFluxo) els.tFluxo.value = "__all__";
    if (els.tEntrega) els.tEntrega.value = "__all__";
    if (els.tStatus) els.tStatus.value = "__all__";
    if (els.tTipoCadastro) els.tTipoCadastro.value = "__all__";

    STATE.recentPage = 0;
    renderRecentColetas();
  });

  els.tSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      STATE.recentPage = 0;
      renderRecentColetas();
    }
  });
}

/* =========================================================
   TABELA RECENTE COM PAGINAÇÃO
========================================================= */

function getSortedColetasTabela() {
  return [...STATE.coletas]
    .sort((a, b) => {
      const dateA = getDateValue(a)?.getTime() || 0;
      const dateB = getDateValue(b)?.getTime() || 0;
      return dateB - dateA;
    });
}

function getSortedRealizadas() {
  return [...STATE.coletas]
    .filter(isColetaRealizada)
    .sort((a, b) => {
      const dateA = getDateValue(a)?.getTime() || 0;
      const dateB = getDateValue(b)?.getTime() || 0;
      return dateB - dateA;
    });
}


function getColetaImageUrl(item = {}) {
  return (
    item.imageUrl ||
    item.imagemUrl ||
    item.photoUrl ||
    item.fotoUrl ||
    item.coletaImageUrl ||
    item.recebimento?.imageUrl ||
    item.recebimento?.imagemUrl ||
    item.finalTurno?.imageUrl ||
    item.finalTurno?.imagemUrl ||
    item.payloadSnapshot?.imageUrl ||
    item.payloadSnapshot?.imagemUrl ||
    item.payloadSnapshot?.fotoUrl ||
    ""
  );
}

function openColetaImageModal(item = {}) {
  const imageUrl = getColetaImageUrl(item);

  if (!imageUrl) {
    alert("Esta coleta não possui imagem salva.");
    return;
  }

  const old = document.getElementById("coletaImageModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "coletaImageModal";
  modal.className = "coleta-modal-overlay";

  modal.innerHTML = `
    <div class="coleta-modal coleta-image-modal">
      <button class="coleta-modal-close" id="closeColetaImageModal" type="button">×</button>

      <div class="coleta-modal-head">
        <h2>Imagem da coleta</h2>
        <p>${escapeHtml(getParticipantName(item))} • ${escapeHtml(formatDateLabel(item))}</p>
      </div>

      <img src="${escapeHtml(imageUrl)}" alt="Imagem da coleta" />
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  modal.addEventListener("click", (event) => {
    if (
      event.target.id === "closeColetaImageModal" ||
      event.target === modal
    ) {
      modal.remove();
      document.body.classList.remove("modal-open");
    }
  });
}

function renderRecentColetas() {
  if (!els.recentColetasTableBody) return;

  const all = getSortedColetasTabela();
  const filtered = applyTableFilterToItems(all);

  const start = STATE.recentPage * STATE.recentPageSize;
  const end = start + STATE.recentPageSize;
  const pageItems = filtered.slice(start, end);

  if (!pageItems.length) {
    els.recentColetasTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="table-empty">Nenhuma coleta encontrada.</td>
      </tr>
    `;

    updateTableCounters(0, filtered.length);
    updateTablePagination(filtered.length);
    return;
  }

  els.recentColetasTableBody.innerHTML = pageItems.map((item) => {
    const participante = getParticipantName(item);
    const codigo = getParticipantCode(item);
    const data = formatDateLabel(item);
    const fluxo = formatFluxoLabel(getTipoRecebimento(item));
    const status = getColetaStatusLabel(item);
    const reciclavel = formatKg(getPesoRecebido(item));
    const rejeito = formatKg(getRejeito(item));
    const naoComercializado = formatKg(getNaoComercializado(item));
    const tipo = getParticipantTypeLabel(item);
    const cancelada = isColetaCancelada(item);

    return `
      <tr class="dashboard-table-row ${cancelada ? "coleta-cancelada" : ""}">
        <td class="td-date">${escapeHtml(data)}</td>

        <td class="td-user">
          <strong>${escapeHtml(participante)}</strong>
          <span>${escapeHtml(tipo)}</span>
        </td>

        <td class="td-code">${escapeHtml(codigo || "—")}</td>

        <td class="td-flow">${escapeHtml(fluxo)}</td>

        <td class="td-status">${statusBadge(status)}</td>

        <td class="td-details">
          <div class="table-detail-tags">
            <span class="detail-tag success">Reciclável: ${escapeHtml(reciclavel)}</span>
            <span class="detail-tag danger">Rejeito: ${escapeHtml(rejeito)}</span>
            <span class="detail-tag warning">Não comercializado: ${escapeHtml(naoComercializado)}</span>
          </div>
        </td>

        
          <td class="td-actions">

  <button
    class="table-btn view"
    type="button"
    data-view-coleta="${escapeHtml(item.id)}"
  >
    Ver coleta
  </button>

  <button
    class="table-btn image"
    type="button"
    data-image-coleta="${escapeHtml(item.id)}"
  >
    Imagem
  </button>

  <button
    class="table-btn edit"
    type="button"
    data-edit-coleta="${escapeHtml(item.id)}"
  >
    Editar
  </button>

  <button
    class="table-btn warning"
    type="button"
    data-cancel-coleta="${escapeHtml(item.id)}"
  >
    ${cancelada ? "Reativar" : "Cancelar"}
  </button>

  <button
    class="table-btn cancel"
    type="button"
    data-delete-coleta="${escapeHtml(item.id)}"
  >
    Excluir
  </button>


        </td>
      </tr>
    `;
  }).join("");

  updateTableCounters(pageItems.length, filtered.length);
  updateTablePagination(filtered.length);
}
function updateTableCounters(visible, filtered) {
  setText(els.tableVisibleCount, visible);
  setText(els.tableFilteredCount, filtered);
  setText(els.tableLastUpdate, formatDateTimeLabel(new Date()));
}

function updateTablePagination(total) {
  const start = total === 0 ? 0 : STATE.recentPage * STATE.recentPageSize + 1;
  const end = Math.min((STATE.recentPage + 1) * STATE.recentPageSize, total);

  if (els.tablePageIndicator) {
    els.tablePageIndicator.textContent =
      total > 0 ? `Mostrando ${start}-${end} de ${total}` : "Nenhuma coleta";
  }

  if (els.btnPrevColetas) {
    els.btnPrevColetas.disabled = STATE.recentPage <= 0;
  }

  if (els.btnNextColetas) {
    els.btnNextColetas.disabled = end >= total;
  }
}

function setupTablePagination() {
  els.btnPrevColetas?.addEventListener("click", () => {
    if (STATE.recentPage <= 0) return;

    STATE.recentPage -= 1;
    renderRecentColetas();
  });

  els.btnNextColetas?.addEventListener("click", () => {
    const total = applyTableFilterToItems(getSortedColetasTabela()).length;
    const totalPages = Math.ceil(total / STATE.recentPageSize);

    if (STATE.recentPage >= totalPages - 1) return;

    STATE.recentPage += 1;
    renderRecentColetas();
  });
}

function updateLoadMoreButton() {
  const btn = els.btnLoadMoreColetas || document.getElementById("btnLoadMoreColetas");
  if (!btn) return;

  btn.style.display = "none";
}

function setupLoadMoreColetasButton() {
  const btn = els.btnLoadMoreColetas || document.getElementById("btnLoadMoreColetas");
  if (!btn) return;

  btn.addEventListener("click", () => {
    STATE.recentLimit += 10;
    renderRecentColetas();
  });
}

/* =========================================================
   MODAL COLETA
========================================================= */

function openColetaModal(item) {
  const old = document.getElementById("coletaDetailsModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "coletaDetailsModal";
  modal.className = "coleta-modal-overlay";

  modal.innerHTML = `
    <div class="coleta-modal">
      <button class="coleta-modal-close" id="closeColetaModal" type="button">×</button>

      <div class="coleta-modal-head">
        <h2>Detalhes da coleta</h2>
        <p>Visualização completa do registro salvo.</p>
      </div>

      <div class="coleta-modal-grid">
        <div class="coleta-info-card"><strong>Data:</strong> ${escapeHtml(formatDateLabel(item))}</div>
        <div class="coleta-info-card"><strong>Fluxo:</strong> ${escapeHtml(formatFluxoLabel(getTipoRecebimento(item)))}</div>
        <div class="coleta-info-card"><strong>Entrega:</strong> ${escapeHtml(getEntrega(item))}</div>
        <div class="coleta-info-card"><strong>Participante:</strong> ${escapeHtml(getParticipantName(item))}</div>
        <div class="coleta-info-card"><strong>Código:</strong> ${escapeHtml(getParticipantCode(item))}</div>
        <div class="coleta-info-card"><strong>Tipo cadastro:</strong> ${escapeHtml(getParticipantTypeLabel(item))}</div>
        <div class="coleta-info-card"><strong>Status:</strong> ${escapeHtml(getColetaStatusLabel(item))}</div>
        <div class="coleta-info-card"><strong>Qualidade:</strong> ${escapeHtml(getQualidade(item) || "—")}</div>
        <div class="coleta-info-card"><strong>Peso recebido:</strong> ${escapeHtml(formatKg(getPesoRecebido(item)))}</div>
        <div class="coleta-info-card"><strong>Rejeito:</strong> ${escapeHtml(formatKg(getRejeito(item)))}</div>
        <div class="coleta-info-card"><strong>Não comercializado:</strong> ${escapeHtml(formatKg(getNaoComercializado(item)))}</div>
      </div>

      <div class="coleta-materials-box">
        <h3>Materiais informados</h3>
        <div class="coleta-materials-list">
          ${renderMaterialsList(item)}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.classList.add("modal-open");

  modal.addEventListener("click", (event) => {
    if (event.target.id === "closeColetaModal" || event.target === modal) {
      modal.remove();
      document.body.classList.remove("modal-open");
    }
  });
}

function getMaterialValue(item = {}, keys = []) {
  for (const key of keys) {
    const value =
      item[key] ??
      item.finalTurno?.[key] ??
      item.recebimento?.[key] ??
      item.payloadSnapshot?.[key] ??
      item.materiais?.[key] ??
      item.materials?.[key];

    if (value !== undefined && value !== null && value !== "") {
      return toNumber(value);
    }
  }

  return 0;
}

function openEditColetaModal(item) {

  const old = document.getElementById(
    "coletaEditModal"
  );

  if (old) old.remove();

  const fluxo =
    inferFluxoKey(item);

  const isFinalTurno =
    fluxo === "final_turno";

  const modal = document.createElement("div");

  modal.id = "coletaEditModal";

  modal.className =
    "coleta-modal-overlay";

  modal.innerHTML = `

    <div class="coleta-modal coleta-edit-modal">

      <button
        class="coleta-modal-close"
        id="closeEditColetaModal"
        type="button"
      >
        ×
      </button>

      <div class="coleta-modal-head">

        <h2>Editar registro</h2>

        <p>
          Atualize os dados incorretos antes de salvar.
        </p>

      </div>

      <form id="editColetaForm">

        <div class="coleta-modal-grid">

          <label class="coleta-info-card">

            <strong>Participante</strong>

            <input
              type="text"
              name="participantName"
              value="${escapeHtml(
                getParticipantName(item)
              )}"
            />

          </label>

          <label class="coleta-info-card">

            <strong>Fluxo</strong>

            <select name="flowType">

              <option
                value="recebimento"
                ${
                  !isFinalTurno
                    ? "selected"
                    : ""
                }
              >
                Recebimento
              </option>

              <option
                value="final_turno"
                ${
                  isFinalTurno
                    ? "selected"
                    : ""
                }
              >
                Final do turno
              </option>

            </select>

          </label>

          <label class="coleta-info-card">

            <strong>Entrega</strong>

            <input
              type="text"
              name="entrega"
              value="${escapeHtml(
                getEntrega(item)
              )}"
            />

          </label>

          <label class="coleta-info-card">

            <strong>Resíduo seco (kg)</strong>

            <input
              type="number"
              min="0"
              step="0.01"
              name="pesoRecebido"
              value="${getPesoRecebido(item)}"
            />

          </label>

          <label class="coleta-info-card">

            <strong>Qualidade</strong>

            <select name="qualidade">

              <option value="1" ${
                getQualidade(item) == 1
                  ? "selected"
                  : ""
              }>
                1 • Muito baixa
              </option>

              <option value="2" ${
                getQualidade(item) == 2
                  ? "selected"
                  : ""
              }>
                2 • Média
              </option>

              <option value="3" ${
                getQualidade(item) == 3
                  ? "selected"
                  : ""
              }>
                3 • Alta
              </option>

            </select>

          </label>

          <label class="coleta-info-card">

            <strong>Rejeito (kg)</strong>

            <input
              type="number"
              min="0"
              step="0.01"
              name="rejeito"
              value="${getRejeito(item)}"
            />

          </label>

          <label class="coleta-info-card">

            <strong>Não comercializado (kg)</strong>

            <input
              type="number"
              min="0"
              step="0.01"
              name="naoComercializado"
              value="${getNaoComercializado(item)}"
            />

          </label>

        </div>

        ${
          isFinalTurno
            ? `
        <div class="coleta-materials-box">

          <h3>Frações de resíduos</h3>

          <div class="coleta-modal-grid">

            <label class="coleta-info-card">
              <strong>Plástico (kg)</strong>
             <input type="number" step="0.01" name="plasticoKg" value="${getMaterialValue(item, ["plasticoKg", "plastico"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Vidro (kg)</strong>
              <input type="number" step="0.01" name="vidroKg" value="${getMaterialValue(item, ["vidroKg", "vidro"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Metal / Alumínio (kg)</strong>
              <input type="number" step="0.01" name="metalKg" value="${getMaterialValue(item, ["metalKg", "aluminioMetalKg"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Sacaria (kg)</strong>
              <input type="number" step="0.01" name="sacariaKg" value="${getMaterialValue(item, ["sacariaKg", "sacaria"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Papel misto (kg)</strong>
              <input type="number" step="0.01" name="papelMistoKg" value="${getMaterialValue(item, ["papelMistoKg", "papelMisto"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Papelão (kg)</strong>
              <input type="number" step="0.01" name="papelaoKg" value="${getMaterialValue(item, ["papelaoKg", "papelao"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Isopor (kg)</strong>
              <input type="number" step="0.01" name="isoporKg" value="${getMaterialValue(item, ["isoporKg", "isopor"])}">
            </label>

            <label class="coleta-info-card">
              <strong>Óleo de cozinha (kg)</strong>
              <input type="number" step="0.01" name="oleoKg" value="${getMaterialValue(item, ["oleoKg", "oleo"])}">
            </label>

          </div>

        </div>
        `
            : ""
        }

        <label class="coleta-materials-box">

          <h3>Observação</h3>

          <textarea
            name="observacao"
            rows="4"
            placeholder="Motivo do ajuste / observação"
          >${escapeHtml(
            item.observacao || ""
          )}</textarea>

        </label>

        <div class="coleta-edit-actions">

          <button
            class="primary-link-button"
            type="submit"
          >
            Salvar edição
          </button>

          <button
            class="table-page-btn"
            id="cancelEditColetaModal"
            type="button"
          >
            Cancelar
          </button>

        </div>

      </form>

    </div>
  `;

  document.body.appendChild(modal);

  document.body.classList.add(
    "modal-open"
  );

  function closeModal() {

    modal.remove();

    document.body.classList.remove(
      "modal-open"
    );
  }

  modal.addEventListener(
    "click",
    (event) => {

      if (
        event.target.id ===
          "closeEditColetaModal"

        ||

        event.target.id ===
          "cancelEditColetaModal"

        ||

        event.target === modal
      ) {

        closeModal();
      }
    }
  );

  modal.querySelector(
    "#editColetaForm"
  )?.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const formData =
        new FormData(event.target);

      await updateDoc(
        doc(db, "coletas", item.id),
        {

          participantName:String(
            formData.get("participantName") || ""
          ).trim(),

          flowType:String(
            formData.get("flowType") || ""
          ).trim(),

          entrega:String(
            formData.get("entrega") || ""
          ).trim(),

          pesoRecebido:toNumber(
            formData.get("pesoRecebido")
          ),

          pesoResiduoSecoKg:toNumber(
            formData.get("pesoRecebido")
          ),

          qualidade:toNumber(
            formData.get("qualidade")
          ),

          rejeito:toNumber(
            formData.get("rejeito")
          ),

          naoComercializado:toNumber(
            formData.get("naoComercializado")
          ),

          plasticoKg:toNumber(
            formData.get("plasticoKg")
          ),

          vidroKg:toNumber(
            formData.get("vidroKg")
          ),

          metalKg:toNumber(
            formData.get("metalKg")
          ),

          sacariaKg:toNumber(
            formData.get("sacariaKg")
          ),

          papelMistoKg:toNumber(
            formData.get("papelMistoKg")
          ),

          papelaoKg:toNumber(
            formData.get("papelaoKg")
          ),

          isoporKg:toNumber(
            formData.get("isoporKg")
          ),

          oleoKg:toNumber(
            formData.get("oleoKg")
          ),

          observacao:String(
            formData.get("observacao") || ""
          ).trim(),

          updatedAt:serverTimestamp(),

          updatedBy:
            STATE.currentUser?.uid || null
        }
      );

      closeModal();

      setCoopSyncStatus(
        "Coleta atualizada com sucesso."
      );
    }
  );
}
async function carregarSolicitacoesGuardioes(cooperativaId) {
  const tbody = document.getElementById("guardioesCoopTableBody");
  const indicador = document.getElementById("indicatorGuardioesSolicitacoes");

  if (!tbody) return;

  try {
    const snap = await getDocs(
      query(
        collection(dbGuardioes, "cooperativas", cooperativaId, "solicitacoes"),
        orderBy("createdAt", "desc")
      )
    );

    if (indicador) {
      indicador.textContent = snap.size;
    }

    if (snap.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">Nenhuma solicitação encontrada.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = snap.docs.map((docItem) => {
      const item = docItem.data();
      const id = docItem.id;

      const data =
        item.createdAt?.toDate?.().toLocaleString("pt-BR") ||
        "-";

      const status = item.status || "solicitado";
      const whatsappLimpo = String(item.whatsapp || "").replace(/\D/g, "");
      const whatsappLink = whatsappLimpo
        ? `https://wa.me/55${whatsappLimpo}`
        : "#";

      return `
        <tr>
          <td>${escapeHtml(data)}</td>
          <td>${escapeHtml(item.nome || "-")}</td>
          <td>
            <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(item.whatsapp || "-")}
            </a>
          </td>
          <td>${escapeHtml(item.endereco || "-")}</td>
          <td>${escapeHtml(item.cep || "-")}</td>
          <td>
            <span class="status-pill ${status === "contatado" ? "" : "inactive"}">
              ${escapeHtml(status)}
            </span>
          </td>
          <td>
            <button
              type="button"
              class="table-btn view"
              data-contatar-guardiao="${escapeHtml(id)}"
              data-whatsapp="${escapeHtml(whatsappLink)}"
            >
              Entrar em contato
            </button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (error) {
    console.error("Erro ao carregar solicitações dos Guardiões:", error);

    if (indicador) indicador.textContent = "0";

    tbody.innerHTML = `
      <tr>
        <td colspan="7">Erro ao carregar solicitações.</td>
      </tr>
    `;
  }
}
async function marcarGuardiaoComoContatado(solicitacaoId) {
  if (!solicitacaoId) return;

  try {
    await updateDoc(
      doc(
        dbGuardioes,
        "cooperativas",
        PAGE_TERRITORY.territoryId,
        "solicitacoes",
        solicitacaoId
      ),
      {
        status: "contatado",
        contactedAt: serverTimestamp(),
        contactedBy: STATE.currentUser?.uid || null,
        updatedAt: serverTimestamp()
      }
    );

    await carregarSolicitacoesGuardioes(PAGE_TERRITORY.territoryId);

  } catch (error) {
    console.error("Erro ao atualizar solicitação:", error);
    alert("Erro ao atualizar solicitação.");
  }
}


async function toggleCancelColetaRecord(coletaId) {

  if (!coletaId) return;

  try {

    const coleta = STATE.coletas.find(
      item => String(item.id) === String(coletaId)
    );

    if (!coleta) {
      alert("Coleta não encontrada.");
      return;
    }

    const cancelada = normalizeText(
      coleta.status ||
      coleta.coletaStatus ||
      ""
    ).includes("cancel");

    const confirmed = confirm(
      cancelada
        ? "Deseja reativar esta coleta?"
        : "Deseja cancelar esta coleta?\n\nEla ficará pausada, fora das contagens, mas continuará salva no banco."
    );

    if (!confirmed) return;

    await updateDoc(
      doc(db, "coletas", coletaId),
      {
        status: cancelada ? "ativo" : "cancelado",
        coletaStatus: cancelada ? "ativo" : "cancelado",
        cancelled: cancelada ? false : true,
        cancelada: cancelada ? false : true,
        cancelledAt: cancelada ? null : serverTimestamp(),
        cancelledBy: cancelada ? null : STATE.currentUser?.uid || null,
        reactivatedAt: cancelada ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
        updatedBy: STATE.currentUser?.uid || null
      }
    );

    setCoopSyncStatus(
      cancelada
        ? "Coleta reativada com sucesso."
        : "Coleta cancelada e pausada com sucesso."
    );

  } catch (error) {
    console.error("Erro ao alterar status da coleta:", error);
    alert("Erro ao alterar status da coleta.");
  }
}

async function deleteColetaRecord(coletaId) {

  if (!coletaId) {
    return;
  }

  const confirmed = confirm(
    "Deseja realmente excluir esta coleta?\n\nEssa ação remove permanentemente os dados do banco."
  );

  if (!confirmed) {
    return;
  }

  try {

    const coleta =
      STATE.coletas.find(
        (item) =>
          String(item.id) === String(coletaId)
      );

    if (!coleta) {

      alert("Coleta não encontrada.");

      return;
    }

    /* =====================================================
       REMOVE DO FIREBASE
    ===================================================== */

    await deleteDoc(
      doc(
        db,
        "coletas",
        coletaId
      )
    );

    /* =====================================================
       REMOVE LOCALMENTE
    ===================================================== */

    STATE.coletas =
      STATE.coletas.filter(
        (item) =>
          String(item.id) !== String(coletaId)
      );

    /* =====================================================
       ATUALIZA UI
    ===================================================== */

    updateKpis();

    renderRecentColetas();

    updateCharts(
      computeDashboardData()
    );

    setCoopSyncStatus(
      "Coleta removida com sucesso."
    );

  } catch (error) {

    console.error(
      "Erro ao excluir coleta:",
      error
    );

    alert(
      "Erro ao excluir coleta."
    );
  }
}

function setupRecentColetasActions() {

  document.addEventListener(
    "click",
    (event) => {

      /* =====================================================
         VER COLETA
      ===================================================== */

      const viewButton =
        event.target.closest(
          "[data-view-coleta]"
        );

      if (viewButton) {

        const coletaId =
          viewButton.dataset.viewColeta;

        const coleta =
          STATE.coletas.find(
            (item) =>
              String(item.id) ===
              String(coletaId)
          );

        if (!coleta) return;

        openColetaModal(coleta);

        return;
      }

      /* =====================================================
         VER IMAGEM
      ===================================================== */

      const imageButton =
        event.target.closest(
          "[data-image-coleta]"
        );

      if (imageButton) {

        const coletaId =
          imageButton.dataset.imageColeta;

        const coleta =
          STATE.coletas.find(
            (item) =>
              String(item.id) ===
              String(coletaId)
          );

        if (!coleta) return;

        openColetaImageModal(coleta);

        return;
      }

      /* =====================================================
         EDITAR
      ===================================================== */

      const editButton =
        event.target.closest(
          "[data-edit-coleta]"
        );

      if (editButton) {

        const coletaId =
          editButton.dataset.editColeta;

        const coleta =
          STATE.coletas.find(
            (item) =>
              String(item.id) ===
              String(coletaId)
          );

        if (!coleta) return;

        openEditColetaModal(coleta);

        return;
      }

      /* =====================================================
         CANCELAR / REATIVAR
      ===================================================== */

      const cancelButton =
        event.target.closest(
          "[data-cancel-coleta]"
        );

      if (cancelButton) {

        const coletaId =
          cancelButton.dataset.cancelColeta;

        toggleCancelColetaRecord(
          coletaId
        );

        return;
      }

      /* =====================================================
         EXCLUIR
      ===================================================== */

      const deleteButton =
        event.target.closest(
          "[data-delete-coleta]"
        );

      if (deleteButton) {

        const coletaId =
          deleteButton.dataset.deleteColeta;

        deleteColetaRecord(
          coletaId
        );

        return;
      }

      /* =====================================================
         GUARDIÕES URBANOS
      ===================================================== */

      const contatoGuardiaoBtn =
        event.target.closest(
          "[data-contatar-guardiao]"
        );

      if (contatoGuardiaoBtn) {

        const solicitacaoId =
          contatoGuardiaoBtn.dataset.contatarGuardiao;

        const whatsappLink =
          contatoGuardiaoBtn.dataset.whatsapp;

        marcarGuardiaoComoContatado(
          solicitacaoId
        );

        if (
          whatsappLink &&
          whatsappLink !== "#"
        ) {
          window.open(
            whatsappLink,
            "_blank"
          );
        }

        return;
      }
    }
  );

  /* =====================================================
     ESC FECHA MODAIS
  ===================================================== */

  document.addEventListener(
    "keydown",
    (event) => {

      if (event.key !== "Escape") {
        return;
      }

      const modal =
        document.getElementById(
          "coletaDetailsModal"
        );

      const editModal =
        document.getElementById(
          "coletaEditModal"
        );

      const imageModal =
        document.getElementById(
          "coletaImageModal"
        );

      if (modal) modal.remove();

      if (editModal) editModal.remove();

      if (imageModal) imageModal.remove();

      document.body.classList.remove(
        "modal-open"
      );
    }
  );
}

/* =========================================================
   GRÁFICOS
========================================================= */

function buildMonthlyColetasSeries(items = []) {
  const map = new Map();

  items
    .filter(isColetaRealizada)
    .forEach((item) => {
      const date = getDateValue(item);
      if (!date) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const label = date.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit"
      });

      if (!map.has(key)) {
        map.set(key, {
          key,
          label,
          total: 0
        });
      }

      map.get(key).total += 1;
    });

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-8);
}

function updateCharts(data) {
  const monthly = buildMonthlyColetasSeries(STATE.coletas);

  const totalLabel = document.getElementById("chartTotalColetasLabel");

  if (totalLabel) {
    totalLabel.textContent = String(data.coletas || 0);
  }

  if (els.chartColetasMensais) {
    const max = Math.max(...monthly.map((item) => item.total), 1);

    if (!monthly.length) {
      els.chartColetasMensais.innerHTML = `
        <div class="empty-chart-message">Sem coletas para exibir.</div>
      `;
    } else {
      els.chartColetasMensais.innerHTML = monthly
        .map((item) => {
          const height = Math.max(8, Math.round((item.total / max) * 100));

          return `
            <div class="powerbi-bar-item">
              <span class="powerbi-bar-value">${item.total}</span>
              <div class="powerbi-bar" style="height:${height}%"></div>
              <span class="powerbi-bar-label">${escapeHtml(item.label)}</span>
            </div>
          `;
        })
        .join("");
    }
  }

  const totalParticipants = Math.max(Number(data.participants || 0), 0);
  const people = Math.max(Number(data.people || 0), 0);
  const condos = Math.max(Number(data.condos || 0), 0);
  const others = Math.max(totalParticipants - people - condos, 0);
  const totalForDonut = Math.max(totalParticipants, 1);

  const peoplePercent = (people / totalForDonut) * 100;
  const condoPercent = (condos / totalForDonut) * 100;
  const otherPercent = (others / totalForDonut) * 100;

  const donut = document.getElementById("chartParticipantesPerfil");
  const chartTotalParticipantesLabel = document.getElementById("chartTotalParticipantesLabel");

  if (chartTotalParticipantesLabel) {
    chartTotalParticipantesLabel.textContent = String(totalParticipants);
  }

  if (donut) {
    const p1 = peoplePercent;
    const p2 = peoplePercent + condoPercent;
    const p3 = peoplePercent + condoPercent + otherPercent;

    donut.style.background = `
      conic-gradient(
        #81B92A 0 ${p1}%,
        #53ACDE ${p1}% ${p2}%,
        #EF6B22 ${p2}% ${p3}%
      )
    `;
  }

  const peso = Number(data.pesoRecebido || 0);
  const rejeito = Number(data.rejeito || 0);
  const naoComercializado = Number(data.naoComercializado || 0);
  const maxPeso = Math.max(peso, rejeito, naoComercializado, 1);

  const barPeso = document.getElementById("barPesoRecebido");
  const barRejeito = document.getElementById("barRejeito");
  const barNaoComercializado = document.getElementById("barNaoComercializado");

  const barPesoLabel = document.getElementById("barPesoRecebidoLabel");
  const barRejeitoLabel = document.getElementById("barRejeitoLabel");
  const barNaoComercializadoLabel = document.getElementById("barNaoComercializadoLabel");

  if (barPeso) barPeso.style.width = `${Math.max(2, (peso / maxPeso) * 100)}%`;
  if (barRejeito) barRejeito.style.width = `${Math.max(2, (rejeito / maxPeso) * 100)}%`;
  if (barNaoComercializado) barNaoComercializado.style.width = `${Math.max(2, (naoComercializado / maxPeso) * 100)}%`;

  if (barPesoLabel) barPesoLabel.textContent = formatKg(peso);
  if (barRejeitoLabel) barRejeitoLabel.textContent = formatKg(rejeito);
  if (barNaoComercializadoLabel) barNaoComercializadoLabel.textContent = formatKg(naoComercializado);
}

/* =========================================================
   PERMISSÕES / DADOS
========================================================= */

function applyPermissionRules(profile) {
  STATE.isAdmin = isAdminUser(profile.role);
  STATE.canEditAll = isGovernancaUser(profile.role);
}

function applyRoleVisibility(profile) {
  const canManageUsers = isAdminUser(profile.role) || isGovernancaUser(profile.role);

  const userLinks = [
    document.querySelector('a[href="usuario-cooperativa-vila-pinto.html"]'),
    document.querySelector('a[href="usuarios.html"]')
  ].filter(Boolean);

  userLinks.forEach((link) => {
    link.style.display = canManageUsers ? "" : "none";
  });

  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !canManageUsers);
  });
}

function listenDashboardData() {
  clearUnsubscribers();

  listenCollection("participants", (items) => {
    STATE.participants = items
      .filter(itemBelongsToTerritory)
      .filter((item) => {
        const status = normalizeText(item.approvalStatus || item.status || item.decision);
        return status !== "rejected" && status !== "rejeitado";
      });

    updateKpis();
  });

listenCollection("coletas", (items) => {
  STATE.coletas = items
    .filter(itemBelongsToTerritory);

  STATE.recentPage = 0;

  populateEntregaFilter(STATE.coletas);

  updateKpis();
  renderRecentColetas();
});

  listenCollection("approvalRequests", (items) => {
    STATE.approvalRequests = items
      .filter(itemBelongsToTerritory)
      .filter(isPendingParticipant);

    updateKpis();
  });
}

/* =========================================================
   EXPORTAÇÃO / SINCRONIZAÇÃO
========================================================= */

function setupExportButton() {
  els.exportParticipantsPdfBtn?.addEventListener("click", () => {
    exportParticipantsListPdf();
  });
}

function exportParticipantsListPdf() {
  const participants = STATE.participants
    .filter(isApprovedParticipant)
    .sort((a, b) => getParticipantName(a).localeCompare(getParticipantName(b), "pt-BR"));

  const rows = participants.map((item) => `
    <tr>
      <td>${escapeHtml(getParticipantName(item))}</td>
      <td>${escapeHtml(getParticipantCode(item))}</td>
      <td>${escapeHtml(getParticipantTypeLabel(item))}</td>
      <td>${escapeHtml(item.participantPhone || item.phone || item.telefone || "-")}</td>
      <td>${escapeHtml(item.enderecoCompleto || item.address || item.payloadSnapshot?.enderecoCompleto || "-")}</td>
    </tr>
  `).join("");

  const printWindow = window.open("", "_blank", "width=1100,height=800");

  printWindow.document.write(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Lista de Participantes - ${escapeHtml(PAGE_TERRITORY.cooperativeName)}</title>
      <style>
        body{
          font-family: Arial, sans-serif;
          padding:24px;
          color:#222;
        }

        h1{
          margin:0;
          font-size:24px;
        }

        p{
          margin:6px 0 18px;
          color:#555;
        }

        table{
          width:100%;
          border-collapse:collapse;
          font-size:12px;
        }

        th,td{
          border:1px solid #ddd;
          padding:8px;
          text-align:left;
          vertical-align:top;
        }

        th{
          background:#81B92A;
          color:#fff;
          font-weight:700;
        }

        tr:nth-child(even){
          background:#f7f7f7;
        }
      </style>
    </head>

    <body>
      <h1>Lista de Participantes</h1>
      <p>
        ${escapeHtml(PAGE_TERRITORY.cooperativeName)} • 
        Total: ${participants.length} participante(s) • 
        Emitido em ${new Date().toLocaleString("pt-BR")}
      </p>

      <table>
        <thead>
          <tr>
            <th>Participante</th>
            <th>Código</th>
            <th>Tipo</th>
            <th>Telefone</th>
            <th>Endereço</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `
            <tr>
              <td colspan="5">Nenhum participante aprovado encontrado.</td>
            </tr>
          `}
        </tbody>
      </table>

      <script>
        window.onload = () => {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function setupSyncButton() {
  els.syncCoopDashboardBtn?.addEventListener("click", () => {
    setCoopSyncStatus(`Atualizado em ${new Date().toLocaleString("pt-BR")}`);
    updateKpis();
    renderRecentColetas();
  });
}

/* =========================================================
   BOOT
========================================================= */

function boot() {
  setupSidebar();
  setupLogout();
  setupTopbarShadow();
  setupExportButton();
  setupSyncButton();
  setupLoadMoreColetasButton();
  setupTablePagination();
  setupTableFilters();
  setupRecentColetasActions();
  fillStaticPanels();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      STATE.currentUser = user;

      const profile = await getUserProfile(user.uid);
      validateProfile(profile);

      STATE.profile = profile;
      await registerAccessLog({
  db,
  auth,
  page: "painel-cooperativa",
  pageType: "logada",
  territoryId: PAGE_TERRITORY.territoryId,
  cooperativeName: PAGE_TERRITORY.cooperativeName,
  userProfile: profile
});
  
      applyPermissionRules(profile);
      fillHeader(profile);
      applyRoleVisibility(profile);
      listenDashboardData();
      await carregarSolicitacoesGuardioes(PAGE_TERRITORY.territoryId);

      setCoopSyncStatus("Indicadores carregados em tempo real.");

      document.body.classList.add("dashboard-loaded");
    } catch (error) {
      console.error("Erro ao carregar painel da cooperativa:", error);
      alert(error.message || "Não foi possível carregar o painel.");
      window.location.href = "login.html";
    }
  });
}

boot();