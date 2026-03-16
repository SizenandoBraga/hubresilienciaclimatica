import { initializeApp } from "firebase/app";

import {
getAuth,
setPersistence,
browserLocalPersistence
} from "firebase/auth";

import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyCK3U8d8Ql1xoviPe-KJ6B8xvOZ7_K4vuQ",
  authDomain: "plataforma-regenera.firebaseapp.com",
  projectId: "plataforma-regenera",
  storageBucket: "plataforma-regenera.firebasestorage.app",
  messagingSenderId: "203232025444",
  appId: "1:203232025444:web:b2b745121103e0bce7f871"
};

const app = initializeApp(firebaseConfig);

// serviços
export const auth = getAuth(app);
export const db = getFirestore(app);

// mantém usuário logado entre páginas
setPersistence(auth, browserLocalPersistence).catch((err) => {
console.warn("[auth] setPersistence falhou:", err?.message || err);
});