import { auth, db } from "./firebase-init.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   STATE GLOBAL
========================= */

const STATE = {
  user: null,
  userDoc: null,
  territoryId: null,
  operacao: null,
  ultimaEtiqueta: null,
  salvando: false
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
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatFlow(value) {
  const map = {
    recebimento: "Recebimento",
    final_turno: "Registro final de turno"
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

function normalizeCode(value = "") {
  return String(value).trim().toUpperCase();
}

function isCondominioCode(code = "") {
  return normalizeCode(code).startsWith("COND-");
}

function togglePanels(flowType) {
  $("panelRecebimento")?.classList.toggle("hidden", flowType !== "recebimento");
  $("panelFinalTurno")?.classList.toggle("hidden", flowType !== "final_turno");
}

function toggleCondCode() {
  const flowType = $("flowType")?.value || "";
  const participantCode = $("participantCode")?.value || "";
  const condWrap = $("condCodeWrap");
  const condInput = $("condCode");

  if (!condWrap || !condInput) return;

  const shouldShow = flowType === "final_turno" && isCondominioCode(participantCode);

  condWrap.classList.toggle("hidden", !shouldShow);
  condInput.required = shouldShow;

  if (!shouldShow) {
    condInput.value = "";
  }
}

function ensureTerritory() {
  if (!STATE.territoryId) {
    throw new Error(
      "Usuário sem territoryId definido. Verifique o documento em users/{uid} no Firebase."
    );
  }
}

function getFormDeliveryType(formId) {
  return $(formId)?.querySelector('input[type="hidden"][id="deliveryType"]')?.value || null;
}

function setFormDeliveryType(formId, value) {
  const hidden = $(formId)?.querySelector('input[type="hidden"][id="deliveryType"]');
  if (hidden) hidden.value = value;
}

function clearFormDeliverySelection(formId) {
  const form = $(formId);
  if (!form) return;

  form.querySelectorAll("[data-delivery]").forEach((btn) => {
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  });

  setFormDeliveryType(formId, "");
}

/* =========================
   AUTH + USER
========================= */

async function loadUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

async function bootstrap(user) {
  setText("dbStatus", "conectado");

  const userDoc = await loadUserDoc(user.uid);

  if (!userDoc) {
    alert("Usuário não encontrado.");
    location.href = "index.html";
    return;
  }

  STATE.user = user;
  STATE.userDoc = userDoc;
  STATE.territoryId =
    userDoc.territoryId ||
    userDoc.territorioId ||
    userDoc.territory ||
    userDoc.cooperativaId ||
    null;

  console.log("UID logado:", user.uid);
  console.log("UserDoc:", userDoc);
  console.log("territoryId resolvido:", STATE.territoryId);

  if (!STATE.territoryId) {
    setText("dbStatus", "usuário sem território");
    alert(
      `Usuário sem território definido. Cadastre o campo territoryId no documento users/${user.uid}`
    );
  }
}

/* =========================
   CHOICES / SELEÇÕES
========================= */

function wireChoices() {
  document.querySelectorAll("[data-flow]").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-flow]").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-pressed", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      if ($("flowType")) $("flowType").value = btn.dataset.flow;

      setText("flowStatus", formatFlow(btn.dataset.flow));
      togglePanels(btn.dataset.flow);
      toggleCondCode();
    });
  });

  document.querySelectorAll("#formRecebimento [data-delivery]").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", () => {
      const form = $("formRecebimento");
      if (!form) return;

      form.querySelectorAll("[data-delivery]").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-pressed", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      setFormDeliveryType("formRecebimento", btn.dataset.delivery);
    });
  });

  document.querySelectorAll("#formFinalTurno [data-delivery]").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", () => {
      const form = $("formFinalTurno");
      if (!form) return;

      form.querySelectorAll("[data-delivery]").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-pressed", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      setFormDeliveryType("formFinalTurno", btn.dataset.delivery);
    });
  });

  document.querySelectorAll(".quality-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", "false");

    btn.addEventListener("click", () => {
      document.querySelectorAll(".quality-btn").forEach((el) => {
        el.classList.remove("active");
        el.setAttribute("aria-pressed", "false");
      });

      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");

      if ($("qualidadeNota")) {
        $("qualidadeNota").value = btn.dataset.quality;
      }
    });
  });

  $("participantCode")?.addEventListener("input", () => {
    toggleCondCode();
  });

  $("btnPreviewOperacao")?.addEventListener("click", () => {
    const participantCode = $("participantCode")?.value?.trim() || "não definido";
    const flow = $("flowType")?.value || "não definido";

    setMsg(
      $("msgOperacao"),
      "ok",
      `Prévia pronta: participante ${participantCode} / fluxo ${formatFlow(flow)}.`
    );
  });
}

/* =========================
   EXTRAS - FINAL DO TURNO
========================= */

function buildExtraRow() {
  const row = document.createElement("div");
  row.className = "extra-row";
  row.innerHTML = `
    <input type="text" class="extra-name" placeholder="Nome do material">
    <input type="number" step="0.01" class="extra-weight" placeholder="kg">
    <button type="button" class="remove-extra">Remover</button>
  `;

  const removeBtn = row.querySelector(".remove-extra");
  removeBtn?.addEventListener("click", () => row.remove());

  return row;
}

function wireExtras() {
  $("btnAddExtra")?.addEventListener("click", () => {
    $("extrasWrap")?.appendChild(buildExtraRow());
  });

  $$("#extrasWrap .extra-row").forEach((row) => {
    const removeBtn = row.querySelector(".remove-extra");
    removeBtn?.addEventListener("click", () => row.remove());
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
   FOTOS COM MINIATURA
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
   ETAPA 1 - DADOS INICIAIS
========================= */

function saveOperacaoBase() {
  const opDate = $("opDate")?.value;
  const participantCode = normalizeCode($("participantCode")?.value || "");
  const flowType = $("flowType")?.value;
  const opNotes = $("opNotes")?.value.trim() || null;

  if (!opDate || !participantCode || !flowType) {
    setMsg(
      $("msgOperacao"),
      "bad",
      "Preencha a data, o código do participante e o fluxo da operação."
    );
    return false;
  }

  if ($("participantCode")) {
    $("participantCode").value = participantCode;
  }

  STATE.operacao = {
    opDate,
    participantCode,
    flowType,
    opNotes
  };

  togglePanels(flowType);
  toggleCondCode();

  setMsg(
    $("msgOperacao"),
    "ok",
    "Etapa inicial salva com sucesso. Continue o preenchimento da coleta."
  );

  return true;
}

/* =========================
   ETIQUETA / MODAL / QR CODE
========================= */

function gerarQrCode(valor) {
  const qrContainer = $("qrcode");
  if (!qrContainer) return;

  qrContainer.innerHTML = "";

  if (typeof QRCode === "undefined") {
    console.error("Biblioteca QRCode não carregada.");
    qrContainer.innerHTML = "<small>QRCode não disponível</small>";
    return;
  }

  new QRCode(qrContainer, {
    text: valor,
    width: 180,
    height: 180,
    correctLevel: QRCode.CorrectLevel.H
  });
}

function preencherEtiquetaSimples(registro) {
  STATE.ultimaEtiqueta = registro;

  const familyCode =
    registro.familyCode ||
    registro.condCode ||
    registro.codigoFamilia ||
    registro.participantCode ||
    "SEM-CODIGO";

  const qrPayload = JSON.stringify({
    codigoFamilia: familyCode,
    participantCode: registro.participantCode || null,
    territoryId: STATE.territoryId || null,
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
   SALVAMENTO FIRESTORE
========================= */

async function salvarRecebimento() {
  ensureTerritory();

  const familyCode = $("familyCode")?.value.trim() || null;
  const pesoResiduoSecoKg = parseNum($("pesoResiduoSecoKg")?.value);
  const qualidadeNota = parseNum($("qualidadeNota")?.value);
  const recebimentoObs = $("recebimentoObs")?.value.trim() || null;
  const pesoRejeitoKg = parseNum($("pesoRejeitoKg")?.value);
  const pesoNaoComercializadoKg = parseNum($("pesoNaoComercializadoKg")?.value);
  const deliveryType = getFormDeliveryType("formRecebimento");
  const fotosResiduoQtd = $("fotoResiduo")?.files?.length || 0;

  if (
    !STATE.operacao ||
    !familyCode ||
    !deliveryType ||
    pesoResiduoSecoKg === null ||
    qualidadeNota === null ||
    pesoRejeitoKg === null ||
    pesoNaoComercializadoKg === null
  ) {
    throw new Error("Preencha o código da família, o tipo de entrega e todos os campos obrigatórios do recebimento.");
  }

  if (fotosResiduoQtd === 0) {
    throw new Error("As fotos do resíduo são obrigatórias.");
  }

  const codigoEtiqueta = gerarCodigoEtiqueta();

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId || null,
    createdBy: STATE.user?.uid || null,
    createdByName: STATE.userDoc?.name || STATE.userDoc?.displayName || null,

    opDate: STATE.operacao.opDate,
    participantCode: STATE.operacao.participantCode,
    deliveryType,
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
      fotosResiduoQtd,
      fotosNaoComercializadoQtd: $("fotoNaoComercializado")?.files?.length || 0
    }
  };

  const docRef = await addDoc(collection(db, "coletas"), payload);

  return {
    ...payload,
    id: docRef.id,
    createdAtLabel: new Date().toISOString(),
    familyCode,
    participantCode: STATE.operacao.participantCode,
    opDate: STATE.operacao.opDate,
    flowType: "recebimento"
  };
}

async function salvarFinalTurno() {
  ensureTerritory();

  const participantCode = STATE.operacao?.participantCode || "";
  const condCode = $("condCode")?.value.trim() || null;
  const pesoRejeitoGeralKg = parseNum($("pesoRejeitoGeralKg")?.value);
  const deliveryType = getFormDeliveryType("formFinalTurno");
  const precisaCondCode = isCondominioCode(participantCode);

  if (!STATE.operacao || !deliveryType || pesoRejeitoGeralKg === null) {
    throw new Error("Preencha o tipo de entrega e os campos obrigatórios do fechamento do turno.");
  }

  if (precisaCondCode && !condCode) {
    throw new Error("Informe o código do condomínio.");
  }

  const extras = getExtras();
  const codigoEtiqueta = gerarCodigoEtiqueta();

  const payload = {
    createdAt: serverTimestamp(),
    createdAtClient: new Date().toISOString(),

    territoryId: STATE.territoryId || null,
    createdBy: STATE.user?.uid || null,
    createdByName: STATE.userDoc?.name || STATE.userDoc?.displayName || null,

    opDate: STATE.operacao.opDate,
    participantCode,
    deliveryType,
    flowType: "final_turno",
    observacao: STATE.operacao.opNotes || null,
    codigoEtiqueta,

    condCode: precisaCondCode ? condCode : null,

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

  const docRef = await addDoc(collection(db, "coletas"), payload);

  return {
    ...payload,
    id: docRef.id,
    createdAtLabel: new Date().toISOString(),
    condCode: payload.condCode,
    participantCode,
    opDate: STATE.operacao.opDate,
    flowType: "final_turno"
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

  clearFormDeliverySelection("formRecebimento");
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

  clearFormDeliverySelection("formFinalTurno");
  toggleCondCode();
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

      const registro = await salvarRecebimento();

      preencherEtiquetaSimples(registro);
      openLabelModal();

      setMsg(
        $("msgRecebimento"),
        "ok",
        "Coleta de recebimento salva com sucesso. Cartão pronto para impressão."
      );

      resetRecebimentoForm();
    } catch (error) {
      console.error(error);
      setMsg(
        $("msgRecebimento"),
        "bad",
        error.message || "Erro ao salvar recebimento."
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

      const registro = await salvarFinalTurno();

      preencherEtiquetaSimples(registro);
      openLabelModal();

      setMsg(
        $("msgFinalTurno"),
        "ok",
        "Registro final do turno salvo com sucesso. Cartão pronto para impressão."
      );

      resetFinalTurnoForm();
    } catch (error) {
      console.error(error);
      setMsg(
        $("msgFinalTurno"),
        "bad",
        error.message || "Erro ao salvar fechamento do turno."
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

function init() {
  wireChoices();
  wireExtras();
  wireForms();
  wireLabelModal();

  if ($("opDate")) {
    $("opDate").value = toISODate(new Date());
  }

  toggleCondCode();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setText("dbStatus", "deslogado");
      location.href = "index.html";
      return;
    }

    try {
      await bootstrap(user);
      console.log("🔥 Firebase conectado");
    } catch (error) {
      console.error("Erro no bootstrap:", error);
      setText("dbStatus", "erro");
      alert("Não foi possível carregar os dados do usuário.");
    }
  });
}

init();