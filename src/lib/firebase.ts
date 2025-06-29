import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAD5KWJlCGf4JhgUiHKy15bL2MQYytYVPQ",
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

export { app, auth };
