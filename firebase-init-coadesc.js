
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAPUu0k3cqx-v1yos2MjbUnYXd2qX6fDs",
  authDomain: "coadesc-34711.firebaseapp.com",
  projectId: "coadesc-34711",
  storageBucket: "coadesc-34711.firebasestorage.app",
  messagingSenderId: "689475129073",
  appId: "1:689475129073:web:36deaa4b3f547dabd6a350",
  measurementId: "G-2Y7YTT6EZS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

await setPersistence(auth, browserLocalPersistence);

const db = getFirestore(app);

export { app, auth, db };