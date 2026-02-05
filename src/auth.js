import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { ensureUserProfile } from "./firestore";

// Login
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // garante perfil no Firestore (caso não exista)
  await ensureUserProfile(cred.user);
  return cred.user;
}

// Cadastro
export async function register(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(cred.user, { role: "comunidade" });
  return cred.user;
}

// Recuperar senha
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

// Sair
export async function logout() {
  await signOut(auth);
}
