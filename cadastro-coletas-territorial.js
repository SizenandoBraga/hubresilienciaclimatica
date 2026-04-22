import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

/* =========================
   CONFIG FIXA VILA PINTO
========================= */

const PAGE_TERRITORY = {
  territoryId: "vila-pinto",
  territoryLabel: "Centro de Triagem Vila Pinto",
  backUrl: "./vila-pinto.html"
};

const storage = getStorage();

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

function makeSafeFileName(name = "arquivo.jpg") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

function ensureImageFile(file, label = "foto") {
  if (!file) {
    throw new Error(`A ${label} é obrigatória.`);
  }
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error(`O arquivo enviado em ${label} deve ser uma imagem.`);
  }
}

async function uploadSingleImage(file, folderPath) {
  ensureImageFile(file, "foto");

  const path = `${folderPath}/${Date.now()}_${makeSafeFileName(file.name)}`;
  const ref = storageRef(storage, path);

  await uploadBytes(ref, file, {
    contentType: file.type || "image/jpeg"
  });

  const url = await getDownloadURL(ref);
  return {
    path,
    url,
    name: file.name,
    type: file.type || "",
    size: file.size || 0
  };
}

async function uploadManyImages(files, folderPath) {
  const validFiles = Array.from(files || []).filter(Boolean);
  if (!validFiles.length) {
    throw new Error("Pelo menos uma foto é obrigatória.");
  }

  const uploaded = [];
  for (const file of validFiles) {
    const result = await uploadSingleImage(file, folderPath);
    uploaded.push(result);
  }
  return uploaded;
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
      if ($("qualidadeNota")) $("qualidadeNota").value = btn.dataset.quality;
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
    qualidadeNota === null ||
    pesoRejeitoKg === null ||
    pesoNaoComercializadoKg === null
  ) {
    throw new Error("Preencha todos os campos obrigatórios do recebimento.");
  }

  ensureImageFile(fotoResiduoFile, "foto do resíduo");
  ensureImageFile(fotoNaoComercializadoFile, "foto do não comercializado");

  const uploadBase = `coletas/${STATE.territoryId}/recebimento/${participantCode}/${Date.now()}`;

  const [fotoResiduoUpload, fotoNaoComercializadoUpload] = await Promise.all([
    uploadSingleImage(fotoResiduoFile, `${uploadBase}/residuo`),
    uploadSingleImage(fotoNaoComercializadoFile, `${uploadBase}/nao-comercializado`)
  ]);

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

    photoUrl: fotoResiduoUpload.url,
    photos: [fotoResiduoUpload.url, fotoNaoComercializadoUpload.url],

    recebimento: {
      pesoResiduoSecoKg,
      qualidadeNota,
      observacao: recebimentoObs,
      pesoRejeitoKg,
      pesoNaoComercializadoKg,

      fotoResiduoUrl: fotoResiduoUpload.url,
      fotoNaoComercializadoUrl: fotoNaoComercializadoUpload.url,

      photos: [fotoResiduoUpload.url, fotoNaoComercializadoUpload.url],

      uploads: {
        fotoResiduo: fotoResiduoUpload,
        fotoNaoComercializado: fotoNaoComercializadoUpload
      }
    }
  };

  console.log("Tentando salvar recebimento com:", {
    uid: STATE.user?.uid || null,
    role: STATE.userDoc?.role || null,
    status: STATE.userDoc?.status || null,
    active: STATE.userDoc?.active ?? null,
    userTerritoryId: STATE.userDoc?.territoryId || null,
    payloadTerritoryId: payload.territoryId,
    participantCode: payload.participantCode || null,
    createdBy: payload.createdBy || null
  });

  console.log("Payload recebimento:", JSON.stringify(payload, null, 2));

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

  if (!fotosFinalTurno.length) {
    throw new Error("Pelo menos uma foto do final do turno é obrigatória.");
  }

  const extras = getExtras();
  const uploadBase = `coletas/${STATE.territoryId}/final_turno/${participantCode}/${Date.now()}`;
  const uploadedPhotos = await uploadManyImages(fotosFinalTurno, `${uploadBase}/fotos`);
  const photoUrls = uploadedPhotos.map((item) => item.url);

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

    photoUrl: photoUrls[0],
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

  console.log("Tentando salvar final do turno com:", {
    uid: STATE.user?.uid || null,
    role: STATE.userDoc?.role || null,
    status: STATE.userDoc?.status || null,
    active: STATE.userDoc?.active ?? null,
    userTerritoryId: STATE.userDoc?.territoryId || null,
    payloadTerritoryId: payload.territoryId,
    participantCode: payload.participantCode || null,
    createdBy: payload.createdBy || null
  });

  console.log("Payload finalTurno:", JSON.stringify(payload, null, 2));

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
  if ($("qualidadeNota")) $("qualidadeNota").value = "";

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
      setMsg($("msgRecebimento"), "bad", error.message || "Erro ao salvar recebimento.");
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
      setMsg($("msgFinalTurno"), "bad", error.message || "Erro ao salvar fechamento do turno.");
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