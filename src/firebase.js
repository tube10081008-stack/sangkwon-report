import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyD04vj8r9ZrIUHYZ8_Y7yEPGycPPsqaDak",
    authDomain: "sangkwon-report.firebaseapp.com",
    projectId: "sangkwon-report",
    storageBucket: "sangkwon-report.firebasestorage.app",
    messagingSenderId: "998042869543",
    appId: "1:998042869543:web:2ba88f07d8902bb7b99302",
    measurementId: "G-WRPV0L4DKS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
