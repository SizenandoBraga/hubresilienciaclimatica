import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCK3U8d8Ql1xoviPe-KJ6B8xvOZ7_K4vuQ",
  authDomain: "plataforma-regenera.firebaseapp.com",
  projectId: "plataforma-regenera",
  storageBucket: "plataforma-regenera.firebasestorage.app",
  messagingSenderId: "203232025444",
  appId: "1:203232025444:web:b2b745121103e0bce7f871"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);