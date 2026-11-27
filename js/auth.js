import {sessionTimeout} from './util/SessionTimeout.js';
import {sendEmailVerification} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { italianUI as itUI } from './i18n.js';
import { doc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
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

let sessionJob=null,sessionError=null,observerGeneration=0;
export const getSessionError=()=>sessionError;
export const getCurrentAuthUser=()=>auth.currentUser;
export function reportSessionError(error){if(error&&!error.code)error.code='auth/session-setup';sessionError=error||null;}
function accountChanged(user){
 if(auth.currentUser?.uid!==user.uid){const e=Error('The signed-in account changed. Try again.');e.code='auth/session-changed';throw e;}
}
async function ensureSession(user,force=false){
 if(!user)return null;accountChanged(user);
 if(force&&sessionJob?.uid===user.uid)sessionJob=null;
 if(!sessionJob||sessionJob.uid!==user.uid){
  const job={uid:user.uid,promise:null};
  job.promise=sessionTimeout((async()=>{
   const token=await user.getIdTokenResult(force);accountChanged(user);
   if(token.claims.email_verified!==true){const e=Error('Verify your email before opening your marina. Use Send verification email below.');e.code='auth/email-not-verified';throw e;}
   // Bootstrap once per signed-in session, even when old claims already exist.
   await bootstrapSession();accountChanged(user);
   const fresh=await user.getIdTokenResult(true);accountChanged(user);return fresh;
  })()).catch(error=>{if(sessionJob===job)sessionJob=null;throw error;});
  sessionJob=job;
 }
 return sessionJob.promise;
}
export async function login(email,password){
 sessionError=null;
 try{const cred=await sessionTimeout(signInWithEmailAndPassword(auth,email.trim(),password));await ensureSession(cred.user);return cred.user;}
 catch(error){if(!auth.currentUser||String(auth.currentUser.email||'').toLowerCase()===email.trim().toLowerCase())sessionError=error;throw error;}
}
export async function resumeLogin(){
 const user=auth.currentUser;if(!user)throw Error('Sign in first.');sessionError=null;
 try{await sessionTimeout(user.reload());await ensureSession(user,true);return user;}catch(error){if(auth.currentUser?.uid===user.uid)sessionError=error;throw error;}
}
export async function requestVerificationEmail(){
 const user=auth.currentUser;if(!user)throw Error('Sign in with your password first.');
 await sessionTimeout(sendEmailVerification(user));
}
export async function logout(){sessionJob=null;sessionError=null;await signOut(auth);}
export async function resetPassword(email){await sessionTimeout(sendPasswordResetEmail(auth,email.trim()));}
export function watchAuth(cb){
 return onAuthStateChanged(auth,async user=>{
  const generation=++observerGeneration;
  if(!user){sessionJob=null;sessionError=null;}
  try{if(user)await ensureSession(user);if(generation===observerGeneration){sessionError=null;cb(user,null);}}
  catch(error){if(generation!==observerGeneration)return;sessionError=error;console.error('[auth] session setup failed',error.code||error.message);cb(null,error);}
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

  const snap = await sessionTimeout(getDocs(q));

  if (snap.empty) {
    const q2 = query(
      collection(db, 'users'),
      where('email', '==', firebaseUser.email),
      where('clientId', '==', clientId)
    );

    const snap2 = await sessionTimeout(getDocs(q2));
    if (snap2.empty) return null;
    return normalizeProfile(snap2.docs[0].data(), snap2.docs[0].id, firebaseUser);
  }

  return normalizeProfile(snap.docs[0].data(), snap.docs[0].id, firebaseUser);
}

function normalizeProfile(data, docId, firebaseUser) {
  return {
    userId: Number(data.userId ?? data.id ?? 0),
    _docId: docId,
    name: String(data.name || data.fullName || firebaseUser?.displayName || '').trim(),
    phone: data.phone || '',
    email: data.email || firebaseUser?.email || '',
    role: data.role ?? 'staff',
    clientId: Number(data.clientId ?? 0),
    firebaseUid: data.firebaseUid ?? null
  };
}

/** Human-readable Firebase error messages. */
export function friendlyError(err) {
  const code = err?.code || '';

  switch (code) {
    case 'auth/session-setup': return err.message || itUI('Your sign-in was accepted, but marina setup could not finish. Retry opening your marina.');
    case 'permission-denied': return itUI('Your sign-in was accepted, but marina access was denied. Ask your administrator to check your account.');
    case 'auth/session-timeout': return itUI('Sign-in setup timed out. Retry opening your marina; you do not need to reset your password.');
    case 'auth/email-not-verified': return itUI('Your password was accepted. Verify your email before opening your marina.');
    case 'auth/session-changed': return itUI('The signed-in account changed. Sign in again.');
    case 'functions/deadline-exceeded':
    case 'functions/unavailable': return itUI('Marina setup is temporarily unavailable. Please retry.');
    case 'auth/invalid-email': return itUI('Email address is not valid.');
    case 'auth/user-disabled': return itUI('This account has been disabled.');
    case 'auth/user-not-found': return itUI('No account found with that email.');
    case 'auth/wrong-password': return itUI('Incorrect password.');
    case 'auth/invalid-credential': return itUI('Email or password is incorrect.');
    case 'auth/too-many-requests': return itUI('Too many attempts. Try again later.');
    case 'auth/network-request-failed': return itUI('Network error. Check your connection.');
    case 'functions/failed-precondition': return err.message || 'Account setup is incomplete.';
    case 'functions/permission-denied': return err.message || 'Account access was denied.';
    default: return itUI('Unable to sign in. Please try again.');
  }
}
/** Update only the signed-in user's personal fields in their base marina. */
export async function saveOwnProfile({ name, phone }) {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  name = String(name || '').trim();
  phone = String(phone || '').trim();
  if (!name || name.length > 100 || phone.length > 40) throw new Error('Invalid profile');
  const profile = await loadUserProfile(user);
  if (!profile?._docId) throw new Error('User profile not found');
  const ref = doc(db, 'users', profile._docId);
  const snapshot = await getDoc(ref);
  const data = snapshot.data();
  if (!snapshot.exists() || Number(data.clientId) !== profile.clientId ||
      (data.firebaseUid ? data.firebaseUid !== user.uid : String(data.email || '').toLowerCase() !== String(user.email || '').toLowerCase())) {
    throw new Error('Account access was denied');
  }
  await updateDoc(ref, { name, phone, lastModified: Date.now(), syncTime: serverTimestamp() });
  return { ...profile, name, phone };
}

/** Redeem invites through the same server function used by Android.
 * A separate Auth instance prevents the router bootstrapping before redemption.
 */
export async function joinMarinaWithCode({ inviteCode, displayName, email, password }) {
  inviteCode = String(inviteCode || '').trim();
  displayName = String(displayName || '').trim();
  email = String(email || '').trim();
  if (!inviteCode || !displayName || !email || !password) {
    throw new Error('Complete all fields to join a marina.');
  }
  const { initializeApp, deleteApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getAuth, createUserWithEmailAndPassword, sendEmailVerification } =
    await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const inviteApp = initializeApp(auth.app.options, `marina-invite-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const inviteAuth = getAuth(inviteApp);
  let result;
  try {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(inviteAuth, email, password);
    } catch (error) {
      if (error.code !== 'auth/email-already-in-use') throw error;
      credential = await signInWithEmailAndPassword(inviteAuth, email, password);
    }
    if (!credential.user.emailVerified) {
      await sendEmailVerification(credential.user);
      throw new Error('Verification email sent. Verify your email, then join again.');
    }
    await credential.user.getIdToken(true);
    const redeem = httpsCallable(getFunctions(inviteApp, 'us-central1'), 'redeemMarinaInvite');
    result = (await redeem({ inviteCode, displayName })).data;
    if (!result?.client || !result?.user || !result?.membership) {
      throw new Error('The server returned an incomplete membership. Please contact support before retrying.');
    }
  } finally {
    await signOut(inviteAuth).catch(() => {});
    await deleteApp(inviteApp).catch(() => {});
  }
  // Membership now exists before the primary authentication observer can run.
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await credential.user.getIdToken(true);
  return result;
}
