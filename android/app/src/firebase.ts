// Firebase SDKs থেকে প্রয়োজনীয় ফাংশনগুলো ইমপোর্ট করা হচ্ছে
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// আপনার আসল কনফিগারেশন
const firebaseConfig = {
  apiKey: "AIzaSyCLmMAyjxYUCBK3h8lgSU_1-rIRfdGnJWw",
  authDomain: "bahon-imranlabs.firebaseapp.com",
  projectId: "bahon-imranlabs",
  storageBucket: "bahon-imranlabs.firebasestorage.app",
  messagingSenderId: "957277842201",
  appId: "1:957277842201:web:f2ea4f9ccdc5f505cab388",
  measurementId: "G-1HMLM45RZ5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// সার্ভিসগুলো এক্সপোর্ট করা হচ্ছে যাতে AI-এর দেওয়া অন্য ফাইলগুলো এগুলো ব্যবহার করতে পারে
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app);

// AI Studio-র লজিকের জন্য এই অতিরিক্ত ফাংশনগুলো এক্সপোর্ট করা জরুরি
export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
};

export default app;