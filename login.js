import { auth, db } from "./firebase-init.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
// =============================
// Rotas
// =============================
const ROUTES = {
  governanca: "./governanca.html",
  cooperativa: "./cooperativas.html",
  home: "./home.html"
};

// =============================
// UI refs
// =============================
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const cardTitle = document.getElementById("cardTitle");
const cardSubtitle = document.getElementById("cardSubtitle");
const goSignupBtn = document.getElementById("goSignupBtn");
const goLoginBtn = document.getElementById("goLoginBtn");

const msgBox = document.getElementById("msgBox");
const msgBox2 = document.getElementById("msgBox2");
const loadingbar = document.getElementById("loadingbar");
const loadingbar2 = document.getElementById("loadingbar2");

const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");

const rememberMe = document.getElementById("rememberMe");
const resetPwdLink = document.getElementById("resetPwdLink");

const authedActions = document.getElementById("authedActions");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupRole = document.getElementById("signupRole");
const signupTerritory = document.getElementById("signupTerritory");
const signupCrgr = document.getElementById("signupCrgr");
const signupPassword = document.getElementById("signupPassword");
const signupPassword2 = document.getElementById("signupPassword2");

// =============================
// Cursor glow
// =============================
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

// =============================
// Reveal
// =============================
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

// =============================
// Helpers UI
// =============================
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

function setLoading(which, isLoading) {
  if (which === "login") {
    if (loginBtn) {
      loginBtn.disabled = isLoading;
      loginBtn.style.opacity = isLoading ? "0.86" : "1";
      loginBtn.textContent = isLoading ? "Entrando..." : "Entrar";
    }
    loadingbar?.classList.toggle("show", isLoading);
  } else {
    if (signupBtn) {
      signupBtn.disabled = isLoading;
      signupBtn.style.opacity = isLoading ? "0.86" : "1";
      signupBtn.textContent = isLoading ? "Criando..." : "Criar conta";
    }
    loadingbar2?.classList.toggle("show", isLoading);
  }
}

function niceError(err) {
  const code = err?.code || "";
  const msg = err?.message || "";
  return `${code}${msg ? " • " + msg : ""}`.trim();
}

function goTab(mode) {
  const isLogin = mode === "login";

  tabLogin?.classList.toggle("active", isLogin);
  tabSignup?.classList.toggle("active", !isLogin);
  tabLogin?.setAttribute("aria-selected", String(isLogin));
  tabSignup?.setAttribute("aria-selected", String(!isLogin));

  if (loginForm) loginForm.style.display = isLogin ? "" : "none";
  if (signupForm) signupForm.style.display = isLogin ? "none" : "";

  if (cardTitle) cardTitle.textContent = isLogin ? "Entrar" : "Criar conta";
  if (cardSubtitle) {
    cardSubtitle.textContent = isLogin
      ? "Acesse sua conta para ver seu território, CRGR e atualizações."
      : "Crie sua conta para acessar o Hub.";
  }

  hideMsg(msgBox);
  hideMsg(msgBox2);
}

tabLogin?.addEventListener("click", () => goTab("login"));
tabSignup?.addEventListener("click", () => goTab("signup"));
goSignupBtn?.addEventListener("click", () => goTab("signup"));
goLoginBtn?.addEventListener("click", () => goTab("login"));

// =============================
// Firestore: Perfil do usuário
// =============================
function normalizeRole(role) {
  const r = (role || "").toLowerCase().trim();
  if (r === "coorporativa") return "cooperativa";
  if (r === "governança") return "governanca";
  return r;
}

function routeByRole(profile) {
  const role = normalizeRole(profile?.role);
  const rolesMap = profile?.roles || {};

  const isGov =
    role === "admin" ||
    role === "governanca" ||
    role === "gestor" ||
    rolesMap.admin === true ||
    rolesMap.gestor === true;

  const isCoop = role === "cooperativa";

  if (isGov) {
    window.location.href = ROUTES.governanca;
    return;
  }
  if (isCoop) {
    window.location.href = ROUTES.cooperativa;
    return;
  }
  window.location.href = ROUTES.home;
}

async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

async function ensureInitialProfileActive(user, payload = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const requestedRole = normalizeRole(payload.role || "cooperativa") || "cooperativa";

  const minimal = {
    role: requestedRole === "cooperativa" ? "cooperativa" : "user",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ref, minimal, { merge: true });

  try {
    await setDoc(
      ref,
      {
        email: user.email ?? null,
        displayName: user.displayName || payload.name || null,
        name: user.displayName || payload.name || null,
        territoryLabel: payload.territoryLabel || null,
        crgrLabel: payload.crgrLabel || null,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Não consegui gravar campos extras no perfil (rules).", e?.code || e);
  }

  return minimal;
}

// =============================
// Estado: já logado?
// =============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (authedActions) authedActions.style.display = "none";
    return;
  }

  goTab("login");

  hideMsg(msgBox);
  showMsg(msgBox, "success", `Você já está conectado como ${user.email}.`);

  if (!authedActions) return;
  authedActions.innerHTML = "";
  authedActions.style.display = "grid";

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-primary btn-block";
  continueBtn.textContent = "Continuar";
  continueBtn.addEventListener("click", async () => {
    try {
      let profile = await getUserProfile(user.uid);
      if (!profile) {
        await ensureInitialProfileActive(user, { role: "cooperativa" });
        profile = await getUserProfile(user.uid);
      }
      routeByRole(profile || { role: "cooperativa" });
    } catch (e) {
      console.error(e);
      showMsg(msgBox, "error", "Não consegui carregar seu perfil. Tente novamente.");
    }
  });

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.className = "btn btn-secondary btn-block";
  logoutBtn.textContent = "Sair desta conta";
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (e) {
      showMsg(msgBox, "error", "Não consegui sair. Tente novamente.");
    }
  });

  authedActions.appendChild(continueBtn);
  authedActions.appendChild(logoutBtn);
});

// =============================
// LOGIN
// =============================
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(msgBox);
  setLoading("login", true);

  const email = (loginEmail?.value || "").trim();
  const password = loginPassword?.value || "";

  try {
    await setPersistence(
      auth,
      rememberMe?.checked ? browserLocalPersistence : browserSessionPersistence
    );

    const cred = await signInWithEmailAndPassword(auth, email, password);

    let profile = await getUserProfile(cred.user.uid);
    if (!profile) {
      await ensureInitialProfileActive(cred.user, { role: "cooperativa" });
      profile = await getUserProfile(cred.user.uid);
    }

    const status = (profile?.status || "active").toLowerCase();
    if (status === "blocked") {
      await signOut(auth);
      showMsg(msgBox, "error", "Seu acesso está bloqueado. Fale com a governança.");
      return;
    }

    routeByRole(profile || { role: "cooperativa" });
  } catch (err) {
    console.error("LOGIN ERROR =>", err);

    const code = err?.code || "";
    let text = "Não foi possível entrar. Verifique seus dados.";

    if (code.includes("auth/invalid-credential")) text = "E-mail ou senha inválidos.";
    else if (code.includes("auth/user-not-found")) text = "Usuário não encontrado.";
    else if (code.includes("auth/wrong-password")) text = "Senha incorreta.";
    else if (code.includes("auth/too-many-requests")) text = "Muitas tentativas. Tente novamente mais tarde.";
    else if (code.includes("auth/operation-not-allowed")) text = "Ative Email/Senha em Authentication > Sign-in method.";
    else if (code.includes("auth/network-request-failed")) text = "Falha de rede. Verifique internet.";
    else if (code.includes("auth/invalid-api-key")) text = "API Key inválida no firebaseConfig.";
    else if (code.includes("auth/invalid-email")) text = "E-mail inválido.";
    else text = "Erro no login: " + niceError(err);

    showMsg(msgBox, "error", text);
  } finally {
    setLoading("login", false);
  }
});

// =============================
// SIGNUP
// =============================
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(msgBox2);

  const name = (signupName?.value || "").trim();
  const email = (signupEmail?.value || "").trim();
  const role = normalizeRole(signupRole?.value || "cooperativa") || "cooperativa";
  const territoryLabel = (signupTerritory?.value || "").trim() || null;
  const crgrLabel = (signupCrgr?.value || "").trim() || null;
  const pass1 = signupPassword?.value || "";
  const pass2 = signupPassword2?.value || "";

  if (pass1.length < 6) return showMsg(msgBox2, "error", "Senha fraca. Use pelo menos 6 caracteres.");
  if (pass1 !== pass2) return showMsg(msgBox2, "error", "As senhas não conferem.");

  setLoading("signup", true);

  try {
    await setPersistence(auth, browserLocalPersistence);

    const cred = await createUserWithEmailAndPassword(auth, email, pass1);

    try { await updateProfile(cred.user, { displayName: name }); } catch {}

    await ensureInitialProfileActive(cred.user, {
      name,
      role,
      territoryLabel,
      crgrLabel
    });

    if (role === "cooperativa") window.location.href = ROUTES.cooperativa;
    else window.location.href = ROUTES.home;
  } catch (err) {
    console.error("SIGNUP ERROR =>", err);

    const code = err?.code || "";
    let text = "Não foi possível criar a conta.";

    if (code.includes("auth/email-already-in-use")) text = "Este e-mail já está em uso. Use a aba Entrar.";
    else if (code.includes("auth/weak-password")) text = "Senha fraca. Use pelo menos 6 caracteres.";
    else if (code.includes("auth/invalid-email")) text = "E-mail inválido.";
    else if (code.includes("auth/operation-not-allowed")) text = "Ative Email/Senha em Authentication > Sign-in method.";
    else text = "Erro no cadastro: " + niceError(err);

    showMsg(msgBox2, "error", text);
  } finally {
    setLoading("signup", false);
  }
});

// =============================
// RESET SENHA
// =============================
resetPwdLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  hideMsg(msgBox);

  const email = (loginEmail?.value || "").trim();
  if (!email) return showMsg(msgBox, "error", "Digite seu e-mail para recuperar a senha.");

  try {
    await sendPasswordResetEmail(auth, email);
    showMsg(msgBox, "success", "Enviamos um link de recuperação para seu e-mail.");
  } catch (err) {
    console.error("RESET ERROR =>", err);
    const code = err?.code || "";
    let text = "Não foi possível enviar o e-mail de recuperação.";
    if (code.includes("auth/user-not-found")) text = "Não encontramos usuário com esse e-mail.";
    if (code.includes("auth/invalid-email")) text = "E-mail inválido.";
    showMsg(msgBox, "error", text);
  }
});

goTab("login");