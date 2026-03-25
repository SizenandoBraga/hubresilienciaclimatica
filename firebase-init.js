
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCK3U8d8Ql1xoviPe-KJ6B8xvOZ7_K4vuQ",
  authDomain: "plataforma-regenera.firebaseapp.com",
  projectId: "plataforma-regenera",
  storageBucket: "plataforma-regenera.firebasestorage.app",
  messagingSenderId: "203232025444",
  appId: "1:203232025444:web:b2b745121103e0bce7f871"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

