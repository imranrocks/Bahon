import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// আপনার Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCLmMAyjxYUCBK3h8lgSU_1-rIRfdGnJWw",
  authDomain: "bahon-imranlabs.firebaseapp.com",
  projectId: "bahon-imranlabs",
  storageBucket: "bahon-imranlabs.firebasestorage.app",
  messagingSenderId: "957277842201",
  appId: "1:957277842201:android:7866c3022916a166cab388"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;