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
   CONFIG FIXA COOADESC
========================= */

const PAGE_TERRITORY = {
  territoryId: "cooadesc",
  territoryLabel: "COOADESC",
  backUrl: "./login.html"
};

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
  const backLink = document.querySelector(".topbar-actions a.btn.ghost");
  if (backLink) {
    backLink.href = PAGE_TERRITORY.backUrl;
    backLink.textContent = "Voltar ao login";
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
    throw new Error(
      `Usuário sem permissão. Status atual em users: "${status || "vazio"}".`
    );
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

  const compressedDataUrl = canvas.toDataURL(mimeType, quality);

  return {
    dataUrl: compressedDataUrl,
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

  const participantCode = $("familyCode")?.value.trim() || null;
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

  if (!participantCode) {
    throw new Error("Informe o código do participante aprovado.");
  }

  if (
  pesoResiduoSecoKg === null ||
  qualidadeNota === null
) {
  throw new Error("Preencha os campos obrigatórios do recebimento.");
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
    deliveryType: STATE.operacao.deliveryType,
    flowType: "recebimento",
    observacao: STATE.operacao.opNotes || null,
    familyCode,

    photoUrl: fotoResiduo?.dataUrl || null,
    photos: recebimentoPhotos,

    recebimento: {
      pesoResiduoSecoKg,
      qualidadeNota,
      observacao: recebimentoObs,
     pesoRejeitoKg: pesoRejeitoKg ?? 0,
pesoNaoComercializadoKg: pesoNaoComercializadoKg ?? 0,

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

  const participantCode = $("condCode")?.value.trim() || null;
  const condCode = participantCode;
  const pesoRejeitoGeralKg = parseNum($("pesoRejeitoGeralKg")?.value);

  if (!STATE.operacao) {
    throw new Error("Salve primeiro a etapa da operação.");
  }

  if (!participantCode) {
    throw new Error("Informe o código do participante/condomínio.");
  }

  if (pesoRejeitoGeralKg === null) {
    throw new Error("Preencha o peso do rejeito geral.");
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
    deliveryType: STATE.operacao.deliveryType,
    flowType: "final_turno",
    observacao: STATE.operacao.opNotes || null,
    condCode,

    photoUrl: photoUrls[0] || null,
    photos: photoUrls,

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
   RESET FORMS
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

/* =========================
   FORMS
========================= */

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

      await salvarRecebimento();

      setMsg(
        $("msgRecebimento"),
        "ok",
        `Coleta de recebimento salva com sucesso em ${PAGE_TERRITORY.territoryLabel}.`
      );

      resetRecebimentoForm();
    } catch (error) {
      console.error(error);
      setMsg($("msgRecebimento"), "bad", error.message);
    } finally {
      STATE.salvando = false;
    }
  });

  $("formFinalTurno")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (STATE.salvando) return;
    if (!saveOperacaoBase() && !STATE.operacao) return;

    try {
      STATE.salvando = true;

      await salvarFinalTurno();

      setMsg(
        $("msgFinalTurno"),
        "ok",
        `Final de turno salvo com sucesso em ${PAGE_TERRITORY.territoryLabel}.`
      );

      resetFinalTurnoForm();
    } catch (error) {
      console.error(error);
      setMsg($("msgFinalTurno"), "bad", error.message);
    } finally {
      STATE.salvando = false;
    }
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

  console.log("Página COOADESC funcionando 100%");
}

init();