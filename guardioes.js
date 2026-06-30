import { db } from "./firebase-init-guardioes.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("guardianForm");
const sendBtn = document.getElementById("sendBtn");
const sendText = sendBtn?.querySelector(".send-text");
const formMessage = document.getElementById("formMessage");

const fields = {
  nome: document.getElementById("nome"),
  whatsapp: document.getElementById("whatsapp"),
  cep: document.getElementById("cep"),
  endereco: document.getElementById("endereco"),
  numero: document.getElementById("numero"),
  bairro: document.getElementById("bairro"),
  cidade: document.getElementById("cidade"),
  cooperativa: document.getElementById("cooperativa"),
  lgpdAceite: document.getElementById("lgpdAceite")
};

const cooperativaLabels = {
  "vila-pinto": "CRGR Vila Pinto",
  cooadesc: "CRGR COADESC",
  ccpa: "CCPA"
};

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function maskWhatsapp(value = "") {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskCep(value = "") {
  const digits = onlyDigits(value).slice(0, 8);

  if (digits.length <= 5) return digits;

  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function setLoading(isLoading) {
  if (!sendBtn) return;

  sendBtn.disabled = isLoading;

  if (sendText) {
    sendText.textContent = isLoading ? "Enviando..." : "Enviar";
  }
}

function showMessage(message, type = "info") {
  if (!formMessage) return;

  formMessage.textContent = message;
  formMessage.className = `form-message is-${type}`;
}

function clearMessage() {
  if (!formMessage) return;

  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function getFieldValue(field) {
  return field?.value?.trim() || "";
}

function validateForm() {
  const nome = getFieldValue(fields.nome);
  const whatsappDigits = onlyDigits(getFieldValue(fields.whatsapp));
  const cepDigits = onlyDigits(getFieldValue(fields.cep));
  const endereco = getFieldValue(fields.endereco);
  const numero = getFieldValue(fields.numero);
  const bairro = getFieldValue(fields.bairro);
  const cidade = getFieldValue(fields.cidade);
  const cooperativa = getFieldValue(fields.cooperativa);
  const lgpdAceite = Boolean(fields.lgpdAceite?.checked);

  if (!nome || nome.length < 3) return "Informe seu nome completo.";
  if (whatsappDigits.length < 10) return "Informe um WhatsApp válido com DDD.";
  if (cepDigits.length !== 8) return "Informe um CEP válido com 8 números.";
  if (!endereco) return "Informe o endereço.";
  if (!numero) return "Informe o número do endereço.";
  if (!bairro) return "Informe o bairro.";
  if (!cidade) return "Informe a cidade.";
  if (!cooperativa) return "Selecione a cooperativa.";
  if (!lgpdAceite) return "É necessário aceitar o uso dos dados para envio da solicitação.";

  return null;
}

async function buscarCep(cepValue) {
  const cepDigits = onlyDigits(cepValue);

  if (cepDigits.length !== 8) return;

  try {
    showMessage("Buscando endereço pelo CEP...", "info");

    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const data = await response.json();

    if (data?.erro) {
      showMessage("CEP não encontrado. Preencha o endereço manualmente.", "warning");
      return;
    }

    if (fields.endereco && data.logradouro) fields.endereco.value = data.logradouro;
    if (fields.bairro && data.bairro) fields.bairro.value = data.bairro;
    if (fields.cidade && data.localidade) {
      fields.cidade.value = `${data.localidade}${data.uf ? `/${data.uf}` : ""}`;
    }

    clearMessage();
    fields.numero?.focus();
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    showMessage("Não foi possível buscar o CEP agora. Preencha manualmente.", "warning");
  }
}

fields.whatsapp?.addEventListener("input", () => {
  fields.whatsapp.value = maskWhatsapp(fields.whatsapp.value);
});

fields.cep?.addEventListener("input", () => {
  fields.cep.value = maskCep(fields.cep.value);
});

fields.cep?.addEventListener("blur", () => {
  buscarCep(fields.cep.value);
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const validationError = validateForm();

  if (validationError) {
    showMessage(validationError, "error");
    return;
  }

  const nome = getFieldValue(fields.nome);
  const whatsapp = getFieldValue(fields.whatsapp);
  const whatsappDigits = onlyDigits(whatsapp);
  const cep = getFieldValue(fields.cep);
  const cepDigits = onlyDigits(cep);
  const endereco = getFieldValue(fields.endereco);
  const numero = getFieldValue(fields.numero);
  const bairro = getFieldValue(fields.bairro);
  const cidade = getFieldValue(fields.cidade);
  const cooperativa = getFieldValue(fields.cooperativa);
  const cooperativaLabel = cooperativaLabels[cooperativa] || cooperativa;

  const enderecoCompleto = `${endereco}, ${numero} - ${bairro}, ${cidade}, CEP ${cep}`;

  const dados = {
    nome,
    whatsapp,
    whatsappDigits,
    endereco,
    numero,
    bairro,
    cidade,
    cep,
    cepDigits,
    enderecoCompleto,
    cooperativa,
    cooperativaLabel,
    status: "solicitado",
    origem: "pagina-guardioes",
    lgpdAceite: true,
    lgpdAceiteTexto:
      "Autorizo o uso do meu nome completo, telefone e endereço para verificar se estou na área atendida pela cooperativa e para contato via WhatsApp.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    setLoading(true);
    showMessage("Enviando sua solicitação...", "info");

    const solicitacaoGeralRef = await addDoc(
      collection(db, "solicitacoes_guardioes"),
      dados
    );

    await addDoc(
      collection(db, "cooperativas", cooperativa, "solicitacoes"),
      {
        ...dados,
        solicitacaoGeralId: solicitacaoGeralRef.id
      }
    );

    form.reset();

    showMessage(
      "Solicitação enviada com sucesso! A cooperativa entrará em contato pelo WhatsApp.",
      "success"
    );
  } catch (error) {
    console.error("Erro ao enviar solicitação:", error);

    showMessage(
      "Erro ao enviar solicitação. Tente novamente em alguns instantes.",
      "error"
    );
  } finally {
    setLoading(false);
  }
});
const hero = document.getElementById("heroGuardioes");

function trocarHero() {
    if (window.innerWidth <= 768) {
        hero.src = "./img/Artboard 1.jpg";
    } else {
        hero.src = "./img/guardioes-1.png";
    }
}

trocarHero();
window.addEventListener("resize", trocarHero);