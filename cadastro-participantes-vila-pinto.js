import { auth, db } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

let currentUser = null;
let currentProfile = null;
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
async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("Usuário não encontrado.");
  return snap.data();
}

function validateProfile(profile) {
  if (!profile) throw new Error("Perfil do usuário não carregado.");

  if (profile.role !== "cooperativa" && profile.role !== "coorporativa") {
    throw new Error("Acesso permitido somente para usuários cooperativa.");
  }

  if (profile.status !== "active") {
    throw new Error("O usuário precisa estar com status ativo.");
  }

  if (!profile.territoryId || !profile.territoryLabel) {
    throw new Error("O usuário precisa ter território vinculado.");
  }

  if (!profile.permissions || profile.permissions.coletas !== true) {
    throw new Error("O usuário precisa ter permissão de cadastro/coletas ativa.");
  }
}

function fillHeader(profile) {
  const userName =
    profile.displayName ||
    profile.dispalyName ||
    profile.name ||
    "Usuário";

  if (els.territoryLabelView) {
    els.territoryLabelView.textContent = profile.territoryLabel || "Território";
  }

  if (els.userNameView) {
    els.userNameView.textContent = userName;
  }
}

function getValue(el) {
  return el ? String(el.value || "").trim() : "";
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
  return String(value || "").replace(/\D/g, "");
}

function validateStep(step) {
  if (step === 1) {
    if (!els.consentLgpd?.checked || !els.consentWhatsapp?.checked || !els.consentImage?.checked) {
      throw new Error("Para avançar, é necessário marcar todos os termos de autorização.");
    }
  }

  if (step === 2) {
    if (!getValue(els.fullName)) throw new Error("Informe o nome completo.");

    const phone = normalizePhone(getValue(els.phone));
    if (!phone) throw new Error("Informe o telefone / WhatsApp.");
    if (phone.length < 10) throw new Error("Informe um telefone válido com DDD.");

    if (!getValue(els.generatedCode)) throw new Error("O código do cadastro não foi gerado.");
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

  if (step === 4) {
    // etapa final sem campos obrigatórios extras além dos anteriores
  }
}

async function fetchCep() {
  const cep = getValue(els.cep).replace(/\D/g, "");

  if (!cep || cep.length !== 8) {
    throw new Error("Informe um CEP válido com 8 números.");
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data = await response.json();

  if (data.erro) {
    throw new Error("CEP não encontrado.");
  }

  if (els.street) els.street.value = data.logradouro || "";
  if (els.neighborhood) els.neighborhood.value = data.bairro || "";
  if (els.city) els.city.value = data.localidade || "";
  if (els.state) els.state.value = data.uf || "";

  updateGeoPreview();
}

function updateGeoPreview() {
  if (!els.geoPreview) return;

  const cep = getValue(els.cep);
  const number = getValue(els.number);
  const street = getValue(els.street);

  if (cep && number && street) {
    els.geoPreview.textContent = `${street}, ${number} • CEP ${cep}`;
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
  const userName =
    currentProfile.displayName ||
    currentProfile.dispalyName ||
    currentProfile.name ||
    "Usuário";

  return {
    territoryId: currentProfile.territoryId,
    territoryLabel: currentProfile.territoryLabel || "",

    name: getValue(els.fullName),
    participantCode: getValue(els.generatedCode),
    participantType: selectedRegisterType,
    localType: selectedLocalType,

    phone: normalizePhone(getValue(els.phone)),
    email: getValue(els.email),
    cpf: getValue(els.cpf),

    consent: {
      lgpd: !!els.consentLgpd?.checked,
      whatsapp: !!els.consentWhatsapp?.checked,
      image: !!els.consentImage?.checked
    },

    address: {
      cep: getValue(els.cep),
      number: getValue(els.number),
      street: getValue(els.street),
      neighborhood: getValue(els.neighborhood),
      city: getValue(els.city),
      state: getValue(els.state),
      referencePoint: getValue(els.referencePoint)
    },

    difficulty: {
      hasDifficulty: selectedDifficulty === "sim",
      details: getValue(els.difficultyDetail)
    },

    projectSource: getValue(els.projectSource),

    createdBy: currentUser.uid,
    createdByName: userName,
    createdAt: serverTimestamp(),
    createdAtISO: new Date().toISOString()
  };
}

async function saveParticipant(payload) {
  return addDoc(collection(db, "participants"), payload);
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

function bindEvents() {
  bindNavigation();

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

  [els.cep, els.number, els.street].forEach((input) => {
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

      if (!currentUser || !currentProfile) {
        throw new Error("Usuário não carregado.");
      }

      validateProfile(currentProfile);

      // valida todas as etapas antes de salvar
      validateStep(1);
      validateStep(2);
      validateStep(3);
      validateStep(4);

      const payload = buildPayload();

      if (els.btnSubmitParticipant) {
        els.btnSubmitParticipant.disabled = true;
        els.btnSubmitParticipant.textContent = "Salvando...";
      }

      await saveParticipant(payload);

      hideMessage();
      openSuccessModal();
    } catch (error) {
      console.error("Erro ao salvar participante:", error);
      showMessage(error.message || "Não foi possível salvar o participante.", "error");
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
  bindEvents();
  generateParticipantCode();
  updateProgress();
  updateGeoPreview();

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user) {
        window.location.href = "../html/login.html";
        return;
      }

      currentUser = user;
      currentProfile = await getUserProfile(user.uid);

      validateProfile(currentProfile);
      fillHeader(currentProfile);
    } catch (error) {
      console.error("Erro ao carregar cadastro de participantes:", error);
      showMessage(error.message || "Não foi possível carregar a página.", "error");
    }
  });
}

boot();