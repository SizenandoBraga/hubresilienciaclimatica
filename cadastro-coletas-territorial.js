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
   CONFIGURAÇÃO DA PÁGINA DINÂMICA
   Funciona para Vila Pinto, COOADESC e Padre Cacique
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

function getCodeOrDefault(value) {
  const code = String(value || "").trim();
  return code || DEFAULT_FAMILY_CODE;
}

function formatFlow(value) {
  const map = {
    recebimento: "Recebimento",
    final_turno: "Final do turno"
  };

  return map[value] || value || "-";
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
  const btnBack = $("btnBackCooperativa");

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      window.location.href = PAGE_TERRITORY.backUrl;
    });
  }

  const backLink = document.querySelector(".topbar-actions a.btn.ghost");

  if (backLink) {
    backLink.href = PAGE_TERRITORY.backUrl;
    backLink.textContent = "Voltar à cooperativa";
  }
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

function getCreatedByName() {
  return (
    STATE.userDoc?.displayName ||
    STATE.userDoc?.name ||
    STATE.user?.displayName ||
    STATE.user?.email ||
    "Usuário"
  ).trim();
}

function ensureAuthenticatedUser() {
  if (!STATE.user) {
    throw new Error("Usuário não autenticado. Faça login novamente.");
  }

  if (!STATE.userDoc) {
    throw new Error("Usuário sem cadastro na coleção users.");
  }

  const status = getUserStatus();
  const statusOk =
    status === "active" ||
    status === "aprovado" ||
    STATE.userDoc?.active === true;

  if (!statusOk) {
    throw new Error(`Usuário sem permissão. Status atual em users: "${status || "vazio"}".`);
  }

  const allowedCoopRoles = ["cooperativa", "operador", "usuario"];
  const canOperate =
    isAdmin() ||
    isGovernanca() ||
    allowedCoopRoles.includes(getUserRole());

  if (!canOperate) {
    throw new Error(
      `Seu perfil não tem permissão para registrar coletas. role atual: "${getUserRole() || "vazio"}".`
    );
  }

  if (!isAdmin() && !isGovernanca()) {
    if (getUserTerritoryId() !== STATE.territoryId) {
      throw new Error(
        `Seu usuário pertence ao território "${getUserTerritoryId() || "sem território"}" e não ao território "${STATE.territoryId}".`
      );
    }
  }
}

/* =========================
   IMAGENS
========================= */

function ensureImageFile(file, label = "foto") {
  if (!file) {
    throw new Error(`A ${label} é obrigatória.`);
  }

  if (!String(file.type || "").startsWith("image/")) {
    throw new Error(`O arquivo enviado em ${label} deve ser uma imagem.`);
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));

    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível processar a imagem."));

    img.src = dataUrl;
  });
}

async function compressImageFile(file, options = {}) {
  ensureImageFile(file, "foto");

  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.72,
    mimeType = "image/jpeg"
  } = options;

  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImageFromDataUrl(dataUrl);

  let { width, height } = img;

  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const ratio = Math.min(widthRatio, heightRatio, 1);

  const targetWidth = Math.max(1, Math.round(width * ratio));
  const targetHeight = Math.max(1, Math.round(height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível preparar a imagem para salvar.");
  }

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return {
    dataUrl: canvas.toDataURL(mimeType, quality),
    originalName: file.name || "foto.jpg",
    originalType: file.type || "",
    originalSize: file.size || 0,
    savedType: mimeType,
    width: targetWidth,
    height: targetHeight
  };
}

async function compressManyImages(files, options = {}) {
  const validFiles = Array.from(files || []).filter(Boolean);
  const result = [];

  for (const file of validFiles) {
    result.push(await compressImageFile(file, options));
  }

  return result;
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
          console.error("Documento users não encontrado para UID:", user.uid);
          resolve();
          return;
        }

        STATE.userDoc = {
          id: snap.id,
          ...snap.data()
        };

        console.log("Usuário autenticado:", {
          uid: user.uid,
          email: user.email || null,
          role: STATE.userDoc?.role || null,
          status: STATE.userDoc?.status || null,
          active: STATE.userDoc?.active ?? null,
          territoryId: STATE.userDoc?.territoryId || null
        });

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
   ESCOLHAS DA OPERAÇÃO
========================= */

function activateGroup(selector, activeBtn, hiddenInputId, value) {
  document.querySelectorAll(selector).forEach((el) => {
    el.classList.remove("active");
    el.setAttribute("aria-pressed", "false");
  });

  activeBtn.classList.add("active");
  activeBtn.setAttribute("aria-pressed", "true");

  const hidden = $(hiddenInputId);

  if (hidden) {
    hidden.value = value;
  }
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
   MATERIAIS EXTRAS
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
   FOTOS DO FINAL DO TURNO
========================= */

const inputFotosFinalTurno = $("fotoFinalTurno");
const previewFinalTurno = $("previewFinalTurno");

let fotosFinalTurno = [];
const MAX_FOTOS = 10;

inputFotosFinalTurno?.addEventListener("change", (e) => {
  const files = Array.from(e.target.files || []);
  const imagens = files.filter((f) => String(f.type || "").startsWith("image/"));

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

  STATE.operacao = {
    opDate,
    deliveryType,
    flowType,
    opNotes
  };

  togglePanels(flowType);

  setMsg(
    $("msgOperacao"),
    "ok",
    "Etapa inicial salva com sucesso. Continue o preenchimento da coleta."
  );

  return true;
}

/* =========================
   FIRESTORE
========================= */

async function salvarRecebimento() {
  ensureTerritory();
  ensureAuthenticatedUser();

  /* Se for família e o campo ficar em branco, salva automaticamente F000 */
  const participantCode = getCodeOrDefault($("familyCode")?.value);
  const familyCode = participantCode;

  const pesoResiduoSecoKg = parseNum($("pesoResiduoSecoKg")?.value);
  const qualidadeNota = parseNum($("qualidadeNota")?.value);
  const recebimentoObs = $("recebimentoObs")?.value.trim() || null;
  const pesoRejeitoKg = parseNum($("pesoRejeitoKg")?.value);
  const pesoNaoComercializadoKg = parseNum($("pesoNaoComercializadoKg")?.value);

  const fotoResiduoFile = $("fotoResiduo")?.files?.[0] || null;
  const fotoNaoComercializadoFile = $("fotoNaoComercializado")?.files?.[0] || null;

  if (!STATE.operacao) {
    throw new Error("Salve primeiro a etapa da operação.");
  }

  if (
    pesoResiduoSecoKg === null ||
    qualidadeNota === null ||
    pesoRejeitoKg === null ||
    pesoNaoComercializadoKg === null
  ) {
    throw new Error("Preencha todos os campos obrigatórios do recebimento.");
  }

  let fotoResiduo = null;
  let fotoNaoComercializado = null;

  if (fotoResiduoFile) {
    fotoResiduo = await compressImageFile(fotoResiduoFile);
  }

  if (fotoNaoComercializadoFile) {
    fotoNaoComercializado = await compressImageFile(fotoNaoComercializadoFile);
  }

  const recebimentoPhotos = [
    fotoResiduo?.dataUrl || null,
    fotoNaoComercializado?.dataUrl || null
  ].filter(Boolean);

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId,
    territoryLabel: PAGE_TERRITORY.territoryLabel,

    createdBy: STATE.user.uid,
    createdByName: getCreatedByName(),

    opDate: STATE.operacao.opDate,
    participantCode,
    familyCode,
    deliveryType: STATE.operacao.deliveryType,
    flowType: "recebimento",
    observacao: STATE.operacao.opNotes || null,

    photoUrl: fotoResiduo?.dataUrl || null,
    photos: recebimentoPhotos,

    recebimento: {
      pesoResiduoSecoKg,
      qualidadeNota,
      observacao: recebimentoObs,
      pesoRejeitoKg,
      pesoNaoComercializadoKg,

      fotoResiduoUrl: fotoResiduo?.dataUrl || null,
      fotoNaoComercializadoUrl: fotoNaoComercializado?.dataUrl || null,

      photos: recebimentoPhotos,

      uploads: {
        fotoResiduo,
        fotoNaoComercializado
      }
    }
  };

  console.log("Payload recebimento:", payload);

  const docRef = await addDoc(collection(db, "coletas"), payload);

  return {
    ...payload,
    id: docRef.id
  };
}

async function salvarFinalTurno() {
  ensureTerritory();
  ensureAuthenticatedUser();

  /* Se for família e o campo ficar em branco, salva automaticamente F000 */
  const participantCode = getCodeOrDefault($("condCode")?.value);
  const condCode = participantCode;

  if (!STATE.operacao) {
    throw new Error("Salve primeiro a etapa da operação.");
  }

  const extras = getExtras();

  let uploadedPhotos = [];
  let photoUrls = [];

  if (fotosFinalTurno.length) {
    uploadedPhotos = await compressManyImages(fotosFinalTurno);
    photoUrls = uploadedPhotos.map((item) => item.dataUrl);
  }

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId,
    territoryLabel: PAGE_TERRITORY.territoryLabel,

    createdBy: STATE.user.uid,
    createdByName: getCreatedByName(),

    opDate: STATE.operacao.opDate,
    participantCode,
    condCode,
    deliveryType: STATE.operacao.deliveryType,
    flowType: "final_turno",
    observacao: STATE.operacao.opNotes || null,

    photoUrl: photoUrls[0] || null,
    photos: photoUrls,

    finalTurno: {
      /* Peso do rejeito geral removido de todos os perfis */
      plasticoKg: parseNum($("plasticoKg")?.value) || 0,
      papelMistoKg: parseNum($("papelMistoKg")?.value) || 0,
      papelaoKg: parseNum($("papelaoKg")?.value) || 0,
      aluminioMetalKg: parseNum($("aluminioMetalKg")?.value) || 0,
      vidroKg: parseNum($("vidroKg")?.value) || 0,
      sacariaKg: parseNum($("sacariaKg")?.value) || 0,
      isoporKg: parseNum($("isoporKg")?.value) || 0,
      oleoKg: parseNum($("oleoKg")?.value) || 0,
      extras,
      photos: photoUrls,
      uploads: uploadedPhotos
    }
  };

  console.log("Payload finalTurno:", payload);

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

function resetAllForms() {
  $("formOperacao")?.reset();
  resetRecebimentoForm();
  resetFinalTurnoForm();

  STATE.operacao = null;

  document.querySelectorAll(".choice-card").forEach((btn) => {
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  });

  setText("flowStatus", "não selecionado");
  togglePanels(null);

  if ($("opDate")) {
    $("opDate").value = toISODate(new Date());
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

    const submitBtn = e.target.querySelector("button[type='submit']");

    try {
      STATE.salvando = true;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando coleta...";
      }

      setConnectionState("salvando");

      await salvarRecebimento();

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
        error.message || "Erro ao salvar recebimento."
      );
    } finally {
      STATE.salvando = false;

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

    const submitBtn = e.target.querySelector("button[type='submit']");

    try {
      STATE.salvando = true;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando fechamento...";
      }

      setConnectionState("salvando");

      await salvarFinalTurno();

      setMsg(
        $("msgFinalTurno"),
        "ok",
        `Registro final do turno salvo com sucesso em ${PAGE_TERRITORY.territoryLabel}.`
      );

      setConnectionState("conectado");
      resetFinalTurnoForm();
    } catch (error) {
      console.error("Erro ao salvar fechamento do turno:", error);
      setConnectionState("erro");

      setMsg(
        $("msgFinalTurno"),
        "bad",
        error.message || "Erro ao salvar fechamento do turno."
      );
    } finally {
      STATE.salvando = false;

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Salvar registro final do turno";
      }
    }
  });

  $("btnNovaColetaTop")?.addEventListener("click", resetAllForms);
  $("btnNovaColetaRecebimento")?.addEventListener("click", resetAllForms);
  $("btnNovaColetaFinalTurno")?.addEventListener("click", resetAllForms);

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

  console.log(`Página de coletas ${PAGE_TERRITORY.territoryLabel} iniciada com autenticação.`);
}

init();