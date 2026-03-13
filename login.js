import { initializeApp } from "firebase/app";

import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  signOut
} from "firebase/auth";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";


// =============================
// Firebase
// =============================
const firebaseConfig = {
apiKey: "AIzaSyBs9qA9kWiXFEiXFCNLEKAn0Xo362RulJM",
authDomain: "hub-resliencia-em-rede.firebaseapp.com",
projectId: "hub-resliencia-em-rede",
storageBucket: "hub-resliencia-em-rede.firebasestorage.app",
messagingSenderId: "138042062207",
appId: "1:138042062207:web:ee1c94acaa6b5f9ac6564a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// =============================
// Rotas
// =============================
const ROUTES = {
  governanca: "./governanca.html",
  cooperativa: "./cooperativa.html",
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
  document.addEventListener("pointermove", (e) => {
    document.documentElement.style.setProperty("--mx", e.clientX);
    document.documentElement.style.setProperty("--my", e.clientY);
    glow.style.opacity = 1;
  });
}


// =============================
// Reveal animation
// =============================
const revealEls = document.querySelectorAll("[data-reveal]");

if (revealEls.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
      }
    });
  }, { threshold: .12 });

  revealEls.forEach(el => io.observe(el));
}


// =============================
// Helpers UI
// =============================
function showMsg(el, type, text) {
  if (!el) return;

  el.classList.remove("is-error", "is-success");

  if (type === "error") el.classList.add("is-error");
  else el.classList.add("is-success");

  el.textContent = text;
}

function hideMsg(el) {
  if (!el) return;
  el.classList.remove("is-error", "is-success");
  el.textContent = "";
}

function setLoading(which, state) {

  if (which === "login") {

    if (loginBtn) {
      loginBtn.disabled = state;
      loginBtn.textContent = state ? "Entrando..." : "Entrar";
    }

    loadingbar?.classList.toggle("show", state);

  } else {

    if (signupBtn) {
      signupBtn.disabled = state;
      signupBtn.textContent = state ? "Criando..." : "Criar conta";
    }

    loadingbar2?.classList.toggle("show", state);
  }
}

function niceError(err) {
  return err?.code || err?.message || "Erro inesperado";
}


// =============================
// Tabs
// =============================
function goTab(mode) {

  const isLogin = mode === "login";

  tabLogin?.classList.toggle("active", isLogin);
  tabSignup?.classList.toggle("active", !isLogin);

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
// Firestore perfil
// =============================
function normalizeRole(role) {
  const r = (role || "").toLowerCase();

  if (r === "governança") return "governanca";
  if (r === "coorporativa") return "cooperativa";

  return r;
}

function routeByRole(profile) {

  const role = normalizeRole(profile?.role);

  if (role === "admin" || role === "governanca" || role === "gestor")
    return window.location.href = ROUTES.governanca;

  if (role === "cooperativa")
    return window.location.href = ROUTES.cooperativa;

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

  const profile = {
    role: payload.role || "cooperativa",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    email: user.email,
    name: payload.name || null,
    territoryLabel: payload.territoryLabel || null,
    crgrLabel: payload.crgrLabel || null
  };

  await setDoc(ref, profile, { merge: true });

  return profile;
}


// =============================
// LOGIN
// =============================
loginForm?.addEventListener("submit", async (e) => {

  e.preventDefault();

  hideMsg(msgBox);
  setLoading("login", true);

  try {

    await setPersistence(
      auth,
      rememberMe?.checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    const cred = await signInWithEmailAndPassword(
      auth,
      loginEmail.value,
      loginPassword.value
    );

    let profile = await getUserProfile(cred.user.uid);

    if (!profile) {
      await ensureInitialProfileActive(cred.user);
      profile = await getUserProfile(cred.user.uid);
    }

    routeByRole(profile);

  } catch (err) {

    console.error(err);

    let text = "Erro no login.";

    if (err.code === "auth/invalid-credential")
      text = "E-mail ou senha inválidos.";

    if (err.code === "auth/user-not-found")
      text = "Usuário não encontrado.";

    if (err.code === "auth/wrong-password")
      text = "Senha incorreta.";

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

  if (signupPassword.value.length < 6)
    return showMsg(msgBox2, "error", "Senha muito curta.");

  if (signupPassword.value !== signupPassword2.value)
    return showMsg(msgBox2, "error", "Senhas diferentes.");

  setLoading("signup", true);

  try {

    const cred = await createUserWithEmailAndPassword(
      auth,
      signupEmail.value,
      signupPassword.value
    );

    await updateProfile(cred.user, {
      displayName: signupName.value
    });

    await ensureInitialProfileActive(cred.user, {
      name: signupName.value,
      role: signupRole.value,
      territoryLabel: signupTerritory.value,
      crgrLabel: signupCrgr.value
    });

    window.location.href = ROUTES.home;

  } catch (err) {

    console.error(err);

    let text = "Erro ao criar conta.";

    if (err.code === "auth/email-already-in-use")
      text = "Este e-mail já possui cadastro.";

    if (err.code === "auth/weak-password")
      text = "Senha muito fraca.";

    showMsg(msgBox2, "error", text);

  } finally {

    setLoading("signup", false);
  }

});


// =============================
// RESET PASSWORD
// =============================
resetPwdLink?.addEventListener("click", async (e) => {

  e.preventDefault();

  const email = loginEmail.value;

  if (!email)
    return showMsg(msgBox, "error", "Digite seu e-mail.");

  try {

    await sendPasswordResetEmail(auth, email);

    showMsg(msgBox, "success", "Link de recuperação enviado.");

  } catch (err) {

    showMsg(msgBox, "error", niceError(err));

  }

});


// =============================
goTab("login");