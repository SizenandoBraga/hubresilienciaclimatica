import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyABDs2g2yHJBxcIq4cQNt6BNJGO__4Liks",
  authDomain: "guardioesurbanos-a144f.firebaseapp.com",
  projectId: "guardioesurbanos-a144f",
  storageBucket: "guardioesurbanos-a144f.firebasestorage.app",
  messagingSenderId: "354730831720",
  appId: "1:354730831720:web:7e68c4ad9e61bf310770dd",
  measurementId: "G-HS27X087L5"
};

const app = initializeApp(firebaseConfig, "guardioes");

const db = getFirestore(app);

export { app, db };