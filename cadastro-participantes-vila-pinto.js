import { db } from "./firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function saveParticipant(payload) {
  return await addDoc(collection(db, "participants"), payload);
}
/* =========================
   CONFIGURAÇÃO DA PÁGINA PÚBLICA
========================= */
const PUBLIC_TERRITORY = {
  territoryId: "crgr_vila_pinto",
  territoryLabel: "Centro de Triagem Vila Pinto"
};

const PUBLIC_SOURCE = {
  createdBy: "",
  createdByName: "Cadastro público",
  createdByRole: "public"
};

/* =========================
   ELEMENTOS
========================= */
const els = {
  menuToggle: document.getElementById("menuToggle"),
  mobileMenu: document.getElementById("mobileMenu"),

  territoryLabelView: document.getElementById("territoryLabelView"),
  userNameView: document.getElementById("userNameView"),

  formMessage: document.getElementById("formMessage"),
  form: document.getElementById("participantWizardForm"),

  stepIndicator: document.getElementById("stepIndicator"),
  progressText: document.getElementById("progressText"),
  progressBarFill: document.getElementById("progressBarFill"),

  consentLgpd: document.getElementById("consentLgpd"),
  consentWhatsapp: document.getElementById("consentWhatsapp"),
  consentImage: document.getElementById("consentImage"),

  fullName: document.getElementById("fullName"),
  phone: document.getElementById("phone"),
  email: document.getElementById("email"),
  cpf: document.getElementById("cpf"),
  generatedCode: document.getElementById("generatedCode"),

  cep: document.getElementById("cep"),
  number: document.getElementById("number"),
  street: document.getElementById("street"),
  neighborhood: document.getElementById("neighborhood"),
  city: document.getElementById("city"),
  state: document.getElementById("state"),
  referencePoint: document.getElementById("referencePoint"),
  geoPreview: document.getElementById("geoPreview"),

  difficultyDetail: document.getElementById("difficultyDetail"),
  projectSource: document.getElementById("projectSource"),

  btnBuscarCep: document.getElementById("btnBuscarCep"),
  btnSubmitParticipant: document.getElementById("btnSubmitParticipant"),

  successModal: document.getElementById("successModal"),
  closeSuccessModal: document.getElementById("closeSuccessModal")
};

let currentStep = 1;
let selectedLocalType = "casa";
let selectedRegisterType = "participante";
let selectedDifficulty = "sim";

const TOTAL_STEPS = 4;

/* =========================
   HEADER MOBILE
========================= */
if (els.menuToggle && els.mobileMenu) {
  els.menuToggle.addEventListener("click", () => {
    els.mobileMenu.classList.toggle("show");
  });
}

/* =========================
   HELPERS
========================= */
function fillHeaderPublicData() {
  if (els.territoryLabelView) {
    els.territoryLabelView.textContent = PUBLIC_TERRITORY.territoryLabel;
  }

  if (els.userNameView) {
    els.userNameView.textContent = "Cadastro público";
  }
}

function getValue(el) {
  return el ? String(el.value || "").trim() : "";
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function showMessage(message, type = "error") {
  if (!els.formMessage) return;

  els.formMessage.classList.remove("hidden", "error", "success");
  els.formMessage.classList.add(type);
  els.formMessage.textContent = message;
}

function hideMessage() {
  if (!els.formMessage) return;

  els.formMessage.classList.add("hidden");
  els.formMessage.classList.remove("error", "success");
  els.formMessage.textContent = "";
}

function updateProgress() {
  if (els.stepIndicator) {
    els.stepIndicator.textContent = `Etapa ${currentStep} de ${TOTAL_STEPS}`;
  }

  if (els.progressText) {
    els.progressText.textContent = `Progresso: ${currentStep}/${TOTAL_STEPS}`;
  }

  if (els.progressBarFill) {
    els.progressBarFill.style.width = `${(currentStep / TOTAL_STEPS) * 100}%`;
  }
}

function showStep(step) {
  currentStep = step;

  document.querySelectorAll(".step-card").forEach((card) => {
    const isCurrent = Number(card.dataset.step) === step;
    card.classList.toggle("hidden", !isCurrent);
    card.classList.toggle("is-active", isCurrent);
  });

  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function generateParticipantCode() {
  const prefix = selectedRegisterType === "condominio" ? "COND" : "RB";
  const number = Math.floor(100000 + Math.random() * 900000);
  const code = `${prefix}-${number}`;

  if (els.generatedCode) {
    els.generatedCode.value = code;
  }
}

function bindChoiceGroup(selector, callback) {
  const buttons = document.querySelectorAll(selector);

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("selected"));
      button.classList.add("selected");
      callback(button.dataset);
    });
  });
}

function normalizePhone(value) {
  return onlyDigits(value);
}

function formatCepInput(value) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatCpfInput(value) {
  const digits = onlyDigits(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function validateStep(step) {
  if (step === 1) {
    if (!els.consentLgpd?.checked || !els.consentWhatsapp?.checked || !els.consentImage?.checked) {
      throw new Error("Para avançar, é necessário marcar todos os termos de autorização.");
    }
  }

  if (step === 2) {
    if (!getValue(els.fullName)) {
      throw new Error("Informe o nome completo.");
    }

    const phone = normalizePhone(getValue(els.phone));
    if (!phone) throw new Error("Informe o telefone / WhatsApp.");
    if (phone.length < 10) throw new Error("Informe um telefone válido com DDD.");

    if (!getValue(els.generatedCode)) {
      throw new Error("O código do cadastro não foi gerado.");
    }
  }

  if (step === 3) {
    if (!getValue(els.cep)) throw new Error("Informe o CEP.");
    if (!getValue(els.number)) throw new Error("Informe o número.");
    if (!getValue(els.street)) throw new Error("Informe a rua.");
    if (!getValue(els.neighborhood)) throw new Error("Informe o bairro.");
    if (!getValue(els.city)) throw new Error("Informe a cidade.");
    if (!getValue(els.state)) throw new Error("Informe a UF.");
    if (!getValue(els.referencePoint)) throw new Error("Informe um ponto de referência.");
  }
}

async function fetchCep() {
  const cep = onlyDigits(getValue(els.cep));

  if (!cep || cep.length !== 8) {
    throw new Error("Informe um CEP válido com 8 números.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) {
    throw new Error("Não foi possível consultar o CEP.");
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  if (els.street) els.street.value = data.logradouro || "";
  if (els.neighborhood) els.neighborhood.value = data.bairro || "";
  if (els.city) els.city.value = data.localidade || "";
  if (els.state) els.state.value = data.uf || "";
  if (els.cep) els.cep.value = formatCepInput(cep);

  updateGeoPreview();
}

function updateGeoPreview() {
  if (!els.geoPreview) return;

  const cep = getValue(els.cep);
  const number = getValue(els.number);
  const street = getValue(els.street);
  const neighborhood = getValue(els.neighborhood);
  const city = getValue(els.city);

  if (cep && number && street) {
    els.geoPreview.textContent =
      `${street}, ${number}${neighborhood ? ` • ${neighborhood}` : ""}${city ? ` • ${city}` : ""} • CEP ${cep}`;
  } else {
    els.geoPreview.textContent = "ainda não calculado";
  }
}

/* =========================
   MODAL DE SUCESSO
========================= */
function openSuccessModal() {
  if (!els.successModal) return;

  els.successModal.classList.remove("hidden");
  els.successModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeSuccessModalAndGoBack() {
  if (els.successModal) {
    els.successModal.classList.add("hidden");
    els.successModal.setAttribute("aria-hidden", "true");
  }

  document.body.classList.remove("modal-open");
  window.location.href = "/vila-pinto.html";
}

/* =========================
   PAYLOAD
========================= */
function buildPayload() {
  const nowIso = new Date().toISOString();

  const rua = getValue(els.street);
  const numero = getValue(els.number);
  const bairro = getValue(els.neighborhood);
  const cidade = getValue(els.city);
  const uf = getValue(els.state);
  const cep = getValue(els.cep);
  const complemento = getValue(els.referencePoint);

  const enderecoCompleto =
    `${rua}, ${numero} - ${bairro}, ${cidade}, ${uf} - CEP ${cep}`;

  return {
    bairro: bairro || "",
    cep: cep || "",
    cidade: cidade || "",
    complemento: complemento || "",

    createdAt: serverTimestamp(),
    createdAtIso: nowIso,

    createdBy: PUBLIC_SOURCE.createdBy,
    createdByName: PUBLIC_SOURCE.createdByName,
    createdByRole: PUBLIC_SOURCE.createdByRole,

    enderecoCompleto: enderecoCompleto || "",
    localColeta: selectedLocalType || "",

    name: getValue(els.fullName) || "",
    numero: numero || "",
    participanteCode: getValue(els.generatedCode) || "",
    phone: normalizePhone(getValue(els.phone)) || "",
    rua: rua || "",

    territoryId: PUBLIC_TERRITORY.territoryId || "",
    territoryLabel: PUBLIC_TERRITORY.territoryLabel || "",
    uf: uf || "",

    source: "public_form",
    status: "pending_review",
    active: true
  };
}

async function saveParticipant(payload) {
  return await addDoc(collection(db, "participants"), payload);
}

function getFirebaseErrorMessage(error) {
  const code = error?.code || "";

  if (code === "permission-denied") {
    return "O Firestore recusou a gravação. Verifique se as rules publicadas no console são as novas regras ajustadas.";
  }

  if (code === "unavailable") {
    return "O Firebase está indisponível no momento. Tente novamente em instantes.";
  }

  if (code === "failed-precondition") {
    return "Há uma configuração pendente no Firebase. Revise a coleção participants e as regras.";
  }

  return error?.message || "Não foi possível salvar o participante.";
}

/* =========================
   EVENTS
========================= */
function bindNavigation() {
  document.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", () => {
      try {
        hideMessage();
        validateStep(currentStep);
        showStep(Math.min(currentStep + 1, TOTAL_STEPS));
      } catch (error) {
        showMessage(error.message, "error");
      }
    });
  });

  document.querySelectorAll("[data-prev-step]").forEach((button) => {
    button.addEventListener("click", () => {
      hideMessage();
      showStep(Math.max(currentStep - 1, 1));
    });
  });
}

function bindMasks() {
  els.cep?.addEventListener("input", (event) => {
    event.target.value = formatCepInput(event.target.value);
    updateGeoPreview();
  });

  els.cpf?.addEventListener("input", (event) => {
    event.target.value = formatCpfInput(event.target.value);
  });

  els.phone?.addEventListener("input", (event) => {
    event.target.value = event.target.value.replace(/[^\d()\-\s+]/g, "");
  });
}

function bindEvents() {
  bindNavigation();
  bindMasks();

  bindChoiceGroup("[data-local-type]", (dataset) => {
    selectedLocalType = dataset.localType;
  });

  bindChoiceGroup("[data-register-type]", (dataset) => {
    selectedRegisterType = dataset.registerType;
    generateParticipantCode();
  });

  bindChoiceGroup("[data-difficulty]", (dataset) => {
    selectedDifficulty = dataset.difficulty;
  });

  els.btnBuscarCep?.addEventListener("click", async () => {
    try {
      hideMessage();
      await fetchCep();
    } catch (error) {
      showMessage(error.message, "error");
    }
  });

  [els.cep, els.number, els.street, els.neighborhood, els.city].forEach((input) => {
    input?.addEventListener("input", updateGeoPreview);
  });

  els.closeSuccessModal?.addEventListener("click", closeSuccessModalAndGoBack);

  els.successModal?.addEventListener("click", (event) => {
    if (event.target.classList.contains("success-modal-backdrop")) {
      closeSuccessModalAndGoBack();
    }
  });

  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      hideMessage();

      validateStep(1);
      validateStep(2);
      validateStep(3);

      const payload = buildPayload();
      console.log("Payload enviado ao Firebase:", payload);

      if (els.btnSubmitParticipant) {
        els.btnSubmitParticipant.disabled = true;
        els.btnSubmitParticipant.textContent = "Salvando...";
      }

      const docRef = await saveParticipant(payload);
      console.log("Participante salvo com ID:", docRef.id);

      hideMessage();
      openSuccessModal();
      els.form.reset();

      selectedLocalType = "casa";
      selectedRegisterType = "participante";
      selectedDifficulty = "sim";

      document.querySelectorAll("[data-local-type]").forEach((btn) => {
        btn.classList.toggle("selected", btn.dataset.localType === "casa");
      });

      document.querySelectorAll("[data-register-type]").forEach((btn) => {
        btn.classList.toggle("selected", btn.dataset.registerType === "participante");
      });

      document.querySelectorAll("[data-difficulty]").forEach((btn) => {
        btn.classList.toggle("selected", btn.dataset.difficulty === "sim");
      });

      generateParticipantCode();
      updateGeoPreview();
      showStep(1);
    } catch (error) {
      console.error("Erro ao salvar participante:", error);
      showMessage(getFirebaseErrorMessage(error), "error");
    } finally {
      if (els.btnSubmitParticipant) {
        els.btnSubmitParticipant.disabled = false;
        els.btnSubmitParticipant.textContent = "Concluir cadastro";
      }
    }
  });
}

/* =========================
   BOOT
========================= */
function boot() {
  fillHeaderPublicData();
  bindEvents();
  generateParticipantCode();
  updateProgress();
  updateGeoPreview();
}

boot();