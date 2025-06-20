// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxRlW4V42cwORS2XBk_3bsdFcUPoFpo3k",
  authDomain: "gas-bottle-tracker.firebaseapp.com",
  projectId: "gas-bottle-tracker",
  storageBucket: "gas-bottle-tracker.firebasestorage.app",
  messagingSenderId: "973155190596",
  appId: "1:973155190596:web:2580f0c74a630001f0b911"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export Firebase services
export { db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, orderBy }; 