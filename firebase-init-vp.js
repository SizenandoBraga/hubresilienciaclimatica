
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDA2Xq9sRvRuVZVkeIH8Q6d6JB9Pv_Dkss",
  authDomain: "vila-pinto.firebaseapp.com",
  projectId: "vila-pinto",
  storageBucket: "vila-pinto.firebasestorage.app",
  messagingSenderId: "669076509625",
  appId: "1:669076509625:web:5cb058223684593590dc68",
  measurementId: "G-N3JXY8LEY7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

await setPersistence(auth, browserLocalPersistence);

const db = getFirestore(app);

export { app, auth, db };