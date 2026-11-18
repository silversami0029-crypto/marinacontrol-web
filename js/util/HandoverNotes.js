import { collection, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';
export async function saveHandoverNote(clientId, actor, notes, isCurrent, retryRecord = null) {
  if (!isCurrent()) throw new Error('Your marina or session changed. Reopen shift handover.');
  const text = String(notes || '').trim();
  if (!text || text.length > 8000) throw new Error('Enter handover notes (maximum 8000 characters).');
  if (!Number.isSafeInteger(Number(clientId)) || Number(clientId) <= 0 || !String(actor || '').trim()) throw new Error('Sign in and select a marina.');
  const now = Date.now();
  const ref = retryRecord?.ref || doc(collection(db, 'shift_handovers'));
  // A positive 52-bit random key fits both Java long and JavaScript safe integers.
  // Avoid timestamp+small-random IDs that collide for concurrent device saves.
  const words = crypto.getRandomValues(new Uint32Array(2));
  const numericId = (words[0] & 0xfffff) * 4294967296 + words[1] || 1;
  const data = retryRecord?.data || {id:numericId,clientId:Number(clientId),notes:text,createdAt:now,createdBy:String(actor),
    lastModified:now,lastModifiedBy:String(actor),syncedAt:now};
  if (data.clientId !== Number(clientId) || data.notes !== text || data.createdBy !== String(actor)) throw new Error('The handover draft changed. Reopen handover before retrying.');
  const record = {ref,data};
  try { await setDoc(ref,{...data,syncTime:serverTimestamp()}); }
  catch (error) { error.handoverRecord=record; throw error; }
  return record;
}
