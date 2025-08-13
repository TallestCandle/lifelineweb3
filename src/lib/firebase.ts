import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAD5KWJlCGf4JhgUiHKy15bL2MQYytYVPQ",
  authDomain: "nexus-lifeline.firebaseapp.com",
  projectId: "nexus-lifeline",
  storageBucket: "nexus-lifeline.firebasestorage.app",
  messagingSenderId: "82659224569",
  appId: "1:82659224569:web:6fcd69a9eea466b265eb28",
  measurementId: "G-J74EJFXF8J"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
