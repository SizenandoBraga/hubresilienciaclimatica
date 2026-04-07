import { db } from "./firebase-init.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG
========================= */

const CONFIG = {
  territoryId: "vila-pinto",
  territoryLabel: "Centro de Triagem Vila Pinto",
  redirectAfterSuccess: "/vila-pinto.html",
  viacepBase: "https://viacep.com.br/ws",
  nominatimBase: "https://nominatim.openstreetmap.org/search"
};

function getCanonicalTerritoryId() {
  return CONFIG.territoryId;
}

function getCanonicalTerritoryLabel() {
  return CONFIG.territoryLabel;
}

/* =========================
   STATE
========================= */

const STATE = {
  currentStep: 1,
  totalSteps: 4,
  localType: "casa",
  registerType: "participante",
  generatedCode: "",
  isSubmitting: false,
  geoRequestId: 0,
  geo: {
    lat: null,
    lng: null,
    addressLabel: ""
  }
};

/* =========================
   HELPERS
========================= */

const $ = (id) => document.getElementById(id);

const els = {
  form: $("participantWizardForm"),
  formMessage: $("formMessage"),

  stepIndicator: $("stepIndicator"),
  progressText: $("progressText"),
  progressBarFill: $("progressBarFill"),

  territoryLabelView: $("territoryLabelView"),
  userNameView: $("userNameView"),

  consentLgpd: $("consentLgpd"),
  consentWhatsapp: $("consentWhatsapp"),
  consentImage: $("consentImage"),

  fullName: $("fullName"),
  phone: $("phone"),
  email: $("email"),
  cpf: $("cpf"),

  localTypeGroup: $("localTypeGroup"),
  registerTypeGroup: $("registerTypeGroup"),
  generatedCode: $("generatedCode"),

  cep: $("cep"),
  btnBuscarCep: $("btnBuscarCep"),
  number: $("number"),
  street: $("street"),
  neighborhood: $("neighborhood"),
  city: $("city"),
  state: $("state"),
  referencePoint: $("referencePoint"),

  geoPreview: $("geoPreview"),
  latLngPreview: $("latLngPreview"),

  difficultyGroup: $("difficultyGroup"),
  difficultyDetail: $("difficultyDetail"),
  projectSource: $("projectSource"),

  successModal: $("successModal"),
  closeSuccessModal: $("closeSuccessModal"),

  menuToggle: $("menuToggle"),
  mobileMenu: $("mobileMenu"),

  btnSubmitParticipant: $("btnSubmitParticipant")
};

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function showMessage(message, type = "info") {
  if (!els.formMessage) return;

  els.formMessage.classList.remove("hidden", "error", "success", "info", "warning");
  els.formMessage.classList.add(type);
  els.formMessage.textContent = message;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function clearMessage() {
  if (!els.formMessage) return;
  els.formMessage.classList.add("hidden");
  els.formMessage.textContent = "";
  els.formMessage.classList.remove("error", "success", "info", "warning");
}

function setLoading(button, isLoading, loadingText = "Salvando...") {
  if (!button) return;

  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }
    button.disabled = true;
    button.textContent = loadingText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || "Salvar";
  }
}

function normalizeName(name = "") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function capitalizeWords(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatPhone(value = "") {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCPF(value = "") {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatCEP(value = "") {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidCPF(cpf = "") {
  const digits = onlyDigits(cpf);

  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;
  if (secondDigit !== Number(digits[10])) return false;

  return true;
}

function randomAlphaNum(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function generateParticipantCode() {
  return `RB-${randomAlphaNum(6)}`;
}

function generateCondominiumCode() {
  return `COND-${randomAlphaNum(6)}`;
}

function getRegisterTypeByLocalType(localType) {
  return localType === "condominio" ? "condominio" : "participante";
}

function updateGeoPreview() {
  if (els.geoPreview) {
    els.geoPreview.textContent = STATE.geo.addressLabel || "ainda não calculado";
  }

  if (els.latLngPreview) {
    if (STATE.geo.lat != null && STATE.geo.lng != null) {
      els.latLngPreview.textContent = `${STATE.geo.lat}, ${STATE.geo.lng}`;
    } else {
      els.latLngPreview.textContent = "ainda não calculado";
    }
  }
}

function resetGeo() {
  STATE.geo = {
    lat: null,
    lng: null,
    addressLabel: ""
  };
  updateGeoPreview();
}

function setRegisterType(registerType, regenerate = true) {
  STATE.registerType = registerType;

  const buttons = els.registerTypeGroup?.querySelectorAll("[data-register-type]") || [];
  buttons.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.registerType === registerType);
  });

  if (regenerate || !STATE.generatedCode) {
    STATE.generatedCode =
      registerType === "condominio"
        ? generateCondominiumCode()
        : generateParticipantCode();
  }

  if (els.generatedCode) {
    els.generatedCode.value = STATE.generatedCode;
  }
}

function setLocalType(localType) {
  STATE.localType = localType;

  const buttons = els.localTypeGroup?.querySelectorAll("[data-local-type]") || [];
  buttons.forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.localType === localType);
  });

  const autoRegisterType = getRegisterTypeByLocalType(localType);
  setRegisterType(autoRegisterType, true);
}

function getStepCards() {
  return Array.from(document.querySelectorAll(".step-card"));
}

function updateProgress() {
  if (els.stepIndicator) {
    els.stepIndicator.textContent = `Etapa ${STATE.currentStep} de ${STATE.totalSteps}`;
  }

  if (els.progressText) {
    els.progressText.textContent = `Progresso: ${STATE.currentStep}/${STATE.totalSteps}`;
  }

  if (els.progressBarFill) {
    const pct = (STATE.currentStep / STATE.totalSteps) * 100;
    els.progressBarFill.style.width = `${pct}%`;
  }

  getStepCards().forEach((card) => {
    const step = Number(card.dataset.step);
    const isActive = step === STATE.currentStep;

    card.classList.toggle("is-active", isActive);
    card.classList.toggle("hidden", !isActive);
  });
}

function goToStep(step) {
  if (step < 1 || step > STATE.totalSteps) return;
  STATE.currentStep = step;
  updateProgress();
  clearMessage();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   VALIDATION
========================= */

function validateStep1() {
  if (!els.consentLgpd?.checked || !els.consentWhatsapp?.checked || !els.consentImage?.checked) {
    showMessage("Para continuar, é necessário marcar todos os consentimentos da página 1.", "error");
    return false;
  }
  return true;
}

function validateStep2() {
  const fullName = normalizeName(els.fullName?.value);
  const phone = onlyDigits(els.phone?.value);
  const email = String(els.email?.value || "").trim();
  const cpf = String(els.cpf?.value || "").trim();

  if (!fullName || fullName.length < 5) {
    showMessage("Informe o nome completo corretamente.", "error");
    els.fullName?.focus();
    return false;
  }

  if (phone.length < 10 || phone.length > 11) {
    showMessage("Informe um telefone/WhatsApp válido com DDD.", "error");
    els.phone?.focus();
    return false;
  }

  if (!email) {
    showMessage("O e-mail é obrigatório.", "error");
    els.email?.focus();
    return false;
  }

  if (!isValidEmail(email)) {
    showMessage("Informe um e-mail válido.", "error");
    els.email?.focus();
    return false;
  }

  if (!cpf) {
    showMessage("O CPF é obrigatório.", "error");
    els.cpf?.focus();
    return false;
  }

  if (!isValidCPF(cpf)) {
    showMessage("Informe um CPF válido.", "error");
    els.cpf?.focus();
    return false;
  }

  if (!STATE.localType) {
    showMessage("Selecione o local para coleta.", "error");
    return false;
  }

  if (!STATE.registerType) {
    showMessage("Selecione o tipo de cadastro.", "error");
    return false;
  }

  if (!STATE.generatedCode) {
    showMessage("Não foi possível gerar o código do cadastro. Tente novamente.", "error");
    return false;
  }

  return true;
}

function validateStep3() {
  const cep = onlyDigits(els.cep?.value);
  const number = String(els.number?.value || "").trim();
  const street = String(els.street?.value || "").trim();
  const neighborhood = String(els.neighborhood?.value || "").trim();
  const city = String(els.city?.value || "").trim();
  const state = String(els.state?.value || "").trim();
  const referencePoint = String(els.referencePoint?.value || "").trim();

  if (cep.length !== 8) {
    showMessage("Informe um CEP válido.", "error");
    els.cep?.focus();
    return false;
  }

  if (!number) {
    showMessage("Informe o número do endereço.", "error");
    els.number?.focus();
    return false;
  }

  if (!street) {
    showMessage("Informe a rua.", "error");
    els.street?.focus();
    return false;
  }

  if (!neighborhood) {
    showMessage("Informe o bairro.", "error");
    els.neighborhood?.focus();
    return false;
  }

  if (!city) {
    showMessage("Informe a cidade.", "error");
    els.city?.focus();
    return false;
  }

  if (!state) {
    showMessage("Informe a UF.", "error");
    els.state?.focus();
    return false;
  }

  if (!referencePoint) {
    showMessage("Informe um ponto de referência.", "error");
    els.referencePoint?.focus();
    return false;
  }

  return true;
}

function validateStep4() {
  return true;
}

function validateCurrentStep() {
  switch (STATE.currentStep) {
    case 1: return validateStep1();
    case 2: return validateStep2();
    case 3: return validateStep3();
    case 4: return validateStep4();
    default: return true;
  }
}

/* =========================
   CEP + GEO
========================= */

async function fetchCEP(cep) {
  const cleanCep = onlyDigits(cep);
  if (cleanCep.length !== 8) throw new Error("CEP inválido.");

  const url = `${CONFIG.viacepBase}/${cleanCep}/json/`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Falha ao consultar o CEP.");
  }

  const data = await response.json();

  if (data.erro) throw new Error("CEP não encontrado.");
  return data;
}

async function geocodeAddress() {
  const street = String(els.street?.value || "").trim();
  const number = String(els.number?.value || "").trim();
  const neighborhood = String(els.neighborhood?.value || "").trim();
  const city = String(els.city?.value || "").trim();
  const state = String(els.state?.value || "").trim();
  const cep = onlyDigits(els.cep?.value);

  if (!street || !number || !city || !state) return null;

  const queryText = `${street}, ${number}, ${neighborhood}, ${city}, ${state}, Brasil, ${cep}`;
  const url = new URL(CONFIG.nominatimBase);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("q", queryText);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Falha ao geocodificar endereço.");
  }

  const results = await response.json();
  if (!Array.isArray(results) || !results.length) return null;

  const result = results[0];

  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
    addressLabel: result.display_name || queryText
  };
}

async function handleBuscarCep() {
  clearMessage();

  try {
    const data = await fetchCEP(els.cep?.value || "");

    if (els.street) els.street.value = data.logradouro || "";
    if (els.neighborhood) els.neighborhood.value = data.bairro || "";
    if (els.city) els.city.value = data.localidade || "";
    if (els.state) els.state.value = data.uf || "";

    showMessage("CEP encontrado com sucesso.", "success");
    await tryGeocodeWhenReady(true);
  } catch (error) {
    resetGeo();
    showMessage(error.message || "Não foi possível buscar o CEP.", "error");
  }
}

async function tryGeocodeWhenReady(force = false) {
  const requiredReady =
    String(els.street?.value || "").trim() &&
    String(els.number?.value || "").trim() &&
    String(els.city?.value || "").trim() &&
    String(els.state?.value || "").trim();

  if (!requiredReady) {
    if (force) resetGeo();
    return;
  }

  const requestId = ++STATE.geoRequestId;

  try {
    const geo = await geocodeAddress();

    if (requestId !== STATE.geoRequestId) return;

    STATE.geo = geo || { lat: null, lng: null, addressLabel: "" };
    updateGeoPreview();
  } catch {
    if (requestId !== STATE.geoRequestId) return;
    resetGeo();
  }
}

/* =========================
   DATA BUILDERS
========================= */

function getSelectedDifficulty() {
  return els.difficultyGroup?.querySelector(".choice-card.selected")?.dataset?.difficulty || "sim";
}

function buildParticipantPayload() {
  const territoryId = "vila-pinto";
  const territoryLabel = "Centro de Triagem Vila Pinto";

  const fullName = capitalizeWords(normalizeName(els.fullName?.value || ""));
  const phoneDigits = onlyDigits(els.phone?.value || "");
  const email = String(els.email?.value || "").trim().toLowerCase();
  const cpfDigits = onlyDigits(els.cpf?.value || "");
  const cepDigits = onlyDigits(els.cep?.value || "");

  const street = String(els.street?.value || "").trim();
  const number = String(els.number?.value || "").trim();
  const neighborhood = String(els.neighborhood?.value || "").trim();
  const city = String(els.city?.value || "").trim();
  const state = String(els.state?.value || "").trim().toUpperCase();
  const referencePoint = String(els.referencePoint?.value || "").trim();

  const difficulty = getSelectedDifficulty();
  const difficultyDetail = String(els.difficultyDetail?.value || "").trim();
  const projectSource = String(els.projectSource?.value || "").trim();

  const enderecoCompleto =
    `${street}, ${number} - ${neighborhood}, ${city}, ${state} - CEP ${formatCEP(cepDigits)} - Brasil`;

  return {
    name: fullName,
    fullName,
    phone: phoneDigits,
    email,
    cpf: cpfDigits,

    localType: STATE.localType,
    registerType: STATE.registerType,
    participantCode: STATE.generatedCode,

    cep: cepDigits,
    rua: street,
    street,
    numero: number,
    neighborhood,
    bairro: neighborhood,
    city,
    cidade: city,
    uf: state,
    state,
    referencePoint,
    enderecoCompleto,

    territoryId,
    territoryLabel,

    lat: STATE.geo.lat ?? null,
    lng: STATE.geo.lng ?? null,
    geoAddressLabel: STATE.geo.addressLabel || "",

    consentLgpd: !!els.consentLgpd?.checked,
    consentWhatsapp: !!els.consentWhatsapp?.checked,
    consentImage: !!els.consentImage?.checked,

    difficulty,
    difficultyDetail,
    projectSource,

    status: "pending_approval",
    approvalStatus: "pending",
    origin: "public_form",

    createdAt: serverTimestamp(),
    createdAtISO: new Date().toISOString()
  };
}

function buildApprovalRequestPayload(participantId, participantData) {
  const territoryId = "vila-pinto";
  const territoryLabel = "Centro de Triagem Vila Pinto";

  return {
    type: "participant_registration",
    targetCollection: "participants",
    targetId: participantId,

    territoryId,
    territoryLabel,

    participantCode: participantData.participantCode,
    participantName: participantData.name,
    participantEmail: participantData.email,
    participantPhone: participantData.phone,
    participantCpf: participantData.cpf,

    registerType: participantData.registerType,
    localType: participantData.localType,

    status: "pending",
    decision: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewedByName: null,
    reviewNote: null,

    source: "cadastro-publico",
    summary: `Novo cadastro enviado por ${participantData.name} para aprovação da cooperativa.`,

    payloadSnapshot: {
      name: participantData.name,
      email: participantData.email,
      phone: participantData.phone,
      cpf: participantData.cpf,
      participantCode: participantData.participantCode,
      registerType: participantData.registerType,
      localType: participantData.localType,
      territoryId: "vila-pinto",
      territoryLabel: "Centro de Triagem Vila Pinto",
      enderecoCompleto: participantData.enderecoCompleto,
      lat: participantData.lat ?? null,
      lng: participantData.lng ?? null
    },

    createdAt: serverTimestamp(),
    createdAtISO: new Date().toISOString()
  };
}

/* =========================
   FIRESTORE SAVE
========================= */

async function saveRegistration() {
  const participantPayload = buildParticipantPayload();

  const participantRef = await addDoc(collection(db, "participants"), participantPayload);

  const approvalRequestPayload = buildApprovalRequestPayload(
    participantRef.id,
    participantPayload
  );

  await addDoc(collection(db, "approvalRequests"), approvalRequestPayload);

  return {
    participantId: participantRef.id,
    approvalRequestId: null,
    participantCode: participantPayload.participantCode
  };
}

/* =========================
   SUCCESS MODAL
========================= */

function openSuccessModal() {
  if (!els.successModal) return;
  els.successModal.classList.remove("hidden");
  els.successModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeSuccessModal() {
  if (!els.successModal) return;
  els.successModal.classList.add("hidden");
  els.successModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  window.location.href = CONFIG.redirectAfterSuccess;
}

/* =========================
   EVENTS
========================= */

function bindStepNavigation() {
  document.querySelectorAll("[data-next-step]").forEach((button) => {
    button.addEventListener("click", async () => {
      clearMessage();

      if (!validateCurrentStep()) return;

      if (STATE.currentStep === 3) {
        await tryGeocodeWhenReady(true);
      }

      goToStep(STATE.currentStep + 1);
    });
  });

  document.querySelectorAll("[data-prev-step]").forEach((button) => {
    button.addEventListener("click", () => {
      clearMessage();
      goToStep(STATE.currentStep - 1);
    });
  });
}

function bindLocalTypeButtons() {
  const buttons = els.localTypeGroup?.querySelectorAll("[data-local-type]") || [];
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setLocalType(button.dataset.localType);
      clearMessage();
    });
  });
}

function bindRegisterTypeButtons() {
  const buttons = els.registerTypeGroup?.querySelectorAll("[data-register-type]") || [];
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      setRegisterType(button.dataset.registerType, true);
      clearMessage();
    });
  });
}

function bindDifficultyButtons() {
  const buttons = els.difficultyGroup?.querySelectorAll("[data-difficulty]") || [];
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((btn) => btn.classList.remove("selected"));
      button.classList.add("selected");
    });
  });
}

function bindFormatters() {
  els.phone?.addEventListener("input", (e) => {
    e.target.value = formatPhone(e.target.value);
  });

  els.cpf?.addEventListener("input", (e) => {
    e.target.value = formatCPF(e.target.value);
  });

  els.cep?.addEventListener("input", (e) => {
    e.target.value = formatCEP(e.target.value);
  });
}

function bindGeoEvents() {
  els.btnBuscarCep?.addEventListener("click", handleBuscarCep);

  ["number", "street", "neighborhood", "city", "state", "cep"].forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.addEventListener("change", async () => {
      await tryGeocodeWhenReady(false);
    });

    el.addEventListener("blur", async () => {
      await tryGeocodeWhenReady(false);
    });
  });
}

function bindMenu() {
  els.menuToggle?.addEventListener("click", () => {
    els.mobileMenu?.classList.toggle("open");
  });
}

function bindSuccessModal() {
  els.closeSuccessModal?.addEventListener("click", closeSuccessModal);
  els.successModal?.querySelector(".success-modal-backdrop")?.addEventListener("click", closeSuccessModal);
}

function bindSubmit() {
  els.form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    if (STATE.isSubmitting) return;

    if (!validateStep1()) return;
    if (!validateStep2()) return;
    if (!validateStep3()) return;
    if (!validateStep4()) return;

    STATE.isSubmitting = true;
    setLoading(els.btnSubmitParticipant, true, "Enviando cadastro...");

    try {
      await tryGeocodeWhenReady(true);
      const result = await saveRegistration();

      showMessage(
        `Cadastro enviado com sucesso para análise da cooperativa. Código gerado: ${result.participantCode}`,
        "success"
      );

      openSuccessModal();
    } catch (error) {
      console.error("Erro ao salvar cadastro:", error);
      showMessage(
        "Não foi possível enviar o cadastro. Verifique se as regras do Firestore permitem criar documentos em participants e approvalRequests.",
        "error"
      );
    } finally {
      STATE.isSubmitting = false;
      setLoading(els.btnSubmitParticipant, false);
    }
  });
}

/* =========================
   INIT
========================= */

function initStaticTexts() {
  if (els.territoryLabelView) {
    els.territoryLabelView.textContent = getCanonicalTerritoryLabel();
  }

  if (els.userNameView) {
    els.userNameView.textContent = "Cadastro público";
  }
}

function initDefaults() {
  setLocalType("casa");
  updateGeoPreview();
  updateProgress();
}

function init() {
  initStaticTexts();
  initDefaults();

  bindStepNavigation();
  bindLocalTypeButtons();
  bindRegisterTypeButtons();
  bindDifficultyButtons();
  bindFormatters();
  bindGeoEvents();
  bindMenu();
  bindSuccessModal();
  bindSubmit();
}

init();