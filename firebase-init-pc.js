
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
   apiKey: "AIzaSyC7qPZTlKqhd6WQQgkU1J2vfBrOFbzc2nU",
  authDomain: "padre-cacique.firebaseapp.com",
  projectId: "padre-cacique",
  storageBucket: "padre-cacique.firebasestorage.app",
  messagingSenderId: "267930729524",
  appId: "1:267930729524:web:5d13605433875db9945e61",
  measurementId: "G-XKBZSM5N26"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

await setPersistence(auth, browserLocalPersistence);

const db = getFirestore(app);

export { app, auth, db };