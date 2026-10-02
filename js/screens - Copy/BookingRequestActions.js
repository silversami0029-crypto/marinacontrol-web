import { t, getLocale, languagePicker } from '../i18n.js';
// js/screens/BookingRequestActions.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import { confirmSheet } from '../ui/confirm.js';
import { checkFit } from '../util/BerthFitChecker.js';
import {
  collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

/* ---------- APPROVE ---------- */

export async function approveBookingRequest(request) {
  if (!request.vesselName || !request.vesselName.trim()) {
    toast('No vessel name on this request', { kind: 'error' });
    return;
  }
  if (!request.arrivalDate || !request.departureDate) {
    toast('Request has no dates — edit them first', { kind: 'error' });
    return;
  }

  const clientId = Number(store.activeClientId);
  let matchedBoat = await findBoatByName(clientId, request.vesselName);

  if (!matchedBoat) {
    const confirmed = await confirmSheet({
      title: 'Vessel not registered',
      message: `${request.vesselName} is not registered in MarinaControl.\n\nCreate this vessel from the request?`,
      confirmText: 'Create',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;
    matchedBoat = await createBoatFromRequest(clientId, request);

    if (!confirmed) return;
    matchedBoat = await createBoatFromRequest(clientId, request);
    if (!matchedBoat) {
      toast('Could not create vessel', { kind: 'error' });
      return;
    }
  }

  const suitable = await findSuitableBerths(clientId, matchedBoat, request.arrivalDate, request.departureDate);

  if (!suitable.length) {
    toast('No compatible berths available for those dates', { kind: 'error', duration: 4000 });
    return;
  }

  showBerthPicker(suitable, matchedBoat, request);
}

async function findBoatByName(clientId, vesselName) {
  try {
    const snap = await getDocs(query(collection(db, 'boats'), where('clientId', '==', clientId)));
    const lower = vesselName.trim().toLowerCase();
    return snap.docs
      .map(d => ({ _docId: d.id, ...d.data(), id: Number(d.data().id || 0) }))
      .find(b => (b.name || '').trim().toLowerCase() === lower) || null;
  } catch (err) {
    console.error('[approve] boat lookup failed', err);
    return null;
  }
}

async function createBoatFromRequest(clientId, request) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `boat-${now}`);

    await addDoc(collection(db, 'boats'), {
      id: now,
      clientId,
      customerId: 0,
      name: request.vesselName.trim(),
      type: 'Unknown',
      engineType: 'Unknown',
      status: 'In Service',
      isActive: false,
      isSample: false,
      port: '',
      hin: 'UNKNOWN-HIN',
      mmsi: null,
      length: Number(request.vesselLength || 0),
      beam: Number(request.vesselBeam || 0),
      draft: Number(request.vesselDraft || 0),
      airDraft: Number(request.vesselAirDraft || 0),
      lastModified: now,
      lastModifiedBy: userId,
      syncTime: serverTimestamp(),
      syncedAt: 0
    });

    toast(`${request.vesselName} added to MarinaControl`, { kind: 'success' });
    return await findBoatByName(clientId, request.vesselName);
  } catch (err) {
    console.error('[approve] boat create failed', err);
    return null;
  }
}

async function findSuitableBerths(clientId, boat, arrival, departure) {
  const suitable = [];

  try {
    const berthSnap = await getDocs(query(collection(db, 'berths'), where('clientId', '==', clientId)));

    for (const d of berthSnap.docs) {
      const berth = { _docId: d.id, ...d.data(), id: Number(d.data().id || 0) };

      if (String(berth.status || '').toUpperCase() === 'MAINTENANCE') continue;

      const fit = checkFit(boat, berth);
      if (fit.failures.length > 0) continue;

      const overlap = await countOverlapping(clientId, berth.id, arrival, departure);
      if (overlap > 0) continue;

      suitable.push({ ...berth, warnings: fit.warnings });
    }
  } catch (err) {
    console.error('[approve] berth scan failed', err);
  }

  return suitable;
}

async function countOverlapping(clientId, berthId, arrival, departure) {
  try {
    const snap = await getDocs(query(
      collection(db, 'berth_bookings'),
      where('clientId', '==', clientId),
      where('berthId', '==', berthId)
    ));

    let overlaps = 0;
    snap.forEach(d => {
      const b = d.data();
      const a = Number(b.arrivalDate || 0);
      const dep = Number(b.departureDate || 0);
      const s = String(b.status || '').toUpperCase();
      if (s === 'DECLINED' || s === 'CANCELLED') return;
      if (a < departure && dep > arrival) overlaps++;
    });
    return overlaps;
  } catch (err) {
    console.warn('[approve] overlap check failed', err?.code || err?.message || err);
    return 0;
  }
}

function showBerthPicker(berths, boat, request) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Suitable Berths for ${escapeHtml(boat.name)}</div>

    <div class="ao-scroll">
      ${berths.map(b => `
        <button type="button" class="ao-row" data-berth-docid="${b._docId}">
          <span class="ao-radio"></span>
          <span class="ao-name">
            ${escapeHtml(b.berthNumber || '')}${b.dockName ? ' · ' + escapeHtml(b.dockName) : ''}
            ${b.warnings && b.warnings.length ? `<br><span style="font-size:11px;color:#F5A524;">${escapeHtml(b.warnings.join(', '))}</span>` : ''}
          </span>
        </button>
      `).join('')}
    </div>

    <div class="ao-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="bkrBerthCancel">${t("Cancel")}</button>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('#bkrBerthCancel').addEventListener('click', close);

  sheet.querySelectorAll('[data-berth-docid]').forEach(row => {
    row.addEventListener('click', async () => {
      const berthDocId = row.dataset.berthDocid;
      const berth = berths.find(b => b._docId === berthDocId);
      if (!berth) return;
      close();
      await createBooking(request, boat, berth);
    });
  });
}

async function createBooking(request, boat, berth) {
  try {
    const clientId = Number(store.activeClientId);
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    const bookingUuid = crypto.randomUUID ? crypto.randomUUID() : `bkg-${now}`;

    await addDoc(collection(db, 'berth_bookings'), {
      id: now,
      bookingUuid,
      clientId,
      berthId: berth.id,
      boatId: boat.id,
      customerId: boat.customerId || null,
      vesselName: boat.name || '',
      vesselMmsi: boat.mmsi || null,
      vesselLength: Number(boat.length || 0),
      vesselBeam: Number(boat.beam || 0),
      vesselDraft: Number(boat.draft || 0),
      vesselAirDraft: Number(boat.airDraft || 0),
      captainName: request.senderName || '',
      captainEmail: null,
      captainPhone: request.senderPhone || '',
      arrivalDate: request.arrivalDate,
      departureDate: request.departureDate,
      eta: null,
      status: 'CONFIRMED',
      source: request.source || 'STAFF',
      notes: request.message || '',
      createdAt: now,
      lastModified: now,
      lastModifiedBy: userId,
      syncTime: serverTimestamp(),
      syncedAt: 0
    });

    await updateDoc(doc(db, 'berth_booking_requests', String(request._docId)), {
      status: 'APPROVED',
      requestedBerthId: berth.id,
      lastModified: now
    });

    await logHistory({
      entityType: 'BOOKING_REQUEST',
      entityId: request.id,
      itemName: boat.name,
      boatId: boat.id,
      action: 'APPROVED',
      title: 'Booking request approved',
      detail: `Berth ${berth.berthNumber || ''} · ${formatDate(request.arrivalDate)} → ${formatDate(request.departureDate)}`
    });

    toast(`Booking confirmed for ${boat.name} at berth ${berth.berthNumber || ''}`, { kind: 'success', duration: 4000 });
  } catch (err) {
    console.error('[approve] booking creation failed', err);
    toast('Failed to create booking', { kind: 'error' });
  }
}

/* ---------- MORE MENU ---------- */

export function showRequestMoreMenu(request) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(request.vesselName || 'Request')}</div>

    <div class="sheet-item" id="bkrActEdit">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Edit Dates")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="bkrActDecline">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Decline Request")}</div></div>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);

  sheet.querySelector('#bkrActEdit').addEventListener('click', () => {
    close();
    showEditDates(request);
  });

  sheet.querySelector('#bkrActDecline').addEventListener('click', async () => {
    close();
    const ok = await confirmSheet({
      title: 'Decline request?',
      message: `Decline the berth request for ${request.vesselName || 'this vessel'}?`,
      confirmText: 'Decline',
      cancelText: 'Cancel'
    });
    if (!ok) return;
    await declineRequest(request);
  });
}

function showEditDates(request) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const arrivalStr   = toInputDate(request.arrivalDate);
  const departureStr = toInputDate(request.departureDate);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${t("Edit Dates")}</div>

    <form id="bkrDatesForm" class="add-form">
      <div class="add-scroll">
        <label class="add-label" for="bkrArrival">${t("Arrival")}</label>
        <input class="add-input" id="bkrArrival" type="date" value="${arrivalStr}">

        <label class="add-label" for="bkrDeparture">${t("Departure")}</label>
        <input class="add-input" id="bkrDeparture" type="date" value="${departureStr}">
      </div>
      <button type="submit" class="add-save" id="bkrDatesSave">${t("Save Dates")}</button>
    </form>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);

  sheet.querySelector('#bkrDatesForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const aStr = sheet.querySelector('#bkrArrival').value;
    const dStr = sheet.querySelector('#bkrDeparture').value;

    if (!aStr || !dStr) { toast('Both dates required', { kind: 'error' }); return; }

    const arrival   = new Date(aStr + 'T12:00:00').getTime();
    const departure = new Date(dStr + 'T12:00:00').getTime();

    if (departure <= arrival) { toast('Departure must be after arrival', { kind: 'error' }); return; }

    try {
      await updateDoc(doc(db, 'berth_booking_requests', String(request._docId)), {
        arrivalDate: arrival,
        departureDate: departure,
        lastModified: Date.now()
      });
      close();
      toast('Dates updated', { kind: 'success' });
    } catch (err) {
      console.error('[edit dates] failed', err);
      toast('Failed to update dates', { kind: 'error' });
    }
  });
}

async function declineRequest(request) {
  try {
    await updateDoc(doc(db, 'berth_booking_requests', String(request._docId)), {
      status: 'DECLINED',
      lastModified: Date.now()
    });
    toast('Booking request declined', { kind: 'success' });
  } catch (err) {
    console.error('[decline] failed', err);
    toast('Failed to decline request', { kind: 'error' });
  }
}

/* ---------- Helpers ---------- */

function toInputDate(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  return d.toISOString().slice(0, 10);
}

function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  return d.toLocaleDateString(getLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}