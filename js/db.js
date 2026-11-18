import { boatImportDetails } from './util/BoatCsv.js';
import { italianUI as itUI } from './i18n.js';
import { savedCurrency, money, currencyDigits } from './util/BillingCurrency.js';
import { marinaCurrency, checkBillingClient } from './util/BillingData.js';
import { runTransaction, getDocFromServer, getDocsFromServer, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { utilitySegments } from './analytics/utilityConsumption.js';
// js/db.js
import {
  db,
  collection, query, where, onSnapshot,
  doc, getDoc, getDocs, writeBatch, deleteDoc, setDoc, updateDoc
} from './firebase.js';
import { Boat } from './models/Boat.js';
import { BerthBookingRequest } from './models/BerthBookingRequest.js';

/* ---------- READ ---------- */
export function listenForBoats(clientId, callback, boatId = null) {
  const q = query(collection(db, 'boats'), where('clientId', '==', clientId),
    ...(boatId === null ? [] : [where('id', '==', boatId)]));
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
  const cid = Number(clientId);
  const selectedId = Number(selectedBoatId);

  if (!cid || !selectedId) throw new Error('Invalid client or boat ID');

  const q = query(collection(db, 'boats'), where('clientId', '==', cid));
  const snap = await getDocsFromServer(q);
  await runTransaction(db, async transaction => {
    const boats = (await Promise.all(snap.docs.map(boat => transaction.get(boat.ref))))
      .filter(boat => boat.exists() && Number(boat.data().clientId) === cid);
    if (!boats.some(boat => Number(boat.data().id ?? boat.id) === selectedId)) {
      throw new Error('Selected boat not found');
    }

    const now = Date.now();
    for (const boat of boats) {
      const data = boat.data();
      const isActive = Number(data.id ?? boat.id) === selectedId;
      if (!!data.isActive === isActive) continue;
      transaction.update(boat.ref, {
        isActive,
        lastModified: now,
        lastModifiedBy: 'WEB',
        syncedAt: 0
      });
    }
  });
}

export async function setAssignedBoatActive(docId) {
  await updateDoc(doc(db, 'boats', String(docId)), {
    isActive: true,
    lastModified: Date.now(),
    lastModifiedBy: 'WEB',
    syncedAt: 0
  });
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

// Keep the numeric ID and marina-prefixed document key used by existing records.
async function createNumberedRecord(collectionName, clientId, firstId, fields, isCurrent = () => true, validateReads = null) {
  for (let id = firstId; Number.isSafeInteger(id) && id > 0; id++) {
    const ref = doc(db, collectionName, `${clientId}_${id}`);
    const created = await runTransaction(db, async transaction => {
      if (!isCurrent()) throw new Error('The marina or session changed. Restart the import.');
      const snapshot = await transaction.get(ref);
      if (!isCurrent()) throw new Error('The marina or session changed. Restart the import.');
      if (snapshot.exists()) return false;
      if (validateReads) await validateReads(transaction);
      if (!isCurrent()) throw new Error('The marina or session changed. Restart the import.');
      transaction.set(ref, { ...fields, id });
      return true;
    });
    if (created) return id;
  }
  throw new Error('No valid record ID is available.');
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
  const firstId = await nextBoatId(clientId);
  const boatData = {
    clientId: clientId,
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
  return createNumberedRecord('boats', clientId, firstId, boatData);
}

/* ---------- WRITE: update boat ---------- */
export async function updateBoat(docId, userId, fields) {
  await updateDoc(doc(db, 'boats', String(docId)), {
    name: fields.name, mmsi: fields.mmsi, hin: fields.hin,
    port: fields.port, status: fields.status,
    isActive: !!fields.isActive, type: fields.type,
    engineType: fields.engineType,
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

export async function importBoatsFromRows(clientId, userId, rows, onProgress, isCurrent = () => true) {
  clientId = Number(clientId);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) throw new Error('Select a marina before importing.');
  if (!isCurrent()) throw new Error('Your marina or session changed. Restart the import.');
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
  const customerIds = new Set();
  const customerRefs = new Map();
  if (rows.some(row => Number(row.customerId))) {
    const customers = await getDocs(query(collection(db, 'customers'), where('clientId', '==', clientId)));
    customers.forEach(d => {
      const id = Number(d.data().id ?? d.id);
      customerIds.add(id);
      customerRefs.set(id, d.ref);
    });
  }
  let nextId = maxId + 1;
  const now = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isCurrent()) {
      for (let j = i; j < rows.length; j++) errors.push(`Row ${j + 2}: not imported because the marina or session changed.`);
      break;
    }
    try {
      if (!row.name || !String(row.name).trim()) {
        throw new Error('missing boat name');
      }
      const details = boatImportDetails(row, customerIds);
      const mmsi = String(row.mmsi || 'TBC').trim();
      if (mmsi !== 'TBC' && existingMmsi.has(mmsi)) {
        skipped++;
        continue;
      }
      const model = String(row.model || '').trim();
      const name = model ? `${String(row.name).trim()} ${model}` : String(row.name).trim();
      const id = await createNumberedRecord('boats', clientId, nextId, {
        clientId: clientId, name: name, mmsi: mmsi,
        isSample: false, hin: String(row.hin || 'TBC').trim(),
        port: String(row.port || 'TBC').trim(),
        status: normalizeStatus(row.status),
        isActive: false, type: String(row.type || 'Unknown').trim(),
        ...details,
        voiceNotePath: null, photoPath: null,
        lastModified: now, lastModifiedBy: String(userId ?? ''),
        syncedAt: now, syncTime: new Date()
      }, isCurrent, details.customerId ? async transaction => {
        const customerSnapshot = await transaction.get(customerRefs.get(details.customerId));
        const customer = customerSnapshot.data();
        if (!customer || Number(customer.clientId) !== clientId
            || Number(customer.id ?? customerSnapshot.id) !== details.customerId)
          throw new Error('The selected customer changed or was removed. Refresh customers before importing.');
      } : null);
      existingMmsi.add(mmsi);
      nextId = id + 1;
      success++;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message || 'unknown error'}`);
    } finally {
      if (onProgress) onProgress(success, skipped, rows.length, errors.length);
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

/* ============================================================
   BERTHS — write ops
   ============================================================ */

export async function nextBerthId(clientId) {
  const q = query(collection(db, 'berths'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  let max = 0;
  snap.forEach((d) => {
    const n = Number(d.data().id ?? 0);
    if (n > max) max = n;
  });
  return max + 1;
}

export async function createBerth(clientId, userId, fields) {
  const firstId = await nextBerthId(clientId);

  const data = {
    clientId:        clientId,
    dockName:        fields.dockName,
    berthNumber:     fields.berthNumber,
    length:          Number(fields.length) || 0,
    width:           Number(fields.width)  || 0,
    depth:           Number(fields.depth)  || 0,
    maxAirDraft:     0,
    hasElectric:     !!fields.hasElectric,
    hasWater:        !!fields.hasWater,
    status:          (fields.status || 'AVAILABLE').toUpperCase(),
    boatId:          null,
    assignedBoatName: null,
    assignedDate:    null,
    expectedEndDate: null,
    actualEndDate:   null,
    lockedBy:        0,
    lockedAt:        0,
    photoPath:       null,
    voiceNotePath:   null,
    lastModified:    Date.now(),
    lastModifiedBy:  String(userId ?? ''),
    syncedAt:        Date.now()
  };

  return createNumberedRecord('berths', clientId, firstId, data);
}

export async function deleteAllBerths(clientId) {
  const q = query(collection(db, 'berths'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  // Firestore batches cap at 500 — chunk if needed
  const refs = snap.docs.map(d => d.ref);
  for (let i = 0; i < refs.length; i += 500) {
    const batch = writeBatch(db);
    refs.slice(i, i + 500).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
  return refs.length;
}

export async function importBerthsFromRows(clientId, userId, rows, onProgress) {
  clientId = Number(clientId);
  if (!Number.isSafeInteger(clientId) || clientId <= 0) throw new Error('Select a valid marina before importing berths.');
  let success = 0;
  let skipped = 0;
  const errors = [];

  // Load existing dock+berth combos for duplicate detection
  const q = query(collection(db, 'berths'), where('clientId', '==', clientId));
  const snap = await getDocs(q);

  const existing = new Set();
  let maxId = 0;
  snap.forEach((d) => {
    const data = d.data();
    const key = `${(data.dockName || '').toLowerCase()}|${(data.berthNumber || '').toLowerCase()}`;
    existing.add(key);
    const n = Number(data.id ?? 0);
    if (n > maxId) maxId = n;
  });

  let nextId = maxId + 1;
  const now = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const dockName    = String(row.dockName    || '').trim();
      const berthNumber = String(row.berthNumber || '').trim();

      if (!dockName)    { errors.push(`Row ${i + 2}: missing dock name`);    continue; }
      if (!berthNumber) { errors.push(`Row ${i + 2}: missing berth number`); continue; }

      const key = `${dockName.toLowerCase()}|${berthNumber.toLowerCase()}`;
      if (existing.has(key)) {
        skipped++;
        if (onProgress) onProgress(success, skipped, rows.length);
        continue;
      }

      const length = parseFloat(row.length) || 0;
      const width  = parseFloat(row.width)  || 0;
      const depth  = parseFloat(row.depth)  || 0;

      const hasElectric = parseBool(row.hasElectric);
      const hasWater    = parseBool(row.hasWater);

      const status = String(row.status || 'AVAILABLE').trim().toUpperCase();
      const validStatus = ['AVAILABLE','OCCUPIED','MAINTENANCE'].includes(status)
        ? status : 'AVAILABLE';

      const id = await createNumberedRecord('berths', clientId, nextId, {
        clientId:         clientId,
        dockName:         dockName,
        berthNumber:      berthNumber,
        length:           length,
        width:            width,
        depth:            depth,
        maxAirDraft:      0,
        hasElectric:      hasElectric,
        hasWater:         hasWater,
        status:           validStatus,
        boatId:           null,
        assignedBoatName: null,
        assignedDate:     null,
        expectedEndDate:  null,
        actualEndDate:    null,
        lockedBy:         0,
        lockedAt:         0,
        photoPath:        null,
        voiceNotePath:    null,
        lastModified:     now,
        lastModifiedBy:   String(userId ?? ''),
        syncedAt:         now
      });

      existing.add(key);
      nextId = id + 1;
      success++;

      if (onProgress) onProgress(success, skipped, rows.length);

    } catch (err) {
      console.error('[berth import] row failed', i, err);
      errors.push(`Row ${i + 2}: ${err.message || 'unknown error'}`);
    }
  }

  return { success, skipped, failed: errors.length, errors };
}

function parseBool(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

/* ============================================================
   BERTH BOOKING REQUESTS
   ============================================================ */
export function listenForBookingRequests(clientId, callback) {
  if (!clientId || clientId <= 0) {
    callback([], null);
    return () => {};
  }

  const q = query(
    collection(db, 'berth_booking_requests'),
    where('clientId', '==', clientId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const requests = snap.docs.map((d) => {
        const data = d.data();
        return new BerthBookingRequest({
          ...data,
          id: Number(data.id ?? d.id),
          _docId: d.id
        });
      });
      callback(requests, null);
    },
    (err) => {
      console.error('listenForBookingRequests error', err);
      callback([], err);
    }
  );
}

/* ============================================================
   BERTH WRITE OPERATIONS
   ============================================================ */

export async function updateBerthStatus(clientId, berthId, newStatus, userId) {
  const data = {
    status: newStatus,
    lastModified: Date.now(),
    lastModifiedBy: String(userId ?? ''),
    syncedAt: 0
  };

  // Clear boat assignment if moving away from OCCUPIED (matches Android)
  if (newStatus !== 'OCCUPIED') {
    data.boatId = null;
    data.assignedBoatName = null;
  }

  await updateDoc(doc(db, 'berths', String(berthId)), data);
  console.log('[db] Berth', berthId, 'status →', newStatus);
}

export async function updateBerth(berthId, userId, fields) {
  await updateDoc(doc(db, 'berths', String(berthId)), {
    dockName:     fields.dockName,
    berthNumber:  fields.berthNumber,
    length:       Number(fields.length) || 0,
    width:        Number(fields.width)  || 0,
    depth:        Number(fields.depth)  || 0,
    hasElectric:  !!fields.hasElectric,
    hasWater:     !!fields.hasWater,
    shorePowerAmps: fields.hasElectric ? (fields.shorePowerAmps ?? null) : null,
    shorePowerVoltage: fields.hasElectric ? (fields.shorePowerVoltage ?? null) : null,
    shorePowerPhase: fields.hasElectric ? (fields.shorePowerPhase || null) : null,
    shorePowerConnections: fields.hasElectric ? (fields.shorePowerConnections ?? null) : null,
    status:       (fields.status || 'AVAILABLE').toUpperCase(),
    lastModified: Date.now(),
    lastModifiedBy: String(userId ?? ''),
    syncedAt: 0
  });
  console.log('[db] Berth', berthId, 'updated');
}

export async function deleteBerth(berthId) {
  await deleteDoc(doc(db, 'berths', String(berthId)));
  console.log('[db] Deleted berth', berthId);
}

/* ============================================================
   ASSIGN BOAT TO BERTH
   Mirrors BoatFragment.saveAssignmentWithDates()
   ============================================================ */
export async function assignBoatToBerth(berthId, boat, userId) {
  await updateDoc(doc(db, 'berths', String(berthId)), {
    boatId:           Number(boat.id),
    assignedBoatName: boat.name || '',
    status:           'OCCUPIED',
    assignedDate:     Date.now(),
    actualEndDate:    null,
    lastModified:     Date.now(),
    lastModifiedBy:   String(userId ?? ''),
    syncedAt:         0
  });
  console.log('[db] Boat', boat.id, 'assigned to berth', berthId);
}

export async function releaseBoatFromBerth(berthId, userId) {
  await updateDoc(doc(db, 'berths', String(berthId)), {
    boatId:           null,
    assignedBoatName: null,
    status:           'AVAILABLE',
    assignedDate:     null,
    expectedEndDate:  null,
    actualEndDate:    Date.now(),
    lastModified:     Date.now(),
    lastModifiedBy:   String(userId ?? ''),
    syncedAt:         0
  });
  console.log('[db] Boat released from berth', berthId);
}

/* ============================================================
   PORTFOLIO (multi-marina) — reads user's memberships
   ============================================================ */

/**
 * Fetch all marinas the user has access to.
 * 1. Read user_marina_memberships filtered by userId
 * 2. Fetch corresponding clients docs
 * Returns an array of { id, name, countryCode, role, isActive }
 */
export async function getMyMarinas(firebaseUid, userId = 0) {
  const uid = String(firebaseUid || '').trim();

  if (!uid) {
    return [];
  }

  /*
   * Load the authenticated identity first.
   * This always gives us the user's authorised base marina.
   */
  const identityReference = doc(
    db,
    'firebase_identities',
    uid
  );

  const identitySnapshot = await getDoc(identityReference);

  if (!identitySnapshot.exists()) {
    console.error(
      '[portfolio] Firebase identity document not found'
    );

    return [];
  }

  const identity = identitySnapshot.data();

  if (Number(identity.isActive) !== 1) {
    console.error(
      '[portfolio] Firebase identity is inactive'
    );

    return [];
  }

  const memberships = new Map();

  const baseClientId =
    Number(identity.baseClientId || 0);

  if (baseClientId > 0) {
    memberships.set(baseClientId, {
      clientId: baseClientId,
      role: identity.baseRole || 'staff'
    });
  }

  /*
   * Add any additional portfolio memberships.
   * If this query is unavailable, the base marina still loads.
   */
  try {
    const membershipQuery = query(
      collection(db, 'user_marina_memberships'),
      where('firebaseUid', '==', uid),
      where('isActive', '==', 1)
    );

    const membershipSnapshot =
      await getDocs(membershipQuery);

    membershipSnapshot.docs.forEach(
      (membershipDocument) => {
        const data = membershipDocument.data();
        const clientId = Number(data.clientId || 0);

        if (clientId > 0) {
          memberships.set(clientId, {
            clientId,
            role: data.role || 'staff'
          });
        }
      }
    );
  } catch (error) {
    console.warn(
      '[portfolio] Additional memberships unavailable; using base marina',
      error
    );
  }

  if (!memberships.size) {
    return [];
  }

  const marinas = [];

  /*
   * Load each authorised marina separately.
   * One unavailable marina will no longer break the whole Dashboard.
   */
  for (const membership of memberships.values()) {
    try {
      const clientQuery = query(
        collection(db, 'clients'),
        where('id', '==', membership.clientId)
      );

      const clientSnapshot = await getDocs(clientQuery);

      if (clientSnapshot.empty) {
        console.warn(
          `[portfolio] Client ${membership.clientId} not found`
        );

        continue;
      }

      const client = clientSnapshot.docs[0].data();

      marinas.push({
        id: membership.clientId,
        name:
          client.name ||
          `Marina ${membership.clientId}`,
        countryCode:
          String(client.countryCode || '')
            .toUpperCase() || null,
        slug: client.slug || '',
        clientType: client.clientType,
        isActive: Number(client.isActive ?? 1),
        role: membership.role
      });
    } catch (error) {
      console.error(
        `[portfolio] Client ${membership.clientId} could not be loaded`,
        error
      );
    }
  }

  marinas.sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return marinas;
}

export async function resolveAssignedYacht(uid, userId, clientId) {
  const workspace = await getDocFromServer(doc(db, 'clients', String(clientId)));
  if (!workspace.exists() || workspace.metadata.hasPendingWrites
      || workspace.data().clientType !== 'yacht_operator') {
    throw new Error('Could not verify the yacht workspace.');
  }

  const membership = await getDocFromServer(doc(db, 'user_marina_memberships', `${uid}_${clientId}`));
  const assignment = membership.data();
  if (!assignment || membership.metadata.hasPendingWrites || assignment.firebaseUid !== uid
      || assignment.userId !== Number(userId) || assignment.clientId !== clientId
      || assignment.isActive !== 1) {
    throw new Error('Could not verify your active yacht membership.');
  }
  const boatId = assignment.boatId;
  if (!Number.isSafeInteger(boatId) || boatId <= 0) {
    throw new Error('Ask your workspace administrator to assign you a yacht.');
  }

  const boats = await getDocsFromServer(query(collection(db, 'boats'),
    where('clientId', '==', clientId), where('id', '==', boatId)));
  if (boats.size !== 1 || boats.docs[0].metadata.hasPendingWrites) {
    throw new Error('Could not verify the assigned yacht in this workspace.');
  }
  const boat = boats.docs[0];
  return { ...boat.data(), id: boatId, _docId: boat.id };
}

export async function getMarinaStats(clientId) {
  const berthsQuery = query(
    collection(db, 'berths'),
    where('clientId', '==', Number(clientId))
  );

  const berthsSnapshot = await getDocs(berthsQuery);

  let total = 0;
  let occupied = 0;
  let available = 0;
  let maintenance = 0;

  berthsSnapshot.forEach((berthDocument) => {
    const berth = berthDocument.data();
    const status = String(berth.status || '').toUpperCase();

    total++;

    if (status === 'OCCUPIED') {
      occupied++;
    } else if (status === 'AVAILABLE') {
      available++;
    } else if (status === 'MAINTENANCE') {
      maintenance++;
    }
  });

  const occupancyRate = total > 0
    ? Math.round((occupied / total) * 100)
    : 0;

  return {
    total,
    occupied,
    available,
    maintenance,
    occupancyRate
  };
}

/* ============================================================
   UTILITY READINGS
   ============================================================ */

export function listenForUtilityReadings(clientId, berthId, callback) {
  if (!clientId || !berthId) { callback([], null); return () => {}; }

  const q = query(
    collection(db, 'utility_readings'),
    where('clientId', '==', clientId),
    where('berthId', '==', berthId)
  );

  return onSnapshot(q, (snap) => {
    const readings = snap.docs.map(d => {
      const data = d.data();
      return {
        _docId:      d.id,
        id:          Number(data.id ?? d.id),
        clientId:    Number(data.clientId ?? clientId),
        berthId:     Number(data.berthId ?? berthId),
        assetId:     data.assetId == null ? null : Number(data.assetId),
        utilityType: data.utilityType || '',
        readingMode: data.readingMode || 'CUMULATIVE',
        readingType: data.readingType || '',
        value:       Number(data.value ?? 0),
        unit:        data.unit || '',
        notes:       data.notes || '',
        recordedAt:  Number(data.recordedAt ?? 0),
        source:      data.source || 'MANUAL'
        ,voidedAt:    Number(data.voidedAt || 0)
        ,voidedBy:    data.voidedBy || ''
        ,voidReason:  data.voidReason || ''
        ,correctionOf:data.correctionOf || null
      };
    });
    callback(readings, null);
  }, (err) => {
    console.error('listenForUtilityReadings error', err);
    callback([], err);
  });
}

export async function nextUtilityReadingId(clientId) {
  const q = query(collection(db, 'utility_readings'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  let max = 0;
  snap.forEach(d => {
    const n = Number(d.data().id ?? 0);
    if (n > max) max = n;
  });
  return max + 1;
}

export async function createUtilityReading(clientId, userId, fields) {
  clientId = Number(clientId);
  checkBillingClient(clientId);
  const unit = String(fields.unit || '').trim().toUpperCase();
  const mode = String(fields.readingMode || '').trim().toUpperCase();
  const type = String(fields.utilityType || '').trim().toUpperCase();
  const amount = fields.value == null || fields.value === '' ? NaN : Number(fields.value);
  const validUnit = mode==='INSTANTANEOUS'
    ? type==='ELECTRICITY' && unit==='KW' || ['WATER','WASTEWATER'].includes(type) && unit==='L/MIN'
    : type==='ELECTRICITY' && unit==='KWH' || ['WATER','WASTEWATER'].includes(type) && ['L','M3','M³'].includes(unit);
  if (!Number.isFinite(amount) || amount<0 || !validUnit || !['CUMULATIVE','INTERVAL','INSTANTANEOUS'].includes(mode))
    throw new Error('Invalid utility reading value, mode or unit');
  const newId = await nextUtilityReadingId(clientId);

  const data = {
    id:            newId,
    clientId:      clientId,
    berthId:       Number(fields.berthId),
    assetId:       null,
    utilityType:   fields.utilityType,     // ELECTRICITY | WATER | WASTEWATER
    readingType:   fields.readingType,     // ENERGY | WATER_VOLUME | WASTEWATER_VOLUME
    readingMode:   fields.readingMode,     // CUMULATIVE | INTERVAL | INSTANTANEOUS
    value:         Number(fields.value),
    unit:          fields.unit,            // kWh | L
    notes:         fields.notes || '',
    source:        'MANUAL',
    recordedAt:    Date.now(),
    lastModified:  Date.now(),
    lastModifiedBy: String(userId ?? '')
    ,correctionOf: fields.correctionOf || null
  };

  const ref = doc(db, 'utility_readings', `${clientId}_${newId}`);
  await runTransaction(db, async transaction => {
    checkBillingClient(clientId);
    if ((await transaction.get(ref)).exists()) {
      throw new Error('A reading already uses this ID. Refresh and retry; no reading was overwritten.');
    }
    checkBillingClient(clientId);
    transaction.set(ref, data);
  });
  console.log('[db] Utility reading created', newId);
  return newId;
}

export async function voidUtilityReading(clientId, reading, userId, reason = '') {
  if (Number(reading?.clientId) !== Number(clientId) || !reading?._docId) throw new Error('Invalid utility reading');
  await updateDoc(doc(db, 'utility_readings', String(reading._docId)), {
    voidedAt: Date.now(),
    voidedBy: String(userId ?? ''),
    voidReason: String(reason || '').trim(),
    lastModified: Date.now(),
    lastModifiedBy: String(userId ?? '')
  });
}

export async function correctUtilityReading(clientId, reading, userId, fields) {
  clientId = Number(clientId);
  checkBillingClient(clientId);
  if (Number(reading?.clientId) !== Number(clientId) || !reading?._docId) throw new Error('Invalid utility reading');
  const unit = String(fields.unit || '').trim().toUpperCase();
  const mode = String(fields.readingMode || '').trim().toUpperCase();
  const type = String(fields.utilityType || '').trim().toUpperCase();
  const amount = Number(fields.value);
  const validUnit = mode === 'INSTANTANEOUS'
    ? type === 'ELECTRICITY' && unit === 'KW' || ['WATER', 'WASTEWATER'].includes(type) && unit === 'L/MIN'
    : type === 'ELECTRICITY' && unit === 'KWH' || ['WATER', 'WASTEWATER'].includes(type) && ['L','M3','M³'].includes(unit);
  if (!Number.isFinite(amount) || amount < 0 || !validUnit || !['CUMULATIVE','INTERVAL','INSTANTANEOUS'].includes(mode))
    throw new Error('Invalid utility reading value, mode or unit');
  const newId = await nextUtilityReadingId(clientId);
  const now = Date.now();
  const replacement = {
    id:newId, clientId:Number(clientId), berthId:Number(fields.berthId), assetId:reading.assetId ?? null,
    utilityType:type, readingType:fields.readingType, readingMode:mode, value:amount,
    unit:fields.unit, notes:fields.notes || '', source:'MANUAL', recordedAt:Number(reading.recordedAt || now),
    correctionOf:reading._docId, createdAt:now, lastModified:now, lastModifiedBy:String(userId ?? '')
  };
  const replacementRef = doc(db, 'utility_readings', `${clientId}_${newId}`);
  const originalRef = doc(db, 'utility_readings', String(reading._docId));
  await runTransaction(db, async transaction => {
    checkBillingClient(clientId);
    const [existingReplacement, original] = await Promise.all([
      transaction.get(replacementRef), transaction.get(originalRef)
    ]);
    if (existingReplacement.exists()) {
      throw new Error('A reading already uses this ID. Refresh and retry; no reading was overwritten.');
    }
    const current = original.data();
    if (!original.exists() || Number(current.clientId) !== Number(clientId) ||
        Number(current.voidedAt || 0) > 0) {
      throw new Error('This reading changed or was already corrected. Refresh before retrying.');
    }
    checkBillingClient(clientId);
    transaction.set(replacementRef, replacement);
    transaction.update(originalRef, {
      voidedAt:now, voidedBy:String(userId ?? ''), voidReason:'Corrected', correctedBy:String(newId),
      lastModified:now, lastModifiedBy:String(userId ?? '')
    });
  });
  return newId;
}

/* ============================================================
   UTILITY TARIFFS
   ============================================================ */

/**
 * Get the active tariff for a given utility type at a given moment.
 * Returns { pricingMode, pricePerUnit, unit, effectiveFrom } or null.
 */
export async function getActiveTariff(clientId, utilityType, at = Date.now()) {
  const snap = await getDocs(query(
    collection(db, 'utility_tariffs'),
    where('clientId', '==', Number(clientId)),
    where('utilityType', '==', utilityType)
  ));
  const sorted = snap.docs.map(d => d.data())
    .filter(t => Number(t.effectiveFrom || 0) <= at
      && (t.effectiveTo == null || Number(t.effectiveTo) > at))
    .sort((a, b) => Number(b.effectiveFrom || 0) - Number(a.effectiveFrom || 0)
      || Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const t = sorted[0];
  return t ? {
    pricingMode: t.pricingMode || 'METERED',
    pricePerUnit: Number(t.pricePerUnit ?? 0),
    unit: t.unit || '', currency: savedCurrency(t.currency),
    effectiveFrom: Number(t.effectiveFrom ?? 0)
  } : null;
}

export async function prepareUtilityInvoice(clientId, berth) {
  checkBillingClient(clientId);
  const berthId = Number(berth?.id || 0);
  const boatId = Number(berth?.boatId || 0);
  if (!boatId) throw new Error('No boat assigned to this berth');

  const [readingSnap, boatSnap, chargeSnap] = await Promise.all([
    getDocsFromServer(query(
      collection(db, 'utility_readings'),
      where('clientId', '==', clientId),
      where('berthId', '==', berthId)
    )),
    getDocsFromServer(query(collection(db, 'boats'), where('clientId', '==', clientId))),
    getDocsFromServer(query(collection(db, 'utility_charges'), where('clientId', '==', clientId)))
  ]);
  checkBillingClient(clientId);

  const boatDoc = boatSnap.docs.find(d => Number(d.data().id || 0) === boatId);
  const customerId = Number(boatDoc?.data().customerId || 0);
  if (!boatDoc || !Number.isSafeInteger(customerId) || customerId <= 0)
    throw new Error('Assign a customer to this boat before generating a utility invoice');
  const readings = readingSnap.docs.map(d => ({
    _docId: d.id,
    ...d.data(),
    id: Number(d.data().id || 0),
    value: Number(d.data().value || 0),
    recordedAt: Number(d.data().recordedAt || 0)
  }));
  const existing = new Map(chargeSnap.docs.map(d => [d.data().chargeKey, {
    _docId: d.id,
    ...d.data()
  }]));
  const charges = [];

  const consumption = utilitySegments(clientId, readings);
  if (consumption.issues.some(issue => !issue.informational)) throw new Error('Utility readings need review: duplicate times, invalid units or meter drops.');
  const candidates = consumption.segments.filter(segment => segment.mode==='INTERVAL' ||
    !consumption.segments.some(other => other.key===segment.key && other.at>segment.at));
  for (const segment of candidates) {
    const {type, quantity, unit, from:previous, to:latest} = segment;
    if (quantity===0) continue;
    const tariff = await getActiveTariff(clientId, type, segment.at);
    if (!tariff) throw new Error(`No ${type.toLowerCase()} tariff is configured`);
    if (tariff.pricingMode === 'INCLUDED') continue;
    if (tariff.pricingMode !== 'METERED') throw new Error('Unsupported utility pricing mode');
    const tariffUnit = String(tariff.unit).trim().toUpperCase();
    const factor = ['WATER','WASTEWATER'].includes(type) && ['M3','M³'].includes(tariffUnit) ? 1000 : 1;
    if (!(type==='ELECTRICITY' && tariffUnit==='KWH' || ['WATER','WASTEWATER'].includes(type) && ['L','M3','M³'].includes(tariffUnit)) ||
        !Number.isFinite(tariff.pricePerUnit) || tariff.pricePerUnit<0) throw new Error('Invalid utility tariff unit or rate');
    const rate = tariff.pricePerUnit/factor;
    // Preserve existing cumulative charge keys so previously billed pairs remain billed.
    const chargeKey = segment.mode==='CUMULATIVE'
      ? `${clientId}_${berthId}_${type}_${previous.id}_${latest.id}`
      : `${clientId}_${berthId}_${type}_INTERVAL_${encodeURIComponent(latest._docId || latest.id)}`;
    let charge = existing.get(chargeKey);
    if (!charge) {
      charge = {
        _docId: chargeKey, chargeKey, clientId, berthId, boatId, customerId,
        utilityType:type, unit, readingMode:segment.mode,
        fromReadingId:previous?.id ?? null, toReadingId:latest.id,
        fromValue:previous?.value ?? null, toValue:latest.value,
        quantity, rate, currency: savedCurrency(tariff.currency), amount:quantity*rate, billed:false,
        invoiceId:null, invoiceDocId:null, createdAt:Date.now()
      };
      if (!Number.isFinite(charge.amount)) throw new Error('Invalid utility charge amount');
      const chargeRef = doc(db, 'utility_charges', chargeKey);
      charge = await runTransaction(db, async tx => {
        checkBillingClient(clientId);
        const prior = await tx.get(chargeRef);
        if (prior.exists()) return { ...prior.data(), _docId: prior.id };
        tx.set(chargeRef, charge);
        return charge;
      });
    }
    if (charge.billed !== true && Number(charge.boatId) === boatId) charges.push(charge);
  }

  if (!charges.length) throw new Error('No unbilled utility charges');

  checkBillingClient(clientId);
  const groups = new Map();
  for (const charge of charges) {
    const currency = savedCurrency(charge.currency);
    if (!groups.has(currency)) groups.set(currency, []);
    groups.get(currency).push(charge);
  }
  const drafts = [...groups].map(([currency, items]) => ({
    clientId, boatId, customerId, currency, category: 'UTILITIES',
    amount: Number(items.reduce((sum, c) => sum + Number(c.amount || 0), 0).toFixed(currencyDigits(currency))),
    description: items.map(c =>
      `${c.utilityType === 'WASTEWATER' ? itUI('Wastewater') : c.utilityType === 'WATER' ? itUI('Water') : itUI('Electricity')}: ` +
      `${Number(c.quantity).toFixed(2)} ${c.unit} @ ` +
      `${currency} ${Number(c.rate).toFixed(4)}/${c.unit} = ${money(c.amount, currency)}`
    ).join('\n'),
    utilityChargeDocIds: items.map(c => c._docId)
  }));
  return drafts.length === 1 ? drafts[0] : { groups: drafts };
}


/* ============================================================
   SAVE TARIFFS
   ============================================================ */

export async function saveTariff(clientId, userId, fields) {
  checkBillingClient(clientId);
  const currency = await marinaCurrency(clientId);
  if (fields.currency !== currency) throw new Error('Marina currency changed. Reopen utility rates.');
  const effectiveFrom = Number(fields.effectiveFrom);
  if (!Number.isFinite(effectiveFrom) || !Number.isFinite(Number(fields.pricePerUnit)) || Number(fields.pricePerUnit) < 0)
    throw new Error('Enter a valid effective date and rate');
  const snap = await getDocs(query(
    collection(db, 'utility_tariffs'),
    where('clientId', '==', Number(clientId)),
    where('utilityType', '==', fields.utilityType)
  ));
  const future = snap.docs.map(d => Number(d.data().effectiveFrom))
    .filter(value => value > effectiveFrom).sort((a, b) => a - b)[0] || null;
  const id = Date.now();
  const tariffRef = doc(db, 'utility_tariffs', `${clientId}_${crypto.randomUUID()}`);
  await runTransaction(db, async tx => {
    checkBillingClient(clientId);
    const existing = await Promise.all(snap.docs.map(d => tx.get(d.ref)));
    for (const current of existing) {
      const t = current.data();
      if (current.exists() && Number(t.effectiveFrom) <= effectiveFrom
          && (t.effectiveTo == null || Number(t.effectiveTo) > effectiveFrom)) {
        tx.update(current.ref, { active: false, effectiveTo: effectiveFrom, updatedAt: Date.now() });
      }
    }
    tx.set(tariffRef, {
      id, clientId: Number(clientId), currency,
      utilityType: fields.utilityType, unit: fields.unit,
      pricingMode: fields.pricingMode, pricePerUnit: Number(fields.pricePerUnit),
      effectiveFrom, effectiveTo: future, active: future == null,
      createdAt: Date.now(), updatedAt: Date.now(), lastModifiedBy: String(userId || '')
    });
  });
}

/* ============================================================
   USERS
   ============================================================ */
export function listenForUsers(clientId, callback) {
  if (!clientId || clientId <= 0) { callback([], null); return () => {}; }

  const q = query(
    collection(db, 'users'),
    where('clientId', '==', clientId)
  );

  return onSnapshot(q, (snap) => {
    const users = snap.docs.map(d => {
      const data = d.data();
      return {
        _docId:        d.id,
        id:            Number(data.userId ?? data.id ?? d.id),
        name:          data.name  || '',
        email:         data.email || '',
        role:          data.role  || 'staff',
        clientId:      Number(data.clientId ?? clientId)
      };
    });
    callback(users, null);
  }, (err) => {
    console.error('listenForUsers error', err);
    callback([], err);
  });
}

/* ============================================================
   CUSTOMER CREATION AND BULK IMPORT
   ============================================================ */
export async function createCustomer(clientId, userId, fields) {
  const cid = Number(clientId);
  const snap = await getDocs(query(collection(db, 'customers'), where('clientId', '==', cid)));
  let maxId = 0;
  snap.forEach(d => {
    const id = Number(d.data().id || 0);
    if (id > maxId) maxId = id;
  });

  const now = Date.now();
  return createNumberedRecord('customers', cid, maxId + 1, {
    clientId: cid,
    name: fields.name,
    email: fields.email || '',
    phone: fields.phone || '',
    notes: fields.notes || '',
    isPreferred: !!fields.isPreferred,
    createdDate: now,
    lastModified: now,
    lastModifiedBy: String(userId || 0),
    syncTime: serverTimestamp(),
    syncedAt: 0
  });
}

export async function importCustomersFromRows(clientId, userId, rows, onProgress) {
  const cid = Number(clientId);

  // 1. Load existing customers for duplicate detection
  const existingSnap = await getDocs(
    query(collection(db, 'customers'), where('clientId', '==', cid))
  );

  const existingNames = new Set();
  const existingEmails = new Set();
  let maxId = 0;

  existingSnap.forEach(d => {
    const data = d.data();
    const n = (data.name  || '').trim().toLowerCase();
    const e = (data.email || '').trim().toLowerCase();
    if (n) existingNames.add(n);
    if (e) existingEmails.add(e);
    const v = Number(data.id || 0);
    if (v > maxId) maxId = v;
  });

  let nextId = maxId + 1;
  let success = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 2; // +1 header +1 zero-index

    try {
      const name  = (row.name  || '').trim();
      const email = (row.email || '').trim();
      const phone = (row.phone || '').trim();
      const notes = (row.notes || '').trim();

      if (!name) {
        errors.push(`Line ${lineNo}: name is required`);
        skipped++;
        continue;
      }

      // Duplicate check — name OR email
      const lowerName  = name.toLowerCase();
      const lowerEmail = email.toLowerCase();

      if (existingNames.has(lowerName) ||
          (lowerEmail && existingEmails.has(lowerEmail))) {
        skipped++;
        onProgress(success, skipped, rows.length);
        continue;
      }

      const now = Date.now();
      const id = await createNumberedRecord('customers', cid, nextId, {
        clientId: cid,
        name,
        email,
        phone,
        notes,
        isPreferred: false,
        createdDate: now,
        lastModified: now,
        lastModifiedBy: String(userId || 0),
        syncTime: serverTimestamp(),
        syncedAt: 0
      });

      existingNames.add(lowerName);
      if (lowerEmail) existingEmails.add(lowerEmail);
      nextId = id + 1;
      success++;
    } catch (err) {
      console.error('[import customers] row failed', err);
      errors.push(`Line ${lineNo}: ${err.message || 'write failed'}`);
    }

    onProgress(success, skipped, rows.length);
  }

  return { success, skipped, failed: errors.length, errors };
}

/* ============================================================
   CREW BULK IMPORT
   ============================================================ */
let lastCrewId = 0;

export async function createCrewMember(clientId, boatId, userId, { name, email, role, notes }) {
  const now = Date.now();
  // Keep the numeric ID used by crew links, independently of the Firestore document ID.
  const suffix = crypto.getRandomValues(new Uint16Array(1))[0] & 1023;
  const id = lastCrewId = Math.max(lastCrewId + 1, now * 1024 + suffix);
  await setDoc(doc(collection(db, 'crew')), {
    id,
    clientId: Number(clientId),
    boatId: Number(boatId),
    name,
    email,
    role: role || '',
    notes: notes || '',
    status: 'OFF DUTY',
    createdAt: now,
    lastModified: now,
    lastModifiedBy: String(userId || 0),
    syncTime: serverTimestamp(),
    syncedAt: 0
  });
  return id;
}

export async function importCrewFromRows(clientId, userId, rows, onProgress, assignedBoatId = 0) {
  const cid = Number(clientId);

  // Load existing crew for duplicate detection
  const existingSnap = await getDocs(
    query(collection(db, 'crew'), where('clientId', '==', cid))
  );

  const existingKeys = new Set(); // "name|email" lowercase

  existingSnap.forEach(d => {
    const data = d.data();
    const n = (data.name  || '').trim().toLowerCase();
    const e = (data.email || '').trim().toLowerCase();
    if (n && e && (!assignedBoatId || data.boatId === assignedBoatId)) existingKeys.add(`${n}|${e}`);
  });

  // Find active boat to associate
  let boatId = assignedBoatId || 0;
  if (!boatId) try {
    const boatsSnap = await getDocs(
      query(
        collection(db, 'boats'),
        where('clientId', '==', cid),
        where('isActive', '==', true)
      )
    );
    if (!boatsSnap.empty) {
      boatId = Number(boatsSnap.docs[0].data().id || 0);
    }
  } catch { /* ignore */ }

  let success = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 2;

    try {
      const name  = (row.name  || '').trim();
      const email = (row.email || '').trim();
      const role  = (row.role  || '').trim();
      const notes = (row.notes || '').trim();

      if (!name)  { errors.push(`Line ${lineNo}: name is required`); skipped++; continue; }
      if (!email) { errors.push(`Line ${lineNo}: email is required`); skipped++; continue; }

      const key = `${name.toLowerCase()}|${email.toLowerCase()}`;
      if (existingKeys.has(key)) {
        skipped++;
        onProgress(success, skipped, rows.length);
        continue;
      }

      await createCrewMember(cid, boatId, userId, { name, email, role, notes });
      existingKeys.add(key);
      success++;
    } catch (err) {
      console.error('[import crew] row failed', err);
      errors.push(`Line ${lineNo}: ${err.message || 'write failed'}`);
    }

    onProgress(success, skipped, rows.length);
  }

  return { success, skipped, failed: errors.length, errors };
}

/* ============================================================
   DOCUMENT BULK IMPORT
   ============================================================ */
export async function importDocumentsFromRows(clientId, userId, boatId, rows, onProgress) {
  const {
    collection, query, where, getDocs, doc, setDoc, serverTimestamp
  } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { db } = await import('./firebase.js');

  const cid = Number(clientId);

  const existingSnap = await getDocs(
    query(collection(db, 'documents'), where('clientId', '==', cid))
  );

  const existingKeys = new Set();   // name|type lowercase
  let maxId = 0;

  existingSnap.forEach(d => {
    const data = d.data();
    const n = (data.name || '').trim().toLowerCase();
    const t = (data.type || '').trim().toLowerCase();
    if (n) existingKeys.add(`${n}|${t}`);
    const v = Number(data.id || 0);
    if (v > maxId) maxId = v;
  });

  let nextId = maxId + 1;
  let success = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNo = i + 2;

    try {
      const name        = (row.name   || '').trim();
      const type        = (row.type   || '').trim();
      const expiryRaw   = (row.expiry || '').trim();
      const notes       = (row.notes  || '').trim();
      const filePath    = (row.file   || '').trim();

      if (!name) { errors.push(`Line ${lineNo}: name is required`); skipped++; continue; }
      if (!type) { errors.push(`Line ${lineNo}: type is required`); skipped++; continue; }

      const key = `${name.toLowerCase()}|${type.toLowerCase()}`;
      if (existingKeys.has(key)) {
        skipped++;
        onProgress(success, skipped, rows.length);
        continue;
      }

      let expiryMs = null;
      if (expiryRaw) {
        const parsed = parseDocumentDate(expiryRaw);
        if (parsed === null) {
          errors.push(`Line ${lineNo}: invalid date "${expiryRaw}". Use YYYY-MM-DD`);
          skipped++;
          onProgress(success, skipped, rows.length);
          continue;
        }
        expiryMs = parsed;
      }

      const now = Date.now();
      const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `d-${now}-${nextId}`);

      await setDoc(doc(db, 'documents', cloudId), {
        id: nextId,
        clientId: cid,
        boatId: Number(boatId),
        name,
        type,
        notes,
        expiryDate: expiryMs,
        filePath,
        fileName: '',
        assignedTo: '',
        lastModified: now,
        lastModifiedBy: String(userId || 0),
        syncTime: serverTimestamp(),
        syncedAt: 0
      });

      existingKeys.add(key);
      nextId++;
      success++;
    } catch (err) {
      console.error('[import documents] row failed', err);
      errors.push(`Line ${lineNo}: ${err.message || 'write failed'}`);
    }

    onProgress(success, skipped, rows.length);
  }

  return { success, skipped, failed: errors.length, errors };
}

function parseDocumentDate(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  // dd/mm/yyyy fallback
  const m2 = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) {
    const d = new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}
