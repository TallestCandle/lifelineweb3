
import { initializeApp, getApps, getApp } from "firebase/app";
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

// Note: Firebase Auth is no longer used for user-facing login, 
// but might be retained for other services or admin access in the future.
// For Pi integration, we don't need to export auth or providers for the main app.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// For admin/doctor portals that might still use Firebase Auth
import { getAuth } from "firebase/auth";
const auth = getAuth(app);


export { app, auth, db };
