// Import the required Firebase v10 SDK modules directly from the official Google CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ⚠️ STEP 1: Replace this object with your actual project keys from the Firebase Console dashboard
// Go to: Project Settings -> General -> Your Apps -> Web App (Copy the config snippet)
const firebaseConfig = {
  apiKey: "AIzaSyCM6VgUoiA-dMRlafZvhFTWVEXSJbqmEA8",
  authDomain: "community-gdgoc.firebaseapp.com",
  projectId: "community-gdgoc",
  storageBucket: "community-gdgoc.firebasestorage.app",
  messagingSenderId: "281076045086",
  appId: "1:281076045086:web:02f30a1972ae3baf04250f",
  measurementId: "G-MX8HM52LXP"
};

// Initialize the Firebase Core instance
const app = initializeApp(firebaseConfig);

// Initialize Firebase services to export for the rest of your app scripts
export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

// Optional: Enforce only institutional college domains to maximize selection points
// provider.setCustomParameters({ hd: "yourcollege.edu" });

// --- AUTHENTICATION FLOW LISTENERS ---

// 1. Session State Observer (Monitors if user is signed in or out across windows)
onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;

    if (user) {
        // If logged in and stuck on landing page (/), push them forward to the hub
        if (path === "/" || path === "") {
            window.location.href = "/dashboard";
        }
        
        // Dynamically print the user's Google display name into the navbar UI
        const nameEl = document.getElementById("userName");
        if (nameEl) nameEl.innerText = `👋 ${user.displayName}`;
    } else {
        // If completely logged out but trying to access the internal dashboard, force them back
        if (path === "/dashboard") {
            window.location.href = "/";
        }
    }
});

// 2. Trigger Login UI Window (Executes when landing page button is pressed)
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.onclick = async () => {
        try {
            await signInWithPopup(auth, provider);
            // Redirection to /dashboard is handled automatically above by onAuthStateChanged
        } catch (error) {
            console.error("Google Authentication Failed: ", error.message);
            alert("Failed to connect via Google. Please try again.");
        }
    };
}

// 3. Destroy Session Token (Executes when dashboard logout button is pressed)
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            // Redirection to / is handled automatically by onAuthStateChanged observer
        } catch (error) {
            console.error("Session Signout Error: ", error.message);
        }
    };
}