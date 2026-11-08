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

import {
  getAnalytics, isSupported
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export let analytics = null;

// Analytics failure must not prevent the webapp from working.
isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch((error) => {
    console.warn('[Analytics] Could not initialise:', error);
  });

export {
  collection, query, where, onSnapshot,
  doc, getDoc, getDocs, writeBatch, deleteDoc, updateDoc, setDoc,
  onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail
};