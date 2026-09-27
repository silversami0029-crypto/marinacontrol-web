// js/auth.js
// Wraps Firebase Auth + secure MarinaControl session bootstrap

import {
  auth,
  db,
  collection, query, where, getDocs,
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from './firebase.js';

import {
  getFunctions, httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const functions = getFunctions(auth.app, 'us-central1');
const bootstrapSession = httpsCallable(functions, 'bootstrapSession');

let sessionPromise = null;

async function ensureSession(user) {
  if (!user) return null;

  const currentToken = await user.getIdTokenResult();
  if (Number(currentToken.claims.clientId) > 0) return currentToken;

  if (!sessionPromise) {
    sessionPromise = (async () => {
      await bootstrapSession();
      return user.getIdTokenResult(true);
    })().finally(() => {
      sessionPromise = null;
    });
  }

  return sessionPromise;
}

/** Sign in and establish the secure MarinaControl session. */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureSession(cred.user);
  return cred.user;
}

/** Sign out current user. */
export async function logout() {
  await signOut(auth);
}

/** Send password reset email. */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

/** Watch authentication after ensuring tenant claims exist. */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, async user => {
    if (user) {
      try {
        await ensureSession(user);
      } catch (err) {
        console.error('[auth] session bootstrap failed', err);
      }
    }
    cb(user);
  });
}

/** Load the signed-in user's tenant-scoped profile. */
export async function loadUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const token = await ensureSession(firebaseUser);
  const clientId = Number(token?.claims?.clientId || 0);
  if (!clientId) throw new Error('No client assigned to this account');

  const q = query(
    collection(db, 'users'),
    where('firebaseUid', '==', firebaseUser.uid),
    where('clientId', '==', clientId)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    const q2 = query(
      collection(db, 'users'),
      where('email', '==', firebaseUser.email),
      where('clientId', '==', clientId)
    );

    const snap2 = await getDocs(q2);
    if (snap2.empty) return null;
    return normalizeProfile(snap2.docs[0].data());
  }

  return normalizeProfile(snap.docs[0].data());
}

function normalizeProfile(data) {
  return {
    userId: Number(data.userId ?? data.id ?? 0),
    name: data.name ?? '',
    email: data.email ?? '',
    role: data.role ?? 'staff',
    clientId: Number(data.clientId ?? 0),
    firebaseUid: data.firebaseUid ?? null
  };
}

/** Human-readable Firebase error messages. */
export function friendlyError(err) {
  const code = err?.code || '';

  switch (code) {
    case 'auth/invalid-email': return 'Email address is not valid.';
    case 'auth/user-disabled': return 'This account has been disabled.';
    case 'auth/user-not-found': return 'No account found with that email.';
    case 'auth/wrong-password': return 'Incorrect password.';
    case 'auth/invalid-credential': return 'Email or password is incorrect.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    case 'functions/failed-precondition': return err.message || 'Account setup is incomplete.';
    case 'functions/permission-denied': return err.message || 'Account access was denied.';
    default: return 'Unable to sign in. Please try again.';
  }
}