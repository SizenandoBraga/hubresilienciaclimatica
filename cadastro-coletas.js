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
   CONFIG FIXA VILA PINTO
========================= */

const PAGE_TERRITORY = {
  territoryId: "vila-pinto",
  territoryLabel: "Centro de Triagem Vila Pinto",
  backUrl: "./vila-pinto.html"
};

/* =========================
   STATE GLOBAL
========================= */

const STATE = {
  territoryId: PAGE_TERRITORY.territoryId,
  operacao: null,
  ultimaEtiqueta: null,
  salvando: false,
  user: null,
  userDoc: null
};

/* =========================
   HELPERS
========================= */

const $ = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "—";
}

function setMsg(el, kind, text) {
  if (!el) return;
  el.className = `msg ${kind}`;
  el.textContent = text;
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function parseNum(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function formatDateBR(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = String(dateStr).split("-");
  if (!year || !month || !day) return "-";
  return `${day}/${month}/${year}`;
}

function formatFlow(value) {
  const map = {
    recebimento: "Recebimento",
    final_turno: "Final do turno"
  };
  return map[value] || value || "-";
}

function gerarCodigoEtiqueta() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `ETQ-${y}${m}${d}-${h}${min}${s}`;
}

function togglePanels(flowType) {
  $("panelRecebimento")?.classList.toggle("hidden", flowType !== "recebimento");
  $("panelFinalTurno")?.classList.toggle("hidden", flowType !== "final_turno");
}

function setConnectionState(label) {
  setText("dbStatus", label);
}

function setPageTerritoryState() {
  setText("territoryStatus", PAGE_TERRITORY.territoryLabel);
}

function setBackLink() {
  const backLink = document.querySelector(".topbar-actions a.btn.ghost");
  if (backLink) backLink.href = PAGE_TERRITORY.backUrl;
}

function ensureTerritory() {
  if (!STATE.territoryId) {
    throw new Error("Território não definido.");
  }
}

function getUserRole() {
  return STATE.userDoc?.role || null;
}

function getUserStatus() {
  return STATE.userDoc?.status || null;
}

function getUserTerritoryId() {
  return STATE.userDoc?.territoryId || null;
}

function userHasRoleFlag(flag) {
  return Boolean(
    STATE.userDoc &&
    STATE.userDoc.roles &&
    typeof STATE.userDoc.roles === "object" &&
    STATE.userDoc.roles[flag] === true
  );
}

function isAdmin() {
  return getUserRole() === "admin" || userHasRoleFlag("admin");
}

function isGovernanca() {
  return (
    getUserRole() === "governanca" ||
    getUserRole() === "gestor" ||
    userHasRoleFlag("governanca")
  );
}

function ensureAuthenticatedUser() {
  if (!STATE.user) {
    throw new Error("Usuário não autenticado. Faça login novamente.");
  }

  if (!STATE.userDoc) {
    throw new Error("Usuário sem cadastro na coleção users.");
  }

  if (getUserStatus() !== "active") {
    throw new Error("Usuário sem permissão. Verifique se o status está como active.");
  }

  const allowedCoopRoles = ["cooperativa", "operador", "usuario"];
  const canOperate =
    isAdmin() ||
    isGovernanca() ||
    allowedCoopRoles.includes(getUserRole());

  if (!canOperate) {
    throw new Error("Seu perfil não tem permissão para registrar coletas.");
  }

  if (!isAdmin() && !isGovernanca()) {
    if (getUserTerritoryId() !== STATE.territoryId) {
      throw new Error(
        `Seu usuário pertence ao território "${getUserTerritoryId() || "sem território"}" e não ao território "${STATE.territoryId}".`
      );
    }
  }
}

function getCreatedByName() {
  return (
    STATE.userDoc?.displayName ||
    STATE.userDoc?.name ||
    STATE.user?.displayName ||
    STATE.user?.email ||
    "Usuário"
  );
}

/* =========================
   AUTH
========================= */

async function loadCurrentUser() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          STATE.user = null;
          STATE.userDoc = null;
          setConnectionState("sem login");
          resolve();
          return;
        }

        STATE.user = user;

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          STATE.userDoc = null;
          setConnectionState("usuário sem cadastro");
          resolve();
          return;
        }

        STATE.userDoc = {
          id: snap.id,
          ...snap.data()
        };

        setConnectionState("conectado");
        resolve();
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        setConnectionState("erro");
        resolve();
      }
    });
  });
}

/* =========================
   CHOICES
========================= */

function activateGroup(selector, activeBtn, hiddenInputId, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.remove("active");
    el.setAttribute("aria-pressed", "false");
  });

  activeBtn.classList.add("active");
  activeBtn.setAttribute("aria-pressed", "true");

  const hidden = $(hiddenInputId);
  if (hidden) hidden.value = value;
}

function wireChoices() {
  document.querySelectorAll("[data-delivery]").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
    btn.onclick = () => {
      activateGroup("[data-delivery]", btn, "deliveryType", btn.dataset.delivery);
    };
  });

  document.querySelectorAll("[data-flow]").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
    btn.onclick = () => {
      activateGroup("[data-flow]", btn, "flowType", btn.dataset.flow);
      setText("flowStatus", formatFlow(btn.dataset.flow));
      togglePanels(btn.dataset.flow);
    };
  });

  document.querySelectorAll(".quality-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");
    btn.onclick = () => {
      document.querySelectorAll(".quality-btn").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-pressed", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      if ($("qualidadeNota")) {
        $("qualidadeNota").value = btn.dataset.quality;
      }
    };
  });

  $("btnPreviewOperacao")?.addEventListener("click", () => {
    const delivery = $("deliveryType")?.value || "não definido";
    const flow = $("flowType")?.value || "não definido";

    setMsg(
      $("msgOperacao"),
      "ok",
      `Prévia pronta: entrega ${delivery} / fluxo ${formatFlow(flow)} / território ${PAGE_TERRITORY.territoryLabel}.`
    );
  });
}

/* =========================
   EXTRAS
========================= */

function buildExtraRow() {
  const row = document.createElement("div");
  row.className = "extra-row";
  row.innerHTML = `
    <input type="text" class="extra-name" placeholder="Nome do material">
    <input type="number" step="0.01" class="extra-weight" placeholder="kg">
    <button type="button" class="remove-extra">Remover</button>
  `;

  row.querySelector(".remove-extra")?.addEventListener("click", () => row.remove());
  return row;
}

function wireExtras() {
  $("btnAddExtra")?.addEventListener("click", () => {
    $("extrasWrap")?.appendChild(buildExtraRow());
  });
}

function getExtras() {
  const extras = [];

  $$("#extrasWrap .extra-row").forEach((row) => {
    const nome = row.querySelector(".extra-name")?.value.trim();
    const pesoKg = parseNum(row.querySelector(".extra-weight")?.value);

    if (nome && pesoKg !== null) {
      extras.push({ nome, pesoKg });
    }
  });

  return extras;
}

/* =========================
   FOTOS
========================= */

const inputFotosFinalTurno = $("fotoFinalTurno");
const previewFinalTurno = $("previewFinalTurno");

let fotosFinalTurno = [];
const MAX_FOTOS = 10;

inputFotosFinalTurno?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  const imagens = files.filter((f) => f.type.startsWith("image/"));

  if (fotosFinalTurno.length + imagens.length > MAX_FOTOS) {
    alert(`Máximo de ${MAX_FOTOS} fotos`);
    inputFotosFinalTurno.value = "";
    return;
  }

  fotosFinalTurno = [...fotosFinalTurno, ...imagens];
  renderPreviewFinalTurno();
  inputFotosFinalTurno.value = "";
});

function renderPreviewFinalTurno() {
  if (!previewFinalTurno) return;

  previewFinalTurno.innerHTML = "";

  fotosFinalTurno.forEach((file, index) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const div = document.createElement("div");
      div.className = "preview-item";
      div.innerHTML = `
        <img src="${e.target.result}" alt="Pré-visualização da foto ${index + 1}">
        <button type="button" class="preview-remove" data-index="${index}">×</button>
      `;

      previewFinalTurno.appendChild(div);

      div.querySelector(".preview-remove")?.addEventListener("click", () => {
        fotosFinalTurno.splice(index, 1);
        renderPreviewFinalTurno();
      });
    };

    reader.readAsDataURL(file);
  });
}

/* =========================
   ETAPA 1
========================= */

function saveOperacaoBase() {
  const opDate = $("opDate")?.value;
  const deliveryType = $("deliveryType")?.value;
  const flowType = $("flowType")?.value;
  const opNotes = $("opNotes")?.value.trim() || null;

  if (!opDate || !deliveryType || !flowType) {
    setMsg($("msgOperacao"), "bad", "Preencha a data, o tipo de entrega e o fluxo da operação.");
    return false;
  }

  STATE.operacao = { opDate, deliveryType, flowType, opNotes };
  togglePanels(flowType);

  setMsg($("msgOperacao"), "ok", "Etapa inicial salva com sucesso. Continue o preenchimento da coleta.");
  return true;
}

/* =========================
   ETIQUETA
========================= */

function gerarQrCode(valor) {
  const qrContainer = $("qrcode");
  if (!qrContainer) return;

  qrContainer.innerHTML = "";

  if (typeof QRCode === "undefined") {
    qrContainer.innerHTML = "<small>QRCode não disponível</small>";
    return;
  }

  new QRCode(qrContainer, {
    text: valor,
    width: 200,
    height: 200,
    correctLevel: QRCode.CorrectLevel.H
  });
}

function preencherEtiquetaSimples(registro) {
  STATE.ultimaEtiqueta = registro;

  const familyCode =
    registro.familyCode ||
    registro.condCode ||
    registro.participantCode ||
    registro.codigoFamilia ||
    "SEM-CODIGO";

  const qrPayload = JSON.stringify({
    codigoFamilia: familyCode,
    participantCode: registro.participantCode || familyCode,
    territoryId: STATE.territoryId,
    territoryLabel: PAGE_TERRITORY.territoryLabel,
    flowType: registro.flowType || null,
    opDate: registro.opDate || null,
    id: registro.id || null
  });

  setText("labelFamilyCode", familyCode);
  setText("labelDate", formatDateBR(registro.opDate));
  gerarQrCode(qrPayload);
}

function openLabelModal() {
  const modal = $("labelModal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLabelModal() {
  const modal = $("labelModal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function wireLabelModal() {
  $("btnPrintLabel")?.addEventListener("click", () => {
    if (!STATE.ultimaEtiqueta) return;
    window.print();
  });

  $("btnCloseLabelModal")?.addEventListener("click", closeLabelModal);
  $("btnCloseLabelModalFooter")?.addEventListener("click", closeLabelModal);
  $("labelModalBackdrop")?.addEventListener("click", closeLabelModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLabelModal();
  });
}

/* =========================
   FIRESTORE
========================= */

async function salvarRecebimento() {
  ensureTerritory();
  ensureAuthenticatedUser();

  const familyCode = $("familyCode")?.value.trim() || null;
  const participantCode = familyCode;

  const pesoResiduoSecoKg = parseNum($("pesoResiduoSecoKg")?.value);
  const qualidadeNota = parseNum($("qualidadeNota")?.value);
  const recebimentoObs = $("recebimentoObs")?.value.trim() || null;
  const pesoRejeitoKg = parseNum($("pesoRejeitoKg")?.value);
  const pesoNaoComercializadoKg = parseNum($("pesoNaoComercializadoKg")?.value);

  if (!STATE.operacao) {
    throw new Error("Salve primeiro a etapa da operação.");
  }

  if (!participantCode) {
    throw new Error("Informe o código da família.");
  }

  if (
    pesoResiduoSecoKg === null ||
    qualidadeNota === null ||
    pesoRejeitoKg === null ||
    pesoNaoComercializadoKg === null
  ) {
    throw new Error("Preencha todos os campos obrigatórios do recebimento.");
  }

  const codigoEtiqueta = gerarCodigoEtiqueta();

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId,
    territoryLabel: PAGE_TERRITORY.territoryLabel,

    createdBy: STATE.user.uid,
    createdByName: getCreatedByName(),

    opDate: STATE.operacao.opDate,
    participantCode,
    deliveryType: STATE.operacao.deliveryType,
    flowType: "recebimento",
    observacao: STATE.operacao.opNotes || null,
    codigoEtiqueta,

    familyCode,

    recebimento: {
      pesoResiduoSecoKg,
      qualidadeNota,
      observacao: recebimentoObs,
      pesoRejeitoKg,
      pesoNaoComercializadoKg,
      fotosResiduoQtd: $("fotoResiduo")?.files?.length || 0,
      fotosNaoComercializadoQtd: $("fotoNaoComercializado")?.files?.length || 0
    }
  };

  console.log("Salvando recebimento:", payload);

  const docRef = await addDoc(collection(db, "coletas"), payload);

  return {
    ...payload,
    id: docRef.id
  };
}

async function salvarFinalTurno() {
  ensureTerritory();
  ensureAuthenticatedUser();

  const condCode = $("condCode")?.value.trim() || null;
  const participantCode = condCode;

  const pesoRejeitoGeralKg = parseNum($("pesoRejeitoGeralKg")?.value);

  if (!STATE.operacao) {
    throw new Error("Salve primeiro a etapa da operação.");
  }

  if (!participantCode) {
    throw new Error("Informe o código do condomínio/família.");
  }

  if (pesoRejeitoGeralKg === null) {
    throw new Error("Preencha o peso do rejeito geral.");
  }

  const extras = getExtras();
  const codigoEtiqueta = gerarCodigoEtiqueta();

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId,
    territoryLabel: PAGE_TERRITORY.territoryLabel,

    createdBy: STATE.user.uid,
    createdByName: getCreatedByName(),

    opDate: STATE.operacao.opDate,
    participantCode,
    deliveryType: STATE.operacao.deliveryType,
    flowType: "final_turno",
    observacao: STATE.operacao.opNotes || null,
    codigoEtiqueta,

    condCode,

    finalTurno: {
      pesoRejeitoGeralKg,
      plasticoKg: parseNum($("plasticoKg")?.value) || 0,
      papelMistoKg: parseNum($("papelMistoKg")?.value) || 0,
      papelaoKg: parseNum($("papelaoKg")?.value) || 0,
      aluminioMetalKg: parseNum($("aluminioMetalKg")?.value) || 0,
      vidroKg: parseNum($("vidroKg")?.value) || 0,
      sacariaKg: parseNum($("sacariaKg")?.value) || 0,
      isoporKg: parseNum($("isoporKg")?.value) || 0,
      oleoKg: parseNum($("oleoKg")?.value) || 0,
      extras,
      fotosQtd: fotosFinalTurno.length
    }
  };

  console.log("Salvando final do turno:", payload);

  const docRef = await addDoc(collection(db, "coletas"), payload);

  return {
    ...payload,
    id: docRef.id
  };
}

/* =========================
   FORMS
========================= */

function resetRecebimentoForm() {
  $("formRecebimento")?.reset();

  if ($("qualidadeNota")) {
    $("qualidadeNota").value = "";
  }

  document.querySelectorAll(".quality-btn").forEach((btn) => {
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  });
}

function resetFinalTurnoForm() {
  $("formFinalTurno")?.reset();

  fotosFinalTurno = [];
  renderPreviewFinalTurno();

  const wrap = $("extrasWrap");
  if (wrap) {
    wrap.innerHTML = "";
    wrap.appendChild(buildExtraRow());
  }
}

function wireForms() {
  $("formOperacao")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveOperacaoBase();
  });

  $("formRecebimento")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (STATE.salvando) return;

    if (!saveOperacaoBase() && !STATE.operacao) return;

    try {
      STATE.salvando = true;

      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando coleta...";
      }

      setConnectionState("salvando");

      const registro = await salvarRecebimento();
      preencherEtiquetaSimples(registro);
      openLabelModal();

      setMsg(
        $("msgRecebimento"),
        "ok",
        `Coleta de recebimento salva com sucesso em ${PAGE_TERRITORY.territoryLabel}.`
      );

      setConnectionState("conectado");
      resetRecebimentoForm();
    } catch (error) {
      console.error("Erro ao salvar recebimento:", error);
      setConnectionState("erro");
      setMsg(
        $("msgRecebimento"),
        "bad",
        error?.message || "Erro ao salvar recebimento."
      );
    } finally {
      STATE.salvando = false;

      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Salvar coleta de recebimento";
      }
    }
  });

  $("formFinalTurno")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (STATE.salvando) return;

    if (!saveOperacaoBase() && !STATE.operacao) return;

    try {
      STATE.salvando = true;

      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando fechamento...";
      }

      setConnectionState("salvando");

      const registro = await salvarFinalTurno();
      preencherEtiquetaSimples(registro);
      openLabelModal();

      setMsg(
        $("msgFinalTurno"),
        "ok",
        `Registro final do turno salvo com sucesso em ${PAGE_TERRITORY.territoryLabel}.`
      );

      setConnectionState("conectado");
      resetFinalTurnoForm();
    } catch (error) {
      console.error("Erro ao salvar final do turno:", error);
      setConnectionState("erro");
      setMsg(
        $("msgFinalTurno"),
        "bad",
        error?.message || "Erro ao salvar fechamento do turno."
      );
    } finally {
      STATE.salvando = false;

      const submitBtn = e.target.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Salvar registro final do turno";
      }
    }
  });

  $("btnVoltarRecebimento")?.addEventListener("click", () => {
    $("panelRecebimento")?.classList.add("hidden");
  });

  $("btnVoltarFinalTurno")?.addEventListener("click", () => {
    $("panelFinalTurno")?.classList.add("hidden");
  });
}

/* =========================
   INIT
========================= */

async function init() {
  wireChoices();
  wireExtras();
  wireForms();
  wireLabelModal();

  if ($("opDate")) {
    $("opDate").value = toISODate(new Date());
  }

  const wrap = $("extrasWrap");
  if (wrap && !wrap.children.length) {
    wrap.appendChild(buildExtraRow());
  }

  setPageTerritoryState();
  setBackLink();
  setConnectionState("carregando");

  await loadCurrentUser();

  console.log("Página de coletas Vila Pinto iniciada com autenticação.");
}

init();