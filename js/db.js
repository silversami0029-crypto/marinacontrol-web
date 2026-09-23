// js/db.js
import {
  db,
  collection, query, where, onSnapshot,
  doc, getDoc, getDocs, writeBatch, deleteDoc, setDoc, updateDoc
} from './firebase.js';
import { Boat } from './models/Boat.js';

/* ---------- READ ---------- */
export function listenForBoats(clientId, callback) {
  const q = query(collection(db, 'boats'), where('clientId', '==', clientId));
  return onSnapshot(q, (snap) => {
    const boats = snap.docs.map((d) => {
      const data = d.data();
      return new Boat({ ...data, id: Number(data.id ?? d.id), _docId: d.id });
    });
    callback(boats, null);
  }, (err) => {
    console.error('listenForBoats error', err);
    callback([], err);
  });
}

/* ---------- LIVE CUSTOMERS ---------- */
export function listenForCustomers(clientId, callback) {
  if (!clientId || clientId <= 0) { callback([], null); return () => {}; }
  const q = query(collection(db, 'customers'), where('clientId', '==', clientId));
  return onSnapshot(q, (snap) => {
    const customers = snap.docs.map((d) => {
      const data = d.data();
      return {
        id:        Number(data.id ?? d.id),
        clientId:  Number(data.clientId ?? clientId),
        name:      data.name  || '',
        email:     data.email || '',
        phone:     data.phone || ''
      };
    });
    callback(customers, null);
  }, (err) => {
    console.error('listenForCustomers error', err);
    callback([], err);
  });
}

/* ---------- WRITE: set active ---------- */
export async function setActiveBoat(clientId, selectedBoatId) {
  const q = query(collection(db, 'boats'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  const now = Date.now();
  snap.docs.forEach((d) => {
    const data = d.data();
    const firestoreBoatId = Number(data.id ?? d.id);
    batch.update(d.ref, {
      isActive: firestoreBoatId === selectedBoatId,
      lastModified: now,
      syncedAt: 0
    });
  });
  await batch.commit();
}

/* ---------- WRITE: delete one ---------- */
export async function deleteBoatById(firestoreDocId) {
  await deleteDoc(doc(db, 'boats', String(firestoreDocId)));
}

/* ---------- WRITE: delete many ---------- */
export async function deleteBoatDocsByIds(docIds) {
  if (!docIds || !docIds.length) return;
  const batch = writeBatch(db);
  docIds.forEach((id) => batch.delete(doc(db, 'boats', String(id))));
  await batch.commit();
}

/* ---------- WRITE: create boat ---------- */
export async function nextBoatId(clientId) {
  const q = query(collection(db, 'boats'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  let max = 0;
  snap.forEach((d) => {
    const n = Number(d.data().id ?? 0);
    if (n > max) max = n;
  });
  return max + 1;
}

export async function findBoatByMmsi(clientId, mmsi) {
  if (!mmsi || mmsi === 'TBC') return null;
  const q = query(
    collection(db, 'boats'),
    where('clientId', '==', clientId),
    where('mmsi', '==', mmsi)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return Number(snap.docs[0].data().id ?? 0);
}

export async function createBoat(clientId, userId, fields) {
  const newId = await nextBoatId(clientId);
  const boatData = {
    id: newId, clientId: clientId,
    name: fields.name, mmsi: fields.mmsi,
    isSample: false, hin: fields.hin, port: fields.port,
    status: fields.status, isActive: !!fields.isActive,
    type: fields.type, engineType: fields.engineType,
    engineHours: 0, voiceNotePath: null, photoPath: null,
    length: fields.length, beam: fields.beam,
    draft: fields.draft, airDraft: fields.airDraft,
    customerId: fields.customerId,
    lastModified: Date.now(),
    lastModifiedBy: String(userId ?? ''),
    syncedAt: Date.now(), syncTime: new Date()
  };
  await setDoc(doc(db, 'boats', String(newId)), boatData);
  return newId;
}

/* ---------- WRITE: update boat ---------- */
export async function updateBoat(docId, userId, fields) {
  await updateDoc(doc(db, 'boats', String(docId)), {
    name: fields.name, mmsi: fields.mmsi, hin: fields.hin,
    port: fields.port, status: fields.status,
    isActive: !!fields.isActive, type: fields.type,
    engineType: fields.engineType, engineHours: 0,
    length: fields.length, beam: fields.beam,
    draft: fields.draft, airDraft: fields.airDraft,
    customerId: fields.customerId,
    lastModified: Date.now(),
    lastModifiedBy: String(userId ?? ''),
    syncedAt: Date.now()
  });
}

/* ---------- ASSIGN CUSTOMER ---------- */
export async function assignCustomerToBoat(docId, customerId, userId) {
  await updateDoc(doc(db, 'boats', String(docId)), {
    customerId: Number(customerId) || 0,
    lastModified: Date.now(),
    lastModifiedBy: String(userId ?? ''),
    syncedAt: 0
  });
}

/* ---------- BULK IMPORT ---------- */
function normalizeStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'inactive' || s === 'off service') return 'Off Service';
  if (s === 'maintenance') return 'Maintenance';
  return 'In Service';
}

export async function importBoatsFromRows(clientId, userId, rows, onProgress) {
  let success = 0, skipped = 0;
  const errors = [];
  const q = query(collection(db, 'boats'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  const existingMmsi = new Set();
  let maxId = 0;
  snap.forEach((d) => {
    const data = d.data();
    if (data.mmsi) existingMmsi.add(String(data.mmsi));
    const n = Number(data.id ?? 0);
    if (n > maxId) maxId = n;
  });
  let nextId = maxId + 1;
  const now = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name || !String(row.name).trim()) {
        errors.push(`Row ${i + 2}: missing boat name`);
        continue;
      }
      const mmsi = String(row.mmsi || 'TBC').trim();
      if (mmsi !== 'TBC' && existingMmsi.has(mmsi)) {
        skipped++;
        if (onProgress) onProgress(success, skipped, rows.length);
        continue;
      }
      const model = String(row.model || '').trim();
      const name = model ? `${String(row.name).trim()} ${model}` : String(row.name).trim();
      await setDoc(doc(db, 'boats', String(nextId)), {
        id: nextId, clientId: clientId, name: name, mmsi: mmsi,
        isSample: false, hin: String(row.hin || 'TBC').trim(),
        port: String(row.port || 'TBC').trim(),
        status: normalizeStatus(row.status),
        isActive: false, type: String(row.type || 'Unknown').trim(),
        engineType: 'Unknown', engineHours: 0,
        voiceNotePath: null, photoPath: null,
        length: 0, beam: 0, draft: 0, airDraft: 0, customerId: 0,
        lastModified: now, lastModifiedBy: String(userId ?? ''),
        syncedAt: now, syncTime: new Date()
      });
      existingMmsi.add(mmsi);
      nextId++;
      success++;
      if (onProgress) onProgress(success, skipped, rows.length);
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message || 'unknown error'}`);
    }
  }
  return { success, skipped, failed: errors.length, errors };
}

/* ============================================================
   BERTHS
   ============================================================ */
import { Berth } from './models/Berth.js';

export function listenForBerths(clientId, callback) {
  if (!clientId || clientId <= 0) {
    callback([], null);
    return () => {};
  }

  const q = query(
    collection(db, 'berths'),
    where('clientId', '==', clientId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const berths = snap.docs.map((d) => {
        const data = d.data();
        return new Berth({ ...data, id: Number(data.id ?? d.id), _docId: d.id });
      });
      callback(berths, null);
    },
    (err) => {
      console.error('listenForBerths error', err);
      callback([], err);
    }
  );
}