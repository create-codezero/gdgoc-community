import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCM6VgUoiA-dMRlafZvhFTWVEXSJbqmEA8",
  authDomain: "community-gdgoc.firebaseapp.com",
  projectId: "community-gdgoc",
  storageBucket: "community-gdgoc.firebasestorage.app",
  messagingSenderId: "281076045086",
  appId: "1:281076045086:web:02f30a1972ae3baf04250f",
  measurementId: "G-MX8HM52LXP"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

const provider = new GoogleAuthProvider();

onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;

    if (user) {
        if (path === "/" || path === "") {
            window.location.href = "/dashboard";
        }
        
        const nameEl = document.getElementById("userName");
        if (nameEl) nameEl.innerText = `👋 ${user.displayName}`;
    } else {
        if (path === "/dashboard") {
            window.location.href = "/";
        }
    }
});

const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.onclick = async () => {
        try {
            await signInWithPopup(auth, provider);
            
        } catch (error) {
            console.error("Google Authentication Failed: ", error.message);
            alert("Failed to connect via Google. Please try again.");
        }
    };
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            
        } catch (error) {
            console.error("Session Signout Error: ", error.message);
        }
    };
}