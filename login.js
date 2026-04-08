import { auth } from "./firebase-init.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* =============================
   USUÁRIOS AUTORIZADOS
============================= */
const ACCESS_RULES = {
  "governanca@teste.com": {
    cooperativaId: null,
    cooperativaNome: "Todas",
    perfil: "governanca",
    scope: "global"
  },

  "admin.vp@teste.com": {
    cooperativaId: "vila-pinto",
    cooperativaNome: "Vila Pinto",
    perfil: "admin",
    scope: "cooperativa"
  },
  "user.vp@teste.com": {
    cooperativaId: "vila-pinto",
    cooperativaNome: "Vila Pinto",
    perfil: "user",
    scope: "cooperativa"
  },

  "admin.cooa@teste.com": {
    cooperativaId: "cooadesc",
    cooperativaNome: "Cooadesc",
    perfil: "admin",
    scope: "cooperativa"
  },
  "user.cooa@teste.com": {
    cooperativaId: "cooadesc",
    cooperativaNome: "Cooadesc",
    perfil: "user",
    scope: "cooperativa"
  },

  "admin.x@teste.com": {
    cooperativaId: "ultima-cooperativa",
    cooperativaNome: "Última Cooperativa",
    perfil: "admin",
    scope: "cooperativa"
  },
  "user.x@teste.com": {
    cooperativaId: "ultima-cooperativa",
    cooperativaNome: "Última Cooperativa",
    perfil: "user",
    scope: "cooperativa"
  }
};

const COOPERATIVAS_PAGE = "./cooperativas.html";
const GOVERNANCA_PAGE = "./governanca.html";

/* =============================
   UI REFS
============================= */
const msgBox = document.getElementById("msgBox");
const loadingbar = document.getElementById("loadingbar");
const loginBtn = document.getElementById("loginBtn");
const rememberMe = document.getElementById("rememberMe");
const resetPwdLink = document.getElementById("resetPwdLink");
const authedActions = document.getElementById("authedActions");
const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

/* =============================
   CURSOR GLOW
============================= */
const glow = document.getElementById("cursorGlow");
if (glow) {
  window.addEventListener(
    "pointermove",
    (e) => {
      document.documentElement.style.setProperty("--mx", e.clientX);
      document.documentElement.style.setProperty("--my", e.clientY);
      glow.style.opacity = "1";
    },
    { passive: true }
  );

  window.addEventListener("pointerleave", () => {
    glow.style.opacity = "0";
  });
}

/* =============================
   REVEAL
============================= */
const revealEls = document.querySelectorAll("[data-reveal]");
if (revealEls.length && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add("in"));
}

/* =============================
   HELPERS
============================= */
function showMsg(el, type, text) {
  if (!el) return;
  el.classList.remove("is-error", "is-success");
  el.classList.add(type === "error" ? "is-error" : "is-success");
  el.textContent = text;
}

function hideMsg(el) {
  if (!el) return;
  el.classList.remove("is-error", "is-success");
  el.textContent = "";
}

function setLoading(isLoading) {
  if (loginBtn) {
    loginBtn.disabled = isLoading;
    loginBtn.style.opacity = isLoading ? "0.86" : "1";
    loginBtn.textContent = isLoading ? "Entrando..." : "Entrar";
  }
  loadingbar?.classList.toggle("show", isLoading);
}

function niceError(err) {
  const code = err?.code || "";
  const msg = err?.message || "";
  return `${code}${msg ? " • " + msg : ""}`.trim();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getAccessData(email) {
  return ACCESS_RULES[normalizeEmail(email)] || null;
}

function getRedirectPage(access) {
  if (!access) return "./login.html";
  if (access.perfil === "governanca" || access.scope === "global") {
    return GOVERNANCA_PAGE;
  }
  return COOPERATIVAS_PAGE;
}

function redirectByAccess(access) {
  window.location.href = getRedirectPage(access);
}

function describeAccess(access) {
  if (!access) return "sem acesso";
  if (access.perfil === "governanca") {
    return "Governança • acesso a todas as cooperativas";
  }
  if (access.perfil === "admin") {
    return `Administrador local • acesso total da cooperativa ${access.cooperativaNome}`;
  }
  return `Usuário local • acesso à cooperativa ${access.cooperativaNome}`;
}

/* =============================
   JÁ LOGADO
============================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (authedActions) authedActions.style.display = "none";
    return;
  }

  const email = normalizeEmail(user.email);
  const access = getAccessData(email);

  hideMsg(msgBox);

  if (!access) {
    showMsg(
      msgBox,
      "error",
      `Sua conta (${email}) foi autenticada, mas não possui acesso liberado.`
    );

    if (!authedActions) return;
    authedActions.innerHTML = "";
    authedActions.style.display = "grid";

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-secondary btn-block";
    logoutBtn.textContent = "Sair desta conta";
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.reload();
      } catch {
        showMsg(msgBox, "error", "Não consegui sair. Tente novamente.");
      }
    });

    authedActions.appendChild(logoutBtn);
    return;
  }

  showMsg(
    msgBox,
    "success",
    `Você já está conectado como ${email}. Perfil: ${describeAccess(access)}.`
  );

  if (!authedActions) return;
  authedActions.innerHTML = "";
  authedActions.style.display = "grid";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-primary btn-block";
  continueBtn.textContent =
    access.perfil === "governanca"
      ? "Ir para Governança"
      : "Ir para Cooperativas";

  continueBtn.addEventListener("click", () => redirectByAccess(access));

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn btn-secondary btn-block";
  logoutBtn.textContent = "Sair desta conta";
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch {
      showMsg(msgBox, "error", "Não consegui sair. Tente novamente.");
    }
  });

  authedActions.appendChild(continueBtn);
  authedActions.appendChild(logoutBtn);
});

/* =============================
   LOGIN
============================= */
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(msgBox);
  setLoading(true);

  const email = normalizeEmail(loginEmail?.value);
  const password = loginPassword?.value || "";

  try {
    await setPersistence(
      auth,
      rememberMe?.checked ? browserLocalPersistence : browserSessionPersistence
    );

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const authEmail = normalizeEmail(cred.user.email);
    const access = getAccessData(authEmail);

    if (!access) {
      await signOut(auth);
      showMsg(
        msgBox,
        "error",
        "Login realizado, mas este usuário não possui permissão para acessar a plataforma."
      );
      return;
    }

    redirectByAccess(access);
  } catch (err) {
    console.error("LOGIN ERROR =>", err);

    const code = err?.code || "";
    let text = "Não foi possível entrar. Verifique seus dados.";

    if (code.includes("auth/invalid-credential")) text = "E-mail ou senha inválidos.";
    else if (code.includes("auth/user-not-found")) text = "Usuário não encontrado.";
    else if (code.includes("auth/wrong-password")) text = "Senha incorreta.";
    else if (code.includes("auth/too-many-requests")) text = "Muitas tentativas. Tente novamente mais tarde.";
    else if (code.includes("auth/operation-not-allowed")) text = "Ative Email/Senha em Authentication > Sign-in method.";
    else if (code.includes("auth/network-request-failed")) text = "Falha de rede. Verifique sua internet.";
    else if (code.includes("auth/invalid-api-key")) text = "API Key inválida no firebaseConfig.";
    else if (code.includes("auth/invalid-email")) text = "E-mail inválido.";
    else text = "Erro no login: " + niceError(err);

    showMsg(msgBox, "error", text);
  } finally {
    setLoading(false);
  }
});

/* =============================
   RESET SENHA
============================= */
resetPwdLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  hideMsg(msgBox);

  const email = normalizeEmail(loginEmail?.value);
  if (!email) {
    showMsg(msgBox, "error", "Digite seu e-mail para recuperar a senha.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMsg(msgBox, "success", "Enviamos um link de recuperação para seu e-mail.");
  } catch (err) {
    console.error("RESET ERROR =>", err);

    const code = err?.code || "";
    let text = "Não foi possível enviar o e-mail de recuperação.";

    if (code.includes("auth/user-not-found")) text = "Não encontramos usuário com esse e-mail.";
    else if (code.includes("auth/invalid-email")) text = "E-mail inválido.";

    showMsg(msgBox, "error", text);
  }
});