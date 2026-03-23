import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const MATERIAL_META = [
  { key: "plasticoKg", label: "Plástico", price: 1.92 },
  { key: "vidroKg", label: "Vidro", price: 0.08 },
  { key: "metalKg", label: "Metal", price: 2.9 },
  { key: "sacariaKg", label: "Sacaria", price: 0.12 },
  { key: "papelMistoKg", label: "Papel misto", price: 0.66 },
  { key: "papelaoKg", label: "Papelão", price: 0.52 },
  { key: "isoporKg", label: "Isopor", price: 0.4 },
  { key: "oleoCozinhaKg", label: "Óleo de cozinha", price: 1.5 }
];

const els = {
  fTerritorio: document.getElementById("fTerritorio"),
  fFluxo: document.getElementById("fFluxo"),
  fEntrega: document.getElementById("fEntrega"),
  fIni: document.getElementById("fIni"),
  fFim: document.getElementById("fFim"),
  fBusca: document.getElementById("fBusca"),

  btnAplicar: document.getElementById("btnAplicar"),
  btnLimpar: document.getElementById("btnLimpar"),
  btnPrint: document.getElementById("btnPrint"),

  txtPeriodo: document.getElementById("txtPeriodo"),
  txtRegistrosTopo: document.getElementById("txtRegistrosTopo"),

  userDisplayName: document.getElementById("userDisplayName"),
  userRole: document.getElementById("userRole"),
  userTerritory: document.getElementById("userTerritory"),
  dbStatus: document.getElementById("dbStatus"),

  k_totalColetas: document.getElementById("k_totalColetas"),
  k_participantes: document.getElementById("k_participantes"),
  k_residuoSeco: document.getElementById("k_residuoSeco"),
  k_rejeito: document.getElementById("k_rejeito"),
  k_finalTurno: document.getElementById("k_finalTurno"),
  k_territoriosAtivos: document.getElementById("k_territoriosAtivos"),

  tableColetasBody: document.getElementById("tableColetasBody"),
  historyBody: document.getElementById("historyBody"),

  photoModal: document.getElementById("photoModal"),
  photoModalImg: document.getElementById("photoModalImg"),

  editModal: document.getElementById("editModal"),
  editParticipantName: document.getElementById("editParticipantName"),
  editFluxo: document.getElementById("editFluxo"),
  editEntrega: document.getElementById("editEntrega"),
  editPesoBase: document.getElementById("editPesoBase"),
  editQualidade: document.getElementById("editQualidade"),
  editRejeito: document.getElementById("editRejeito"),
  editNaoComercializado: document.getElementById("editNaoComercializado"),
  editObs: document.getElementById("editObs"),
  btnSaveEdit: document.getElementById("btnSaveEdit")
};

let coopProfile = null;
let allColetas = [];
let filteredColetas = [];
let participantsMap = new Map();
let activeEditId = null;

let mainChart = null;
let secA = null;
let secB = null;
let secC = null;
let weightTimelineChart = null;

function formatDateBR(value) {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
    return new Intl.DateTimeFormat("pt-BR").format(date);
  } catch {
    return "—";
  }
}

function formatDateTimeBR(value) {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  } catch {
    return "—";
  }
}

function formatKg(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} kg`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

function formatMoneyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function safeText(value) {
  return String(value ?? "—");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function createdAtToISO(item) {
  if (item.createdAt?.toDate) {
    return item.createdAt.toDate().toISOString();
  }
  if (item.updatedAt?.toDate) {
    return item.updatedAt.toDate().toISOString();
  }
  return "";
}

function inferDateISO(item) {
  if (item.opDate) return item.opDate;
  return createdAtToISO(item);
}

function inferDateTimeISO(item) {
  return createdAtToISO(item) || item.opDate || "";
}

function firstPhotoUrl(item) {
  if (item.photoURL) return item.photoURL;
  if (item.photoUrl) return item.photoUrl;
  if (item.fotoURL) return item.fotoURL;
  if (item.fotoUrl) return item.fotoUrl;

  if (Array.isArray(item.photos) && item.photos.length) return item.photos[0];
  if (Array.isArray(item.fotos) && item.fotos.length) return item.fotos[0];

  if (Array.isArray(item.recebimento?.fotosResiduo) && item.recebimento.fotosResiduo.length) {
    return item.recebimento.fotosResiduo[0];
  }

  if (
    Array.isArray(item.recebimento?.fotosNaoComercializado) &&
    item.recebimento.fotosNaoComercializado.length
  ) {
    return item.recebimento.fotosNaoComercializado[0];
  }

  return "";
}

function resolveParticipant(item) {
  const participantId = item.participantId || null;
  const participantCode = item.participantCode || null;
  const familyCode = item.recebimento?.familyCode || null;
  const directName = item.participantName || null;

  const fromId = participantId ? participantsMap.get(String(participantId)) : null;
  const fromParticipantCode = participantCode ? participantsMap.get(String(participantCode)) : null;
  const fromFamilyCode = familyCode ? participantsMap.get(String(familyCode)) : null;

  const matched = fromId || fromParticipantCode || fromFamilyCode || null;
  const fallbackCode = participantCode || familyCode || "—";

  return {
    id: participantId || matched?.id || "",
    code: matched?.participantCode || fallbackCode,
    name: directName || matched?.name || (fallbackCode !== "—" ? `Família ${fallbackCode}` : "Sem participante vinculado")
  };
}

function getQualidade(item) {
  const value = item.recebimento?.qualidadeNota;
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function renderQualidadeBadge(item) {
  const q = getQualidade(item);

  if (!q) return `<span class="quality-badge">—</span>`;
  if (q === "1") return `<span class="quality-badge quality-1">1</span>`;
  if (q === "2") return `<span class="quality-badge quality-2">2</span>`;
  if (q === "3") return `<span class="quality-badge quality-3">3</span>`;

  return `<span class="quality-badge">${safeText(q)}</span>`;
}

function getStatus(item) {
  return String(item.status || "ativo").toLowerCase();
}

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

function inferTerritorio(item) {
  return item.territoryLabel || coopProfile?.territoryLabel || "Território";
}

function inferFluxo(item) {
  return String(item.flowType || "").toLowerCase() || "—";
}

function inferEntrega(item) {
  return item.deliveryType || "—";
}

function inferPesoBase(item) {
  return Number(item.recebimento?.pesoResiduoSecoKg ?? 0);
}

function inferResiduoSeco(item) {
  return Number(item.recebimento?.pesoResiduoSecoKg ?? 0);
}

function inferRejeito(item) {
  return Number(item.recebimento?.pesoRejeitoKg ?? 0);
}

function inferNaoComercializado(item) {
  return Number(item.recebimento?.pesoNaoComercializadoKg ?? 0);
}

function inferObservacao(item) {
  return item.observacao || item.recebimento?.observacao || "";
}

function matchesDateRange(item, ini, fim) {
  const dateIso = inferDateISO(item);
  if (!dateIso) return true;

  const onlyDate = String(dateIso).slice(0, 10);

  if (ini && onlyDate < ini) return false;
  if (fim && onlyDate > fim) return false;
  return true;
}

function fillUser(profile) {
  els.userDisplayName.textContent = profile.displayName || profile.name || "Usuário";
  els.userRole.textContent = profile.role || "cooperativa";
  els.userTerritory.textContent = profile.territoryLabel || profile.territoryId || "—";
  const mapMiniText = document.getElementById("mapMiniText");
  if (mapMiniText) {
    mapMiniText.textContent = profile.territoryLabel
      ? `${profile.territoryLabel}\nTerritório ativo`
      : "Centro de Triagem / Território ativo";
  }
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado.");
  return snap.data();
}

function validateProfile(profile) {
  if (profile.role !== "cooperativa") {
    throw new Error("Acesso permitido somente para cooperativa.");
  }

  if (profile.status !== "active") {
    throw new Error("Usuário sem acesso ativo.");
  }

  if (!profile.territoryId) {
    throw new Error("Usuário sem território vinculado.");
  }
}

async function loadParticipantsMap(territoryId) {
  const qParticipants = query(
    collection(db, "participants"),
    where("territoryId", "==", territoryId)
  );

  const snap = await getDocs(qParticipants);
  participantsMap.clear();

  snap.forEach((d) => {
    const data = d.data();
    const payload = {
      id: d.id,
      name: data.name || data.participantName || "Sem nome",
      participantCode: data.participantCode || data.familyCode || data.codigo || d.id,
      participantType: data.participantType || data.type || ""
    };

    participantsMap.set(d.id, payload);

    if (data.participantCode) participantsMap.set(String(data.participantCode), payload);
    if (data.familyCode) participantsMap.set(String(data.familyCode), payload);
    if (data.codigo) participantsMap.set(String(data.codigo), payload);
  });
}

function populateFilters(items) {
  const territorios = new Set();
  const entregas = new Set();

  items.forEach((item) => {
    territorios.add(inferTerritorio(item));
    const entrega = inferEntrega(item);
    if (entrega && entrega !== "—") entregas.add(entrega);
  });

  const currentTerr = els.fTerritorio.value || "__all__";
  const currentEntrega = els.fEntrega.value || "__all__";

  els.fTerritorio.innerHTML =
    `<option value="__all__">Todos</option>` +
    Array.from(territorios).sort().map((t) => `<option value="${t}">${t}</option>`).join("");

  els.fEntrega.innerHTML =
    `<option value="__all__">Todos</option>` +
    Array.from(entregas).sort().map((e) => `<option value="${e}">${e}</option>`).join("");

  els.fTerritorio.value = Array.from(territorios).includes(currentTerr) ? currentTerr : "__all__";
  els.fEntrega.value = Array.from(entregas).includes(currentEntrega) ? currentEntrega : "__all__";
}

function updateTopInfo() {
  els.txtRegistrosTopo.textContent = String(filteredColetas.length);

  const ini = els.fIni.value;
  const fim = els.fFim.value;

  if (ini && fim) {
    els.txtPeriodo.textContent = `${formatDateBR(ini)} → ${formatDateBR(fim)}`;
    return;
  }

  if (ini && !fim) {
    els.txtPeriodo.textContent = `${formatDateBR(ini)} → hoje`;
    return;
  }

  if (!ini && fim) {
    els.txtPeriodo.textContent = `até ${formatDateBR(fim)}`;
    return;
  }

  const dates = filteredColetas
    .map((item) => inferDateISO(item))
    .filter(Boolean)
    .map((v) => String(v).slice(0, 10))
    .sort();

  if (dates.length) {
    els.txtPeriodo.textContent = `${formatDateBR(dates[0])} → ${formatDateBR(dates[dates.length - 1])}`;
  } else {
    els.txtPeriodo.textContent = "—";
  }
}

function renderKpis(items) {
  const ativos = items.filter((item) => getStatus(item) !== "cancelado");
  const participantIds = new Set();
  const territorios = new Set();

  let residuoSeco = 0;
  let rejeito = 0;
  let finalTurno = 0;

  ativos.forEach((item) => {
    const p = resolveParticipant(item);

    if (p.code && p.code !== "—") {
      participantIds.add(p.code);
    } else if (p.name && p.name !== "Sem participante vinculado") {
      participantIds.add(p.name);
    }

    territorios.add(inferTerritorio(item));
    residuoSeco += inferResiduoSeco(item);
    rejeito += inferRejeito(item);

    if (inferFluxo(item) === "final_turno") finalTurno += 1;
  });

  els.k_totalColetas.textContent = String(ativos.length);
  els.k_participantes.textContent = String(participantIds.size);
  els.k_residuoSeco.textContent = formatNumber(residuoSeco);
  els.k_rejeito.textContent = formatNumber(rejeito);
  els.k_finalTurno.textContent = String(finalTurno);
  els.k_territoriosAtivos.textContent = String(territorios.size);
}

function getMaterialValue(item, key) {
  return Number(item.materiais?.[key] ?? 0);
}

function sumMaterials(items) {
  const totals = {};
  MATERIAL_META.forEach((mat) => {
    totals[mat.key] = 0;
  });

  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      MATERIAL_META.forEach((mat) => {
        totals[mat.key] += getMaterialValue(item, mat.key);
      });
    });

  return totals;
}

function computeExpandedMetrics(items) {
  const ativos = items.filter((item) => getStatus(item) !== "cancelado");
  const materialTotals = sumMaterials(ativos);

  let reciclavelKg = 0;
  let rejeitoKg = 0;
  let naoComercializadoKg = 0;

  const uniqueDays = new Set();
  const familySet = new Set();

  ativos.forEach((item) => {
    reciclavelKg += inferResiduoSeco(item);
    rejeitoKg += inferRejeito(item);
    naoComercializadoKg += inferNaoComercializado(item);

    const d = String(inferDateISO(item)).slice(0, 10);
    if (d) uniqueDays.add(d);

    const code = item.recebimento?.familyCode || item.participantCode || "";
    if (code) familySet.add(String(code));
  });

  const totalGeral = reciclavelKg + rejeitoKg;
  const reciclavelPct = totalGeral ? (reciclavelKg / totalGeral) * 100 : 0;
  const rejeitoPct = totalGeral ? (rejeitoKg / totalGeral) * 100 : 0;

  let receitaTotal = 0;
  MATERIAL_META.forEach((mat) => {
    receitaTotal += (materialTotals[mat.key] || 0) * mat.price;
  });

  return {
    materialTotals,
    reciclavelKg,
    rejeitoKg,
    naoComercializadoKg,
    reciclavelPct,
    rejeitoPct,
    receitaTotal,
    totalDiasProjeto: uniqueDays.size,
    operacoesRealizadas: ativos.length,
    familiasComColeta: familySet.size
  };
}

function renderWeightTimeline(items) {
  const canvas = document.getElementById("weightTimelineChart");
  if (!canvas) return;

  const valid = [...items]
    .filter((item) => getStatus(item) !== "cancelado")
    .sort((a, b) => String(inferDateTimeISO(a)).localeCompare(String(inferDateTimeISO(b))))
    .slice(-40);

  const labels = valid.map((item) => String(inferDateISO(item)).slice(5, 10));
  const reciclavel = valid.map((item) => inferResiduoSeco(item));
  const rejeito = valid.map((item) => inferRejeito(item));

  if (weightTimelineChart) {
    weightTimelineChart.destroy();
  }

  weightTimelineChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Peso do rejeito",
          data: rejeito,
          backgroundColor: "rgba(239,107,34,.75)"
        },
        {
          label: "Peso do reciclável",
          data: reciclavel,
          backgroundColor: "rgba(129,185,42,.75)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top"
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderExpandedPanel(items) {
  const m = computeExpandedMetrics(items);

  const allDates = items
    .map((item) => String(inferDateISO(item)).slice(0, 10))
    .filter(Boolean)
    .sort();

  const projectStart = allDates.length ? formatDateBR(allDates[0]) : "—";

  const participants = Array.from(participantsMap.values());
  const uniqueParticipants = new Map();

  participants.forEach((p) => {
    uniqueParticipants.set(p.id || p.participantCode, p);
  });

  const participantList = Array.from(uniqueParticipants.values());

  const familiasCadastradas = participantList.filter((p) => {
    const type = String(p.participantType || "").toLowerCase();
    return type !== "condominio";
  }).length;

  const condominiosCadastrados = participantList.filter((p) => {
    const type = String(p.participantType || "").toLowerCase();
    return type === "condominio";
  }).length;

  document.getElementById("k_totalDiasProjeto").textContent = String(m.totalDiasProjeto);
  document.getElementById("k_inicioProjeto").textContent = `Início: ${projectStart}`;
  document.getElementById("k_operacoesRealizadas").textContent = String(m.operacoesRealizadas);

  document.getElementById("k_familiasCadastradas").textContent = String(familiasCadastradas);
  document.getElementById("k_familiasParticipantes").textContent = String(m.familiasComColeta);
  document.getElementById("k_familiasColetas").textContent = String(m.operacoesRealizadas);

  document.getElementById("k_condominiosCadastrados").textContent = String(condominiosCadastrados);
  document.getElementById("k_condominiosParticipantes").textContent = "0";
  document.getElementById("k_condominiosColetas").textContent = "0";

  document.getElementById("k_totalReciclavelKg").textContent = formatNumber(m.reciclavelKg);
  document.getElementById("k_totalReciclavelPct").textContent = `${formatNumber(m.reciclavelPct)}%`;
  document.getElementById("k_receitaTotal").textContent = formatMoneyBR(m.receitaTotal);

  document.getElementById("k_totalRejeitoKg").textContent = formatNumber(m.rejeitoKg);
  document.getElementById("k_totalRejeitoPct").textContent = `${formatNumber(m.rejeitoPct)}%`;

  const rejeitoBase = m.rejeitoKg + m.naoComercializadoKg;
  const pctNaoReciclavel = rejeitoBase ? (m.rejeitoKg / rejeitoBase) * 100 : 0;
  const pctNaoComercializado = rejeitoBase ? (m.naoComercializadoKg / rejeitoBase) * 100 : 0;

  document.getElementById("k_rejeitoNaoReciclavelPct").textContent = `${formatNumber(pctNaoReciclavel)}%`;
  document.getElementById("k_rejeitoNaoReciclavelKg").textContent = formatKg(m.rejeitoKg);

  document.getElementById("k_naoComercializadoPct").textContent = `${formatNumber(pctNaoComercializado)}%`;
  document.getElementById("k_naoComercializadoKg").textContent = formatKg(m.naoComercializadoKg);

  const oleoKg = m.materialTotals.oleoCozinhaKg || 0;
  document.getElementById("k_outroKg").textContent = formatKg(oleoKg);

  const totalMateriais = Object.values(m.materialTotals).reduce((acc, v) => acc + v, 0);
  const materialCards = document.getElementById("materialCards");

  if (materialCards) {
    materialCards.innerHTML = MATERIAL_META
      .filter((mat) => mat.key !== "oleoCozinhaKg")
      .map((mat) => {
        const kg = m.materialTotals[mat.key] || 0;
        const pct = totalMateriais ? (kg / totalMateriais) * 100 : 0;
        const receita = kg * mat.price;

        return `
          <article class="material-card">
            <div class="mat-pct">${formatNumber(pct)}%</div>
            <div class="mat-kg">${formatNumber(kg)} kg</div>
            <div class="mat-name">${mat.label}</div>
            <div class="mat-sub">Receita ≈ ${formatMoneyBR(receita)}</div>
          </article>
        `;
      })
      .join("");
  }

  renderWeightTimeline(items);
}

function renderPhotoCell(item) {
  const photo = firstPhotoUrl(item);
  const qtdResiduo = Number(item.recebimento?.fotosResiduoQtd ?? 0);
  const qtdNaoComercializado = Number(item.recebimento?.fotosNaoComercializadoQtd ?? 0);
  const totalFotos = qtdResiduo + qtdNaoComercializado;

  if (photo) {
    return `
      <img
        src="${photo}"
        alt="Foto do registro"
        class="photo-thumb"
        data-photo="${photo}"
      />
    `;
  }

  if (totalFotos > 0) {
    return `<span class="photo-badge has-photo">${totalFotos} foto(s)</span>`;
  }

  return `<span class="empty-photo">—</span>`;
}

function renderMainTable(items) {
  if (!items.length) {
    els.tableColetasBody.innerHTML = `
      <tr>
        <td colspan="14">Nenhum registro encontrado para o filtro atual.</td>
      </tr>
    `;
    return;
  }

  els.tableColetasBody.innerHTML = items
    .map((item) => {
      const participant = resolveParticipant(item);
      const canceled = getStatus(item) === "cancelado";

      return `
        <tr class="${canceled ? "row-muted" : ""}">
          <td>${formatDateBR(String(inferDateISO(item)).slice(0, 10))}</td>
          <td>${safeText(inferTerritorio(item))}</td>
          <td>${safeText(participant.name)}</td>
          <td>${safeText(participant.code)}</td>
          <td>${safeText(inferFluxo(item))}</td>
          <td>${safeText(inferEntrega(item))}</td>
          <td>${safeText(item.createdByName || item.createdByPublicCode || item.createdBy || "Usuário")}</td>
          <td>${formatKg(inferResiduoSeco(item))}</td>
          <td>${formatKg(inferNaoComercializado(item))}</td>
          <td>${formatKg(inferRejeito(item))}</td>
          <td>${renderQualidadeBadge(item)}</td>
          <td>${renderPhotoCell(item)}</td>
          <td>${renderStatusBadge(item)}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn edit" data-edit="${item.id}" ${canceled ? "disabled" : ""}>Editar</button>
              <button class="action-btn cancel" data-cancel="${item.id}" ${canceled ? "disabled" : ""}>Cancelar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderHistory(items) {
  const recent = [...items]
    .sort((a, b) => String(inferDateTimeISO(b)).localeCompare(String(inferDateTimeISO(a))))
    .slice(0, 12);

  if (!recent.length) {
    els.historyBody.innerHTML = `
      <tr>
        <td colspan="8">Nenhum histórico disponível.</td>
      </tr>
    `;
    return;
  }

  els.historyBody.innerHTML = recent
    .map((item) => {
      const participant = resolveParticipant(item);
      const canceled = getStatus(item) === "cancelado";

      return `
        <tr class="${canceled ? "row-muted" : ""}">
          <td>${formatDateTimeBR(inferDateTimeISO(item))}</td>
          <td>${safeText(participant.name)}</td>
          <td>${safeText(inferFluxo(item))}</td>
          <td>${safeText(inferEntrega(item))}</td>
          <td>${formatKg(inferResiduoSeco(item))}</td>
          <td>${renderQualidadeBadge(item)}</td>
          <td>${renderStatusBadge(item)}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn edit" data-edit="${item.id}" ${canceled ? "disabled" : ""}>Editar</button>
              <button class="action-btn cancel" data-cancel="${item.id}" ${canceled ? "disabled" : ""}>Cancelar</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function buildDailySeries(items) {
  const map = new Map();

  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      const d = String(inferDateISO(item)).slice(0, 10);
      if (!d) return;
      map.set(d, (map.get(d) || 0) + 1);
    });

  const labels = Array.from(map.keys()).sort();
  const values = labels.map((l) => map.get(l));

  return { labels, values };
}

function buildFlowSeries(items) {
  const map = {
    recebimento: 0,
    final_turno: 0
  };

  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      const fluxo = inferFluxo(item);
      if (map[fluxo] !== undefined) map[fluxo] += 1;
    });

  return {
    labels: ["recebimento", "final_turno"],
    values: [map.recebimento, map.final_turno]
  };
}

function buildEntregaSeries(items) {
  const map = new Map();

  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      const entrega = inferEntrega(item);
      map.set(entrega, (map.get(entrega) || 0) + 1);
    });

  const labels = Array.from(map.keys());
  const values = labels.map((l) => map.get(l));

  return { labels, values };
}

function buildTerritorioSeries(items) {
  const map = new Map();

  items
    .filter((item) => getStatus(item) !== "cancelado")
    .forEach((item) => {
      const territorio = inferTerritorio(item);
      map.set(territorio, (map.get(territorio) || 0) + 1);
    });

  const labels = Array.from(map.keys());
  const values = labels.map((l) => map.get(l));

  return { labels, values };
}

function destroyCharts() {
  [mainChart, secA, secB, secC].forEach((chart) => {
    if (chart) chart.destroy();
  });
}

function renderCharts(items) {
  destroyCharts();

  const daily = buildDailySeries(items);
  const flow = buildFlowSeries(items);
  const entrega = buildEntregaSeries(items);
  const territorio = buildTerritorioSeries(items);

  const ctxMain = document.getElementById("mainChart");
  const ctxA = document.getElementById("secA");
  const ctxB = document.getElementById("secB");
  const ctxC = document.getElementById("secC");

  mainChart = new Chart(ctxMain, {
    type: "line",
    data: {
      labels: daily.labels,
      datasets: [
        {
          label: "Registros/dia",
          data: daily.values,
          borderColor: "#53ACDE",
          backgroundColor: "rgba(83,172,222,.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  secA = new Chart(ctxA, {
    type: "doughnut",
    data: {
      labels: flow.labels,
      datasets: [
        {
          data: flow.values,
          backgroundColor: ["#53ACDE", "#81B92A"],
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "58%",
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });

  secB = new Chart(ctxB, {
    type: "bar",
    data: {
      labels: entrega.labels,
      datasets: [
        {
          label: "Entrega",
          data: entrega.values,
          backgroundColor: "rgba(129,185,42,.36)",
          borderColor: "#81B92A",
          borderWidth: 1.5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  secC = new Chart(ctxC, {
    type: "bar",
    data: {
      labels: territorio.labels,
      datasets: [
        {
          label: "Território",
          data: territorio.values,
          backgroundColor: "rgba(83,172,222,.24)",
          borderColor: "#53ACDE",
          borderWidth: 1.5
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

function openPhoto(url) {
  if (!url) return;
  els.photoModalImg.src = url;
  els.photoModal.classList.add("open");
  els.photoModal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function openEditModal(itemId) {
  const item = allColetas.find((x) => x.id === itemId);
  if (!item) return;

  const participant = resolveParticipant(item);
  activeEditId = itemId;

  els.editParticipantName.textContent = `${participant.name} • ${participant.code}`;
  els.editFluxo.value = inferFluxo(item) === "—" ? "recebimento" : inferFluxo(item);
  els.editEntrega.value = inferEntrega(item) === "—" ? "" : inferEntrega(item);
  els.editPesoBase.value = String(inferResiduoSeco(item) || "");
  els.editQualidade.value = getQualidade(item);
  els.editRejeito.value = String(inferRejeito(item) || "");
  els.editNaoComercializado.value = String(inferNaoComercializado(item) || "");
  els.editObs.value = inferObservacao(item);

  els.editModal.classList.add("open");
  els.editModal.setAttribute("aria-hidden", "false");
}

async function saveEdit() {
  if (!activeEditId) return;

  const ref = doc(db, "coletas", activeEditId);

  await updateDoc(ref, {
    flowType: els.editFluxo.value,
    deliveryType: els.editEntrega.value.trim(),
    observacao: els.editObs.value.trim(),

    "recebimento.observacao": els.editObs.value.trim(),
    "recebimento.pesoResiduoSecoKg": Number(els.editPesoBase.value || 0),
    "recebimento.qualidadeNota": els.editQualidade.value ? Number(els.editQualidade.value) : null,
    "recebimento.pesoRejeitoKg": Number(els.editRejeito.value || 0),
    "recebimento.pesoNaoComercializadoKg": Number(els.editNaoComercializado.value || 0),

    updatedAt: serverTimestamp()
  });

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

function bindUI() {
  els.btnAplicar?.addEventListener("click", applyFilters);
  els.btnLimpar?.addEventListener("click", clearFilters);
  els.btnPrint?.addEventListener("click", () => window.print());
  els.btnSaveEdit?.addEventListener("click", saveEdit);

  document.addEventListener("click", async (event) => {
    const photo = event.target.closest("[data-photo]");
    if (photo) {
      openPhoto(photo.dataset.photo);
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

function setDefaultDateRange(items) {
  if (els.fIni.value || els.fFim.value || !items.length) return;

  const dates = items
    .map((item) => String(inferDateISO(item)).slice(0, 10))
    .filter(Boolean)
    .sort();

  if (!dates.length) return;

  els.fIni.value = dates[0];
  els.fFim.value = dates[dates.length - 1];
}

function sortColetasLocally(items) {
  return items.sort((a, b) => {
    const aDate = String(inferDateTimeISO(a) || "");
    const bDate = String(inferDateTimeISO(b) || "");
    return bDate.localeCompare(aDate);
  });
}

function applyFilters() {
  const terr = els.fTerritorio.value;
  const fluxo = els.fFluxo.value;
  const entrega = els.fEntrega.value;
  const ini = els.fIni.value;
  const fim = els.fFim.value;
  const busca = normalizeText(els.fBusca.value);

  filteredColetas = allColetas.filter((item) => {
    const participant = resolveParticipant(item);

    const haystack = [
      participant.name,
      participant.code,
      item.createdByName,
      item.createdByPublicCode,
      item.createdBy,
      inferTerritorio(item),
      inferEntrega(item),
      inferFluxo(item),
      inferObservacao(item)
    ]
      .map(normalizeText)
      .join(" ");

    if (terr !== "__all__" && inferTerritorio(item) !== terr) return false;
    if (fluxo !== "__all__" && inferFluxo(item) !== fluxo) return false;
    if (entrega !== "__all__" && inferEntrega(item) !== entrega) return false;
    if (!matchesDateRange(item, ini, fim)) return false;
    if (busca && !haystack.includes(busca)) return false;

    return true;
  });

  updateTopInfo();
  renderKpis(filteredColetas);
  renderExpandedPanel(filteredColetas);
  renderMainTable(filteredColetas);
  renderHistory(filteredColetas);
  renderCharts(filteredColetas);
}

function clearFilters() {
  els.fTerritorio.value = "__all__";
  els.fFluxo.value = "__all__";
  els.fEntrega.value = "__all__";
  els.fIni.value = "";
  els.fFim.value = "";
  els.fBusca.value = "";
  applyFilters();
}

function listenColetas(profile) {
  els.dbStatus.textContent = "conectando…";

  const startListener = (useFallback = false) => {
    const qColetas = useFallback
      ? query(
          collection(db, "coletas"),
          where("territoryId", "==", profile.territoryId)
        )
      : query(
          collection(db, "coletas"),
          where("territoryId", "==", profile.territoryId),
          orderBy("createdAt", "desc")
        );

    onSnapshot(
      qColetas,
      (snapshot) => {
        allColetas = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        if (useFallback) {
          allColetas = sortColetasLocally(allColetas);
        }

        populateFilters(allColetas);
        setDefaultDateRange(allColetas);
        applyFilters();

        els.dbStatus.textContent = useFallback
          ? "conectado (modo provisório)"
          : "conectado";
      },
      (error) => {
        const msg = String(error?.message || "").toLowerCase();

        if (!useFallback && msg.includes("index")) {
          console.warn("Índice ainda em construção. Usando fallback local.");
          startListener(true);
          return;
        }

        console.error("Erro ao carregar coletas:", error);
        els.dbStatus.textContent = "erro";
        alert("Não foi possível carregar os dados do dashboard.");
      }
    );
  };

  startListener(false);
}

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

      fillUser(profile);
      await loadParticipantsMap(profile.territoryId);
      listenColetas(profile);
    } catch (error) {
      console.error("Erro ao iniciar dashboard:", error);
      alert(error.message || "Não foi possível carregar o dashboard.");
      window.location.href = "login.html";
    }
  });
}

boot();