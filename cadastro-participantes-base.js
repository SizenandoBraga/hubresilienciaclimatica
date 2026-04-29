import { db } from "./firebase-init.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =========================
   CONFIG DINÂMICA
========================= */

const BODY = document.body;

const CONFIG = {
  territoryId: String(BODY.dataset.territoryId || "").trim(),
  territoryLabel: String(BODY.dataset.territoryLabel || "").trim(),
  territorySlug: String(BODY.dataset.territorySlug || "").trim(),
  redirectAfterSuccess: String(BODY.dataset.redirectUrl || "index.html").trim(),
  viacepBase: "https://viacep.com.br/ws",
  nominatimBase: "https://nominatim.openstreetmap.org/search"
};

const CODE_CONFIG = {
  "vila-pinto": {
    casa: { prefix: "VPD", start: 300 },
    condominio: { prefix: "VPCD", start: 10 },
    comercio: { prefix: "VPCM", start: 10 },
    outro: { prefix: "VPD", start: 300 }
  },
  "cooadesc": {
    casa: { prefix: "COD", start: 1 },
    condominio: { prefix: "COCD", start: 1 },
    comercio: { prefix: "COCM", start: 1 },
    outro: { prefix: "COD", start: 1 }
  },
  "padre-cacique": {
    casa: { prefix: "PCD", start: 1 },
    condominio: { prefix: "PCCD", start: 1 },
    comercio: { prefix: "PCCM", start: 1 },
    outro: { prefix: "PCD", start: 1 }
  }
};

/* =========================
   STATE
========================= */

const STATE = {
  currentStep: 1,
  totalSteps: 4,
  localType: "casa",
  registerType: "participante",
  generatedCode: "",
  consentAccepted: false,
  isSubmitting: false,
  geoRequestId: 0,
  geo: {
    lat: null,
    lng: null,
    addressLabel: ""
  }
};

/* =========================
   ELEMENTOS
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
  btnAcceptAllConsents: $("btnAcceptAllConsents"),
  consentAcceptedNote: $("consentAcceptedNote"),

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
  householdMembers: $("householdMembers"),
  projectSource: $("projectSource"),
  projectSourceOther: $("projectSourceOther"),

  successModal: $("successModal"),
  closeSuccessModal: $("closeSuccessModal"),

  menuToggle: $("menuToggle"),
  mobileMenu: $("mobileMenu"),

  btnSubmitParticipant: $("btnSubmitParticipant")
};

/* =========================
   HELPERS
========================= */

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
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

function showMessage(message, type = "info") {
  if (!els.formMessage) return;

  els.formMessage.classList.remove("hidden", "error", "success", "info", "warning");
  els.formMessage.classList.add(type);
  els.formMessage.textContent = message;

  window.scrollTo({ top: 0, behavior: "smooth" });
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

  if (!digits) return true;
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }

  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== Number(digits[9])) return false;

  sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }

  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;
  if (secondDigit !== Number(digits[10])) return false;

  return true;
}

/* =========================
   CONFIG AUXILIAR
========================= */

function getCanonicalTerritoryId() {
  return CONFIG.territoryId;
}

function getCanonicalTerritoryLabel() {
  return CONFIG.territoryLabel;
}

function getCodeTerritoryKey() {
  return String(CONFIG.territorySlug || CONFIG.territoryId || "")
    .toLowerCase()
    .replace(/^crgr_/, "")
    .replace(/_/g, "-")
    .trim();
}

function getCodeLocalType() {
  const localType = String(STATE.localType || "casa").trim();

  if (localType === "condominio") return "condominio";
  if (localType === "comercio") return "comercio";
  if (localType === "outro") return "outro";

  return "casa";
}

function assertRuntimeConfig() {
  if (!CONFIG.territoryId || !CONFIG.territoryLabel) {
    throw new Error(
      "Configuração do território ausente. Verifique os atributos data-territory-id e data-territory-label no body."
    );
  }
}

/* =========================
   CÓDIGO SEQUENCIAL
========================= */

async function generateSequentialCode() {
  const territoryKey = getCodeTerritoryKey();
  const localTypeKey = getCodeLocalType();

  const config = CODE_CONFIG[territoryKey]?.[localTypeKey];

  if (!config) {
    throw new Error(`Configuração de código não encontrada para ${territoryKey}/${localTypeKey}.`);
  }

  const { prefix, start } = config;

  const q = query(
    collection(db, "participants"),
    where("territoryId", "==", getCanonicalTerritoryId()),
    where("codeLocalType", "==", localTypeKey)
  );

  const snapshot = await getDocs(q);

  let maxNumber = 0;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const code = String(data.participantCode || "").trim();

    if (!code.startsWith(`${prefix}-`)) return;

    const numberPart = Number(code.split("-")[1]);

    if (Number.isFinite(numberPart) && numberPart > maxNumber) {
      maxNumber = numberPart;
    }
  });

  const nextNumber = Math.max(start, maxNumber + 1);

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
}

function getRegisterTypeByLocalType(localType) {
  return localType === "condominio" ? "condominio" : "participante";
}

/* =========================
   GEO PREVIEW
========================= */

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

/* =========================
   TIPO DE LOCAL / CÓDIGO
========================= */

function syncRegisterTypeUI() {
  const buttons = els.registerTypeGroup?.querySelectorAll("[data-register-type]") || [];

  buttons.forEach((btn) => {
    const registerType = btn.dataset.registerType;
    const isSelected = registerType === STATE.registerType;

    const shouldBeDisabled =
      STATE.localType === "condominio"
        ? registerType !== "condominio"
        : registerType === "condominio";

    btn.classList.toggle("selected", isSelected);
    btn.classList.toggle("is-disabled", shouldBeDisabled);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

async function setRegisterType(registerType, regenerate = true) {
  STATE.registerType = registerType;

  if (regenerate || !STATE.generatedCode) {
    STATE.generatedCode = await generateSequentialCode();
  }

  if (els.generatedCode) {
    els.generatedCode.value = STATE.generatedCode;
  }

  syncRegisterTypeUI();
}

async function setLocalType(localType) {
  STATE.localType = localType;

  const buttons = els.localTypeGroup?.querySelectorAll("[data-local-type]") || [];

  buttons.forEach((btn) => {
    const selected = btn.dataset.localType === localType;
    btn.classList.toggle("selected", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  const autoRegisterType = getRegisterTypeByLocalType(localType);

  try {
    await setRegisterType(autoRegisterType, true);
  } catch (error) {
    console.warn("Não foi possível gerar o código neste momento:", error);

    if (els.generatedCode) {
      els.generatedCode.value = "Será gerado ao concluir";
    }
  }
}

/* =========================
   STEPS
========================= */

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
   VALIDAÇÃO
========================= */

function validateStep1() {
  if (!STATE.consentAccepted) {
    showMessage("Para continuar, clique em “Concordo com todas as autorizações”.", "error");
    els.btnAcceptAllConsents?.focus();
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

  if (email && !isValidEmail(email)) {
    showMessage("O e-mail informado não é válido. Corrija ou deixe o campo em branco.", "error");
    els.email?.focus();
    return false;
  }

  if (cpf && !isValidCPF(cpf)) {
    showMessage("O CPF informado não é válido. Corrija ou deixe o campo em branco.", "error");
    els.cpf?.focus();
    return false;
  }

  return true;
}

function validateStep3() {
  const referencePoint = String(els.referencePoint?.value || "").trim();

  if (!referencePoint) {
    showMessage("Informe o ponto de referência.", "error");
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
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return validateStep4();
    default:
      return true;
  }
}

/* =========================
   CEP + GEO
========================= */

async function fetchCEP(cep) {
  const cleanCep = onlyDigits(cep);

  if (cleanCep.length !== 8) {
    throw new Error("CEP inválido.");
  }

  const url = `${CONFIG.viacepBase}/${cleanCep}/json/`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Falha ao consultar o CEP.");
  }

  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  return data;
}

async function geocodeAddress() {
  const street = String(els.street?.value || "").trim();
  const number = String(els.number?.value || "").trim();
  const neighborhood = String(els.neighborhood?.value || "").trim();
  const city = String(els.city?.value || "").trim();
  const state = String(els.state?.value || "").trim();
  const cep = onlyDigits(els.cep?.value);

  if (!street || !number || !city || !state) {
    return null;
  }

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

  if (!Array.isArray(results) || !results.length) {
    return null;
  }

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

    STATE.geo = geo || {
      lat: null,
      lng: null,
      addressLabel: ""
    };

    updateGeoPreview();
  } catch {
    if (requestId !== STATE.geoRequestId) return;
    resetGeo();
  }
}

/* =========================
   PAYLOAD
========================= */

function getSelectedDifficulty() {
  return els.difficultyGroup?.querySelector(".choice-card.selected")?.dataset?.difficulty || "sim";
}

function getProjectSourceLabel() {
  if (!els.projectSource) return null;

  const selectedOption = els.projectSource.options[els.projectSource.selectedIndex];

  return selectedOption?.textContent?.trim() || null;
}

function buildAddressLabel() {
  const cepDigits = onlyDigits(els.cep?.value || "");
  const street = String(els.street?.value || "").trim();
  const number = String(els.number?.value || "").trim();
  const neighborhood = String(els.neighborhood?.value || "").trim();
  const city = String(els.city?.value || "").trim();
  const state = String(els.state?.value || "").trim().toUpperCase();
  const referencePoint = String(els.referencePoint?.value || "").trim();

  const enderecoCompleto = [
    street && number ? `${street}, ${number}` : street || number,
    neighborhood,
    city || state ? `${city}${city && state ? ", " : ""}${state}` : "",
    cepDigits ? `CEP ${formatCEP(cepDigits)}` : "",
    "Brasil"
  ].filter(Boolean).join(" - ");

  return enderecoCompleto || referencePoint;
}

function buildParticipantPayload() {
  const territoryId = getCanonicalTerritoryId();
  const territoryLabel = getCanonicalTerritoryLabel();

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
  const householdMembers = String(els.householdMembers?.value || "").trim();

  const projectSource = String(els.projectSource?.value || "").trim() || null;
  const projectSourceLabel = getProjectSourceLabel();
  const projectSourceOther = String(els.projectSourceOther?.value || "").trim() || null;

  return {
    name: fullName,
    fullName,
    nameLower: slugify(fullName),

    phone: phoneDigits,
    email: email || null,
    cpf: cpfDigits || null,

    localType: STATE.localType,
    codeLocalType: getCodeLocalType(),
    registerType: STATE.registerType,
    participantType: STATE.registerType,
    participantCode: STATE.generatedCode,

    cep: cepDigits || null,
    rua: street || null,
    street: street || null,
    numero: number || null,
    neighborhood: neighborhood || null,
    bairro: neighborhood || null,
    city: city || null,
    cidade: city || null,
    uf: state || null,
    state: state || null,
    referencePoint,
    enderecoCompleto: buildAddressLabel(),
    address: buildAddressLabel(),

    territoryId,
    territoryLabel,

    lat: STATE.geo.lat ?? null,
    lng: STATE.geo.lng ?? null,
    geoAddressLabel: STATE.geo.addressLabel || "",

    consentLgpd: true,
    consentWhatsapp: true,
    consentImage: true,
    consentAccepted: true,

    difficulty,
    householdMembers,
    projectSource,
    projectSourceLabel,
    projectSourceOther,

    status: "pending_approval",
    approvalStatus: "pending",
    origin: "public_form",
    source: "cadastro-publico",

    inTerritory: true,
    inOperation: false,
    active: false,

    createdAt: serverTimestamp(),
    createdAtISO: new Date().toISOString()
  };
}

function buildApprovalRequestPayload(participantId, participantData) {
  const territoryId = getCanonicalTerritoryId();
  const territoryLabel = getCanonicalTerritoryLabel();

  return {
    type: "participant_registration",
    targetCollection: "participants",
    targetId: participantId,

    territoryId,
    territoryLabel,

    participantCode: participantData.participantCode,
    participantName: participantData.name,
    participantEmail: participantData.email || null,
    participantPhone: participantData.phone,
    participantCpf: participantData.cpf || null,

    registerType: participantData.registerType,
    localType: participantData.localType,
    codeLocalType: participantData.codeLocalType,

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
      email: participantData.email || null,
      phone: participantData.phone,
      cpf: participantData.cpf || null,
      participantCode: participantData.participantCode,
      registerType: participantData.registerType,
      localType: participantData.localType,
      codeLocalType: participantData.codeLocalType,
      territoryId,
      territoryLabel,
      enderecoCompleto: participantData.enderecoCompleto,
      referencePoint: participantData.referencePoint,
      lat: participantData.lat ?? null,
      lng: participantData.lng ?? null,
      householdMembers: participantData.householdMembers,
      projectSource: participantData.projectSource,
      projectSourceLabel: participantData.projectSourceLabel,
      projectSourceOther: participantData.projectSourceOther
    },

    createdAt: serverTimestamp(),
    createdAtISO: new Date().toISOString()
  };
}

async function saveRegistration() {
  if (!STATE.generatedCode || STATE.generatedCode === "Será gerado ao concluir") {
    STATE.generatedCode = await generateSequentialCode();

    if (els.generatedCode) {
      els.generatedCode.value = STATE.generatedCode;
    }
  }

  const participantPayload = buildParticipantPayload();
  const participantRef = await addDoc(collection(db, "participants"), participantPayload);

  const approvalRequestPayload = buildApprovalRequestPayload(
    participantRef.id,
    participantPayload
  );

  const approvalRef = await addDoc(collection(db, "approvalRequests"), approvalRequestPayload);

  return {
    participantId: participantRef.id,
    approvalRequestId: approvalRef.id,
    participantCode: participantPayload.participantCode
  };
}

/* =========================
   MODAL
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

function bindConsentButton() {
  const btn = document.getElementById("btnAcceptAllConsents");
  const note = document.getElementById("consentAcceptedNote");

  btn?.addEventListener("click", () => {
    STATE.consentAccepted = true;

    if (els.consentLgpd) els.consentLgpd.checked = true;
    if (els.consentWhatsapp) els.consentWhatsapp.checked = true;
    if (els.consentImage) els.consentImage.checked = true;

    btn.classList.add("is-accepted");
    btn.innerHTML = "✅ Autorizações confirmadas";
    btn.disabled = true;

    if (note) {
      note.classList.remove("hidden");
      note.style.display = "flex";
    }

    clearMessage();
  });
}

function bindProjectSourceSelect() {
  els.projectSource?.addEventListener("change", () => {
    if (!els.projectSourceOther) return;

    if (els.projectSource.value === "outro") {
      els.projectSourceOther.classList.remove("hidden");
      els.projectSourceOther.focus();
    } else {
      els.projectSourceOther.classList.add("hidden");
      els.projectSourceOther.value = "";
    }
  });
}

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
    button.addEventListener("click", async () => {
      await setLocalType(button.dataset.localType);
      clearMessage();
    });
  });
}

function bindRegisterTypeButtons() {
  const buttons = els.registerTypeGroup?.querySelectorAll("[data-register-type]") || [];

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.classList.contains("is-disabled")) return;

      await setRegisterType(button.dataset.registerType, true);
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
  els.phone?.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
  });

  els.cpf?.addEventListener("input", (event) => {
    event.target.value = formatCPF(event.target.value);
  });

  els.cep?.addEventListener("input", (event) => {
    event.target.value = formatCEP(event.target.value);
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
    els.mobileMenu?.classList.toggle("show");
    els.mobileMenu?.classList.toggle("open");
  });
}

function bindSuccessModal() {
  els.closeSuccessModal?.addEventListener("click", closeSuccessModal);

  els.successModal
    ?.querySelector(".success-modal-backdrop")
    ?.addEventListener("click", closeSuccessModal);
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
        error?.message || "Não foi possível enviar o cadastro. Verifique as regras do Firestore para participants e approvalRequests.",
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

async function initDefaults() {
  STATE.consentAccepted = false;

  if (els.consentLgpd) els.consentLgpd.checked = true;
  if (els.consentWhatsapp) els.consentWhatsapp.checked = true;
  if (els.consentImage) els.consentImage.checked = true;

  if (els.projectSourceOther) {
    els.projectSourceOther.classList.add("hidden");
  }

  updateGeoPreview();
  updateProgress();

  try {
    await setLocalType("casa");
  } catch (error) {
    console.warn("Não foi possível gerar o código inicial:", error);

    if (els.generatedCode) {
      els.generatedCode.value = "Será gerado ao concluir";
    }
  }
}

async function init() {
  try {
    assertRuntimeConfig();
    initStaticTexts();

    bindConsentButton();
    bindStepNavigation();
    bindLocalTypeButtons();
    bindRegisterTypeButtons();
    bindDifficultyButtons();
    bindProjectSourceSelect();
    bindFormatters();
    bindGeoEvents();
    bindMenu();
    bindSuccessModal();
    bindSubmit();

    await initDefaults();
  } catch (error) {
    console.error("Erro ao iniciar formulário:", error);
    showMessage(error?.message || "Não foi possível iniciar o formulário.", "error");
  }
}

init();