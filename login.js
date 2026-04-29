import { auth, db } from "./firebase-init.js";

import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/* =============================
   ROTAS
============================= */
const PAGES = {
  governanca: "./governanca.html",
  login: "./login.html",
  cooperativas: {
    "vila-pinto": "./cooperativa-vila-pinto.html",
    "crgr-vila-pinto": "./cooperativa-vila-pinto.html",
    "crgr_vila_pinto": "./cooperativa-vila-pinto.html",

    "cooadesc": "./cooperativa-cooadesc.html",
    "coadesc": "./cooperativa-cooadesc.html",
    "crgr-cooadesc": "./cooperativa-cooadesc.html",
    "crgr_cooadesc": "./cooperativa-cooadesc.html",
    "crgr-coadesc": "./cooperativa-cooadesc.html",
    "crgr_coadesc": "./cooperativa-cooadesc.html",

    "padre-cacique": "./cooperativa-padre-cacique.html",
    "crgr-padre-cacique": "./cooperativa-padre-cacique.html",
    "crgr_padre_cacique": "./cooperativa-padre-cacique.html"
  }
};

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

function normalizeTerritory(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-")
    .trim();
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };
}

function isUserActive(profile) {
  return !!profile && (
    profile.status === "active" ||
    profile.status === "aprovado" ||
    profile.active === true
  );
}

function getUserRole(profile) {
  return String(
    profile?.role ||
    profile?.perfil ||
    profile?.profile ||
    profile?.tipo ||
    profile?.userType ||
    ""
  ).toLowerCase();
}

function getRedirectPage(profile) {
  if (!profile) return PAGES.login;

  const role = getUserRole(profile);

  if (
    role === "governanca" ||
    role === "gestor" ||
    role === "superadmin" ||
    role === "admin_master"
  ) {
    return PAGES.governanca;
  }

  if (
    role === "admin" ||
    role === "cooperativa" ||
    role === "operador" ||
    role === "usuario"
  ) {
    const territoryId = normalizeTerritory(
      profile.territoryId ||
      profile.cooperativaId ||
      profile.cooperativeId
    );

    return PAGES.cooperativas[territoryId] || PAGES.login;
  }

  return PAGES.login;
}

function redirectByProfile(profile) {
  const target = getRedirectPage(profile);

  if (!target || target === PAGES.login) {
    showMsg(
      msgBox,
      "error",
      "Usuário autenticado, mas sem página de cooperativa configurada."
    );
    return;
  }

  window.location.href = target;
}

function describeAccess(profile) {
  if (!profile) return "sem acesso";

  const role = getUserRole(profile);
  const territory =
    profile.territoryLabel ||
    profile.cooperativaNome ||
    profile.cooperativeName ||
    profile.territoryId ||
    "Sem território";

  if (
    role === "governanca" ||
    role === "gestor" ||
    role === "superadmin" ||
    role === "admin_master"
  ) {
    return "Governança • acesso global";
  }

  if (role === "admin") {
    return `Administrador local • ${territory}`;
  }

  if (role === "cooperativa") {
    return `Usuário da cooperativa • ${territory}`;
  }

  if (role === "operador") {
    return `Operador • ${territory}`;
  }

  return `${role || "Usuário"} • ${territory}`;
}

async function renderLoggedUserActions(user, profile) {
  showMsg(
    msgBox,
    "success",
    `Você já está conectado como ${normalizeEmail(user.email)}. Perfil: ${describeAccess(profile)}.`
  );

  if (!authedActions) return;

  authedActions.innerHTML = "";
  authedActions.style.display = "grid";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-primary btn-block";
  continueBtn.textContent = "Continuar para plataforma";
  continueBtn.addEventListener("click", () => {
    redirectByProfile(profile);
  });

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
}

async function renderBlockedUserActions(user) {
  showMsg(
    msgBox,
    "error",
    `Sua conta (${normalizeEmail(user.email)}) foi autenticada, mas não possui acesso liberado.`
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
}

/* =============================
   JÁ LOGADO
============================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (authedActions) authedActions.style.display = "none";
    return;
  }

  hideMsg(msgBox);

  try {
    const profile = await getUserProfile(user.uid);

    if (!profile || !isUserActive(profile)) {
      await renderBlockedUserActions(user);
      return;
    }

    await renderLoggedUserActions(user, profile);
  } catch (error) {
    console.error("AUTH STATE ERROR =>", error);

    showMsg(
      msgBox,
      "error",
      "Erro ao verificar permissões do usuário no Firestore."
    );

    if (!authedActions) return;

    authedActions.innerHTML = "";
    authedActions.style.display = "grid";

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-secondary btn-block";
    logoutBtn.textContent = "Sair desta conta";
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      window.location.reload();
    });

    authedActions.appendChild(logoutBtn);
  }
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

    const profile = await getUserProfile(cred.user.uid);

    if (!profile || !isUserActive(profile)) {
      await signOut(auth);

      showMsg(
        msgBox,
        "error",
        "Login realizado, mas este usuário não possui permissão para acessar a plataforma."
      );

      return;
    }

    redirectByProfile(profile);
  } catch (err) {
    console.error("LOGIN ERROR =>", err);

    const code = err?.code || "";
    let text = "Não foi possível entrar. Verifique seus dados.";

    if (code.includes("auth/invalid-credential")) {
      text = "E-mail ou senha inválidos.";
    } else if (code.includes("auth/user-not-found")) {
      text = "Usuário não encontrado.";
    } else if (code.includes("auth/wrong-password")) {
      text = "Senha incorreta.";
    } else if (code.includes("auth/too-many-requests")) {
      text = "Muitas tentativas. Tente novamente mais tarde.";
    } else if (code.includes("auth/operation-not-allowed")) {
      text = "Ative Email/Senha em Authentication > Sign-in method.";
    } else if (code.includes("auth/network-request-failed")) {
      text = "Falha de rede. Verifique sua internet.";
    } else if (code.includes("auth/invalid-api-key")) {
      text = "API Key inválida no firebaseConfig.";
    } else if (code.includes("auth/invalid-email")) {
      text = "E-mail inválido.";
    } else if (code.includes("permission-denied")) {
      text = "Sem permissão para ler o perfil do usuário no Firestore.";
    } else {
      text = "Erro no login: " + niceError(err);
    }

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

    if (code.includes("auth/user-not-found")) {
      text = "Não encontramos usuário com esse e-mail.";
    } else if (code.includes("auth/invalid-email")) {
      text = "E-mail inválido.";
    }

    showMsg(msgBox, "error", text);
  }
});