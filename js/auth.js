// js/auth.js
// Wraps Firebase Auth + user profile lookup (mirrors LoginActivity + FirebaseSessionService)

import {
  auth,
  db,
  collection, query, where, getDocs,
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut, sendPasswordResetEmail
} from './firebase.js';

/** Sign in with email + password. Returns Firebase user. */
export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
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

/**
 * Watch auth state. Calls cb(user | null).
 * Returns unsubscribe function.
 */
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

/**
 * Look up the app profile for a Firebase user.
 * Mirrors the "users" collection usage in LoginActivity.syncUserToFirestore():
 *   { userId, name, email, role, clientId, firebaseUid, createdAt }
 * Matches on `firebaseUid` == firebaseUser.uid.
 */
export async function loadUserProfile(firebaseUser) {
  if (!firebaseUser) return null;

  const q = query(
    collection(db, 'users'),
    where('firebaseUid', '==', firebaseUser.uid)
  );

  const snap = await getDocs(q);

  if (snap.empty) {
    // Fallback: try matching on email (older installs)
    const q2 = query(
      collection(db, 'users'),
      where('email', '==', firebaseUser.email)
    );
    const snap2 = await getDocs(q2);
    if (snap2.empty) return null;
    return normalizeProfile(snap2.docs[0].data());
  }

  return normalizeProfile(snap.docs[0].data());
}

function normalizeProfile(data) {
  return {
    userId:    Number(data.userId ?? data.id ?? 0),
    name:      data.name  ?? '',
    email:     data.email ?? '',
    role:      data.role  ?? 'staff',
    clientId:  Number(data.clientId ?? 0),
    firebaseUid: data.firebaseUid ?? null
  };
}

/** Human-readable Firebase error messages. */
export function friendlyError(err) {
  const code = err?.code || '';
  switch (code) {
    case 'auth/invalid-email':          return 'Email address is not valid.';
    case 'auth/user-disabled':          return 'This account has been disabled.';
    case 'auth/user-not-found':         return 'No account found with that email.';
    case 'auth/wrong-password':         return 'Incorrect password.';
    case 'auth/invalid-credential':     return 'Email or password is incorrect.';
    case 'auth/too-many-requests':      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default:                            return 'Unable to sign in. Please try again.';
  }
}