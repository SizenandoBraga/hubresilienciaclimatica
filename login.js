import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let auth = null;
let db = null;
let selectedCoop = null;

const COOPS = {
  "vila-pinto": {
    label: "Vila Pinto",
    init: () => import("./firebase-init-vp.js"),
    redirect: "./cooperativa-vila-pinto.html"
  },

  "cooadesc": {
    label: "COOADESC",
    init: () => import("./firebase-init-coadesc.js"),
    redirect: "./cooperativa-cooadesc.html"
  },

  "padre-cacique": {
    label: "Padre Cacique",
    init: () => import("./firebase-init-pc.js"),
    redirect: "./cooperativa-padre-cacique.html"
  },

"governanca": {
  label: "Governança",
  init: () => import("./firebase-init-vp.js"),
  redirect: "./governanca.html"
}
};

const coopSelector = document.getElementById("coopSelector");
const loginCard = document.getElementById("loginCard");
const backToCoops = document.getElementById("backToCoops");

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const rememberMe = document.getElementById("rememberMe");
const msgBox = document.getElementById("msgBox");
const loadingbar = document.getElementById("loadingbar");
const resetPwdLink = document.getElementById("resetPwdLink");
const cardTitle = document.getElementById("cardTitle");
const cardSubtitle = document.getElementById("cardSubtitle");

function showMsg(type, text) {
  if (!msgBox) return;

  msgBox.classList.remove("is-error", "is-success");
  msgBox.classList.add(type === "error" ? "is-error" : "is-success");
  msgBox.textContent = text;
}

function clearMsg() {
  if (!msgBox) return;

  msgBox.classList.remove("is-error", "is-success");
  msgBox.textContent = "";
}

function setLoading(state) {
  if (loginBtn) {
    loginBtn.disabled = state;
    loginBtn.textContent = state ? "Entrando..." : "Entrar";
  }

  loadingbar?.classList.toggle("show", state);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTerritory(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");
}

function isActiveProfile(profile) {
  return (
    profile?.status === "active" ||
    profile?.status === "aprovado" ||
    profile?.active === true ||
    profile?.ativo === true
  );
}

async function getUserProfile(uid) {
  if (!db) return null;

  const snap = await getDoc(
    doc(db, "users", uid)
  );

  if (!snap.exists()) return null;

  return {
    id: snap.id,
    ...snap.data()
  };
}

function getRedirect(profile) {
  const role = String(
    profile?.role ||
    profile?.perfil ||
    ""
  ).toLowerCase();

  if (
    role === "governanca" ||
    role === "gestor" ||
    role === "superadmin" ||
    role === "admin_master"
  ) {
    return "./governanca.html";
  }

  const territory = normalizeTerritory(
    profile?.territoryId ||
    profile?.cooperativaId ||
    profile?.cooperativeId ||
    selectedCoop
  );

  if (territory === "vila-pinto") {
    return "./cooperativa-vila-pinto.html";
  }

  if (territory === "cooadesc" || territory === "coadesc") {
    return "./cooperativa-cooadesc.html";
  }

  if (territory === "padre-cacique" || territory === "padrecacique") {
    return "./cooperativa-padre-cacique.html";
  }

  return COOPS[selectedCoop]?.redirect || "./login.html";
}

async function selectCoop(coopKey) {
  const coop = COOPS[coopKey];

  if (!coop) {
    showMsg("error", "Cooperativa inválida.");
    return;
  }

  try {
    clearMsg();
    selectedCoop = coopKey;

    const module = await coop.init();

    auth = module.auth;
    db = module.db;

    if (!auth || !db) {
      throw new Error("Firebase não retornou auth/db.");
    }

    if (cardTitle) {
      cardTitle.textContent = `Entrar • ${coop.label}`;
    }

    if (cardSubtitle) {
      cardSubtitle.textContent =
        `Use seu e-mail autorizado para acessar o painel da ${coop.label}.`;
    }

    coopSelector.style.display = "none";
    loginCard.style.display = "block";

    onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const profile = await getUserProfile(user.uid);

        if (!profile || !isActiveProfile(profile)) {
          return;
        }

        showMsg(
          "success",
          `Sessão ativa encontrada em ${coop.label}. Entrando...`
        );

        setTimeout(() => {
          window.location.href = getRedirect(profile);
        }, 700);
      } catch (error) {
        console.error("Erro ao verificar sessão:", error);
      }
    });

  } catch (error) {
    console.error("Erro ao carregar Firebase:", error);

    auth = null;
    db = null;
    selectedCoop = null;

    showMsg(
      "error",
      "Não foi possível carregar o Firebase desta cooperativa. Confira o nome do firebase-init."
    );
  }
}

document.querySelectorAll("[data-coop]").forEach((button) => {
  button.addEventListener("click", () => {
    selectCoop(button.dataset.coop);
  });
});

backToCoops?.addEventListener("click", async () => {
  try {
    if (auth?.currentUser) {
      await signOut(auth);
    }
  } catch (_) {}

  auth = null;
  db = null;
  selectedCoop = null;

  clearMsg();

  loginCard.style.display = "none";
  coopSelector.style.display = "block";

  if (loginEmail) loginEmail.value = "";
  if (loginPassword) loginPassword.value = "";
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  clearMsg();

  if (!auth || !db || !selectedCoop) {
    showMsg("error", "Selecione uma cooperativa primeiro.");
    return;
  }

  const email = normalizeEmail(loginEmail?.value);
  const password = loginPassword?.value || "";

  if (!email || !password) {
    showMsg("error", "Informe e-mail e senha.");
    return;
  }

  try {
    setLoading(true);

    await setPersistence(
      auth,
      rememberMe?.checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const profile = await getUserProfile(
      credential.user.uid
    );

    if (!profile) {
      await signOut(auth);

      showMsg(
        "error",
        "Login feito, mas este usuário não possui cadastro na coleção users deste Firebase."
      );

      return;
    }

    if (!isActiveProfile(profile)) {
      await signOut(auth);

      showMsg(
        "error",
        "Usuário sem acesso ativo."
      );

      return;
    }

    window.location.href = getRedirect(profile);

  } catch (error) {
    console.error("Erro no login:", error);

    const code = error?.code || "";

    let text = "Não foi possível entrar.";

    if (code.includes("invalid-credential")) {
      text = "E-mail ou senha inválidos.";
    } else if (code.includes("wrong-password")) {
      text = "Senha incorreta.";
    } else if (code.includes("user-not-found")) {
      text = "Usuário não encontrado neste Firebase.";
    } else if (code.includes("network-request-failed")) {
      text = "Falha de rede.";
    } else if (code.includes("permission-denied")) {
      text = "Sem permissão para ler o perfil em users.";
    }

    showMsg("error", text);

  } finally {
    setLoading(false);
  }
});

resetPwdLink?.addEventListener("click", async (event) => {
  event.preventDefault();

  clearMsg();

  if (!auth || !selectedCoop) {
    showMsg("error", "Selecione uma cooperativa primeiro.");
    return;
  }

  const email = normalizeEmail(loginEmail?.value);

  if (!email) {
    showMsg("error", "Digite seu e-mail para recuperar a senha.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showMsg(
      "success",
      "Enviamos o link de recuperação para seu e-mail."
    );
  } catch (error) {
    console.error("Erro reset senha:", error);

    showMsg(
      "error",
      "Não foi possível enviar o e-mail de recuperação."
    );
  }
});