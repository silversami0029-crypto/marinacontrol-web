import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export async function boatReferenceCandidates(clientId, boatId) {
  if (!Number.isSafeInteger(Number(boatId)) || Number(boatId) <= 0) return [];
  const snapshot = await getDocs(query(collection(db, 'boats'), where('clientId', '==', Number(clientId))));
  return snapshot.docs.filter(document => Number(document.data().id ?? document.id) === Number(boatId)).map(document => document.ref);
}

export function requireBoatReference(snapshot, clientId, boatId) {
  const boat = snapshot?.data();
  if (!boat || Number(boat.clientId) !== Number(clientId) || Number(boat.id ?? snapshot.id) !== Number(boatId))
    throw new Error('The selected boat no longer exists in this marina. Reopen the screen and choose an existing boat.');
}
