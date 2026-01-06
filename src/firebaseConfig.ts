// src/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBTbNd7h3DhhWgJfwra1E8LbdFptOVqB80",
  authDomain: "monica-chat-1c8a6.firebaseapp.com",
  projectId: "monica-chat-1c8a6",
  storageBucket: "monica-chat-1c8a6.firebasestorage.app",
  messagingSenderId: "199399193480",
  appId: "1:199399193480:web:74e95b81da5c2e0889583d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ FIX: Use IndexedDB for Electron, fallback to localStorage
setPersistence(auth, indexedDBLocalPersistence)
  .catch((error) => {
    console.warn("IndexedDB persistence failed, trying localStorage:", error);
    return setPersistence(auth, browserLocalPersistence);
  })
  .catch((error) => {
    console.error("All persistence methods failed:", error);
  });

// Export app instance
export default app;