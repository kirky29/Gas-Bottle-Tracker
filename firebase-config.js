// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAxRlW4V42cwORS2XBk_3bsdFcUPoFpo3k",
  authDomain: "gas-bottle-tracker.firebaseapp.com",
  projectId: "gas-bottle-tracker",
  storageBucket: "gas-bottle-tracker.appspot.com",
  messagingSenderId: "973155190596",
  appId: "1:973155190596:web:2580f0c74a630001f0b911"
};

// Initialize Firebase with error handling
let app, db;

try {
  console.log('Initializing Firebase app...');
  app = initializeApp(firebaseConfig);
  console.log('Firebase app initialized successfully');
  
  console.log('Initializing Firestore...');
  db = getFirestore(app);
  console.log('Firestore initialized successfully');
} catch (error) {
  console.error('Firebase initialization error:', error);
  throw error;
}

// Export Firebase services
export { db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, orderBy }; 