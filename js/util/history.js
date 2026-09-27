// js/util/history.js
import { store } from '../store.js';
import {
  collection, addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

/**
 * Writes a history entry. Best-effort — never throws.
 *
 * Android parity: logHistory(boatId, entityId, itemName, entityType,
 *                            action, title, detail, reason, ?, reference)
 */
export async function logHistory({
  entityType,               // 'EQUIPMENT' | 'INVENTORY'
  entityId,                 // Number
  itemName = '',
  boatId,                   // Number
  action,                   // 'CREATED' | 'UPDATED' | 'DELETED' | ...
  title = '',
  detail = '',
  reason = '',
  reference = '',
  by = ''
} = {}) {
  try {
    const clientId = Number(store.activeClientId);
    if (!clientId || !entityType || !action) return;

    await addDoc(collection(db, 'history'), {
      clientId,
      boatId: Number(boatId || 0),
      entityType,
      entityId: Number(entityId || 0),
      itemName,
      action,
      title,
      detail,
      reason,
      reference,
      by: by || String(store.userProfile?.userId || ''),
      at: Date.now()
    });
  } catch (err) {
    console.warn('[history] write failed', err?.code || err?.message || err);
  }
}