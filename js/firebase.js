// js/firebase.js
import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, query, where, onSnapshot,
  doc, getDoc, getDocs, writeBatch, deleteDoc, updateDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export {
  collection, query, where, onSnapshot,
  doc, getDoc, getDocs, writeBatch, deleteDoc, updateDoc, setDoc,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail
};