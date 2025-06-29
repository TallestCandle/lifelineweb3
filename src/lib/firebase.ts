import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBWUTSsF8lWjUdrH7eUGFeMXHKAeK6CClg",
  authDomain: "nexus-lifeline.firebaseapp.com",
  projectId: "nexus-lifeline",
  storageBucket: "nexus-lifeline.appspot.com",
  messagingSenderId: "82659224569",
  appId: "1:82659224569:web:6fcd69a9eea466b265eb28",
  measurementId: "G-J74EJFXF8J"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
