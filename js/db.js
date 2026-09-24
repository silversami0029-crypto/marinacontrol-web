// js/db.js
import {
  db,
  collection, query, where, onSnapshot,
  doc, getDoc, getDocs, writeBatch, deleteDoc, setDoc, updateDoc
} from './firebase.js';
import { Boat } from './models/Boat.js';
import { BerthBookingRequest } from './models/BerthBookingRequest.js';

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
  const newId = await nextBerthId(clientId);

  const data = {
    id:              newId,
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

  await setDoc(doc(db, 'berths', String(newId)), data);
  return newId;
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

      await setDoc(doc(db, 'berths', String(nextId)), {
        id:               nextId,
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
      nextId++;
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
        utilityType: data.utilityType || '',
        readingMode: data.readingMode || 'CUMULATIVE',
        readingType: data.readingType || '',
        value:       Number(data.value ?? 0),
        unit:        data.unit || '',
        notes:       data.notes || '',
        recordedAt:  Number(data.recordedAt ?? 0),
        source:      data.source || 'MANUAL'
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
  const newId = await nextUtilityReadingId(clientId);

  const data = {
    id:            newId,
    clientId:      clientId,
    berthId:       Number(fields.berthId),
    assetId:       null,
    utilityType:   fields.utilityType,     // ELECTRICITY | WATER
    readingType:   fields.readingType,     // ENERGY | WATER_VOLUME
    readingMode:   fields.readingMode,     // CUMULATIVE | INTERVAL | INSTANTANEOUS
    value:         Number(fields.value),
    unit:          fields.unit,            // kWh | L
    notes:         fields.notes || '',
    source:        'MANUAL',
    recordedAt:    Date.now(),
    lastModified:  Date.now(),
    lastModifiedBy: String(userId ?? '')
  };

  await setDoc(doc(db, 'utility_readings', String(newId)), data);
  console.log('[db] Utility reading created', newId);
  return newId;
}

/* ============================================================
   UTILITY TARIFFS
   ============================================================ */

/**
 * Get the active tariff for a given utility type at a given moment.
 * Returns { pricingMode, pricePerUnit, unit, effectiveFrom } or null.
 */
export async function getActiveTariff(clientId, utilityType) {
  const q = query(
    collection(db, 'utility_tariffs'),
    where('clientId', '==', clientId),
    where('utilityType', '==', utilityType),
    where('active', '==', true)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  // If multiple active, prefer the most recent by effectiveFrom
  const sorted = snap.docs
    .map(d => d.data())
    .sort((a, b) => (b.effectiveFrom || 0) - (a.effectiveFrom || 0));

  const t = sorted[0];

  return {
    pricingMode:  t.pricingMode || 'METERED',
    pricePerUnit: Number(t.pricePerUnit ?? 0),
    unit:         t.unit || '',
    effectiveFrom: Number(t.effectiveFrom ?? 0)
  };
}