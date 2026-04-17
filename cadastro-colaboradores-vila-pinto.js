import { auth, db } from "./firebase-init.js";

import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const STATE = {
  currentUser: null,
  profile: null
};

/* =========================
CRIAR USUÁRIO
========================= */

document.getElementById("btnCreateUser").addEventListener("click", createUser);

async function createUser() {
  try {
    const name = document.getElementById("userName").value.trim();
    const email = document.getElementById("userEmail").value.trim();
    const password = document.getElementById("userPassword").value.trim();
    const role = document.getElementById("userRole").value;

    if (!name || !email || !password) {
      alert("Preencha todos os campos");
      return;
    }

    /* cria no auth */
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    /* salva no firestore */
    await addDoc(collection(db, "users"), {
      uid,
      name,
      email,
      role,
      status: "active",

      territoryId: STATE.profile.territoryId,
      territoryLabel: STATE.profile.territoryLabel,

      createdAt: serverTimestamp()
    });

    alert("Usuário criado com sucesso");

    loadUsers();

  } catch (error) {
    console.error(error);
    alert("Erro ao criar usuário");
  }
}

/* =========================
LISTAR USUÁRIOS
========================= */

async function loadUsers() {
  const usersList = document.getElementById("usersList");

  usersList.innerHTML = "Carregando...";

  try {
    const q = query(
      collection(db, "users"),
      where("territoryId", "==", STATE.profile.territoryId)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      usersList.innerHTML = "Nenhum usuário cadastrado";
      return;
    }

    usersList.innerHTML = snap.docs.map(doc => {
      const u = doc.data();

      return `
        <div class="user-card">
          <strong>${u.name}</strong>
          <span>${u.email}</span>
          <span>${u.role}</span>
        </div>
      `;
    }).join("");

  } catch (error) {
    console.error(error);
    usersList.innerHTML = "Erro ao carregar usuários";
  }
}

/* =========================
INIT
========================= */

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    alert("Usuário sem perfil");
    return;
  }

  STATE.profile = snap.data();

  /* bloqueio: só admin pode criar */
  if (STATE.profile.role !== "admin") {
    document.getElementById("btnCreateUser").style.display = "none";
  }

  loadUsers();
});