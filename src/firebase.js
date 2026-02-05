import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA8LPTZD7LA_CW2fOnJXJlVe6pByLyrRzo",
  authDomain: "hub-resiliencia-climatica.firebaseapp.com",
  projectId: "hub-resiliencia-climatica",
  storageBucket: "hub-resiliencia-climatica.firebasestorage.app",
  messagingSenderId: "485694309026",
  appId: "1:485694309026:web:771ed497d49861fa444dfb",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
