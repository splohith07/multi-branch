// Firebase Web SDK Configuration for restaurant-multibranch
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { 
    initializeAppCheck, 
    ReCaptchaV3Provider 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-check.js";

// Client-side web configuration (Safe for public frontend)
// Note: Never include Firebase Admin SDK credentials, private keys, or service account JSON files here.
export const firebaseConfig = {
    projectId: "restaurant-multibranch",
    appId: "1:624556082655:web:491761675b092ee214f06a",
    storageBucket: "restaurant-multibranch.firebasestorage.app",
    apiKey: "AIzaSyBkMJXsxG-ZZwypy-57sIHA_NyeWlh4utM",
    authDomain: "restaurant-multibranch.firebaseapp.com",
    messagingSenderId: "624556082655",
    measurementId: "G-BB6WF6EK4V"
};

// Initialize Firebase Core & Services
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// =========================================
// FIREBASE APP CHECK INITIALIZATION
// =========================================
// Protects backend Firestore resources against abuse and unauthorized scrapers/bots.
// In local development (localhost / 127.0.0.1), debug token is enabled to prevent blocking development.
export let appCheck = null;
try {
    if (typeof window !== "undefined") {
        const isLocalhost = window.location.hostname === "localhost" || 
                            window.location.hostname === "127.0.0.1" || 
                            window.location.hostname === "";
        if (isLocalhost) {
            // Enable App Check debug token in local development
            self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }

        // Check for reCAPTCHA v3 Site Key configured in window
        const recaptchaKey = window.FIREBASE_RECAPTCHA_V3_KEY;
        if (recaptchaKey && typeof recaptchaKey === "string" && recaptchaKey.trim() !== "") {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(recaptchaKey.trim()),
                isTokenAutoRefreshEnabled: true
            });
            console.log("Firebase App Check initialized successfully.");
        } else {
            console.info("Firebase App Check: Set window.FIREBASE_RECAPTCHA_V3_KEY with your reCAPTCHA v3 site key to activate App Check in production.");
        }
    }
} catch (appCheckErr) {
    console.warn("Firebase App Check initialization skipped/deferred:", appCheckErr.message);
}

// Attach to window for safe reference in browser context
if (typeof window !== "undefined") {
    window.RestaurantFirebase = {
        app,
        auth,
        db,
        appCheck,
        firebaseConfig
    };
}

export {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp
};
