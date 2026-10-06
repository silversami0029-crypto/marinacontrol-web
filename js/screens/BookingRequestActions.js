import { wireBookingDatePicker } from '../ui/BookingDatePicker.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { t, getLocale, languagePicker } from '../i18n.js';
// js/screens/BookingRequestActions.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import { confirmSheet } from '../ui/confirm.js';
import { checkFit } from '../util/BerthFitChecker.js';
import {
  collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp, getDoc, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
const manageDates = httpsCallable(getFunctions(undefined, 'us-central1'), 'manageBookingDates');

const approvalInProgress = new Set();
function actionable(request) {
  return !request.approvedBookingUuid && ['NEW', 'REVIEWING'].includes(String(request.status || 'NEW').toUpperCase());
}
/* ---------- APPROVE ---------- */

export async function approveBookingRequest(request) {
  const key = String(request._docId || '');
  if (!key || !actionable(request) || approvalInProgress.has(key)) return;
  approvalInProgress.add(key);
  try {
  const current = await getDoc(doc(db, 'berth_booking_requests', key));
  if (!current.exists() || !actionable(current.data()) || Number(current.data().clientId) !== Number(store.activeClientId)) return;
  request = { ...current.data(), _docId: key };
  if (!request.vesselName || !request.vesselName.trim()) {
    toast(tr('No vessel name on this request'), { kind: 'error' });
    return;
  }
  if (!request.arrivalDate || !request.departureDate) {
    toast(tr('Request has no dates — edit them first'), { kind: 'error' });
    return;
  }

  const clientId = Number(store.activeClientId);
  let matchedBoat = await findBoatByName(clientId, request.vesselName);

  if (!matchedBoat) {
    const confirmed = await confirmSheet({
      title: 'Vessel not registered',
      message: tr(`${request.vesselName} is not registered in MarinaControl.\n\nCreate this vessel from the request?`),
      confirmText: tr('Create'),
      cancelText: tr('Cancel')
    });
    if (!confirmed) return;
    matchedBoat = await createBoatFromRequest(clientId, request);
    if (!matchedBoat) {
      toast(tr('Could not create vessel'), { kind: 'error' });
      return;
    }
  }

  const suitable = await findSuitableBerths(clientId, matchedBoat, request.arrivalDate, request.departureDate);

  if (!suitable.length) {
    toast(tr('No compatible berths available for those dates'), { kind: 'error', duration: 4000 });
    return;
  }

  if (Number(store.activeClientId) !== clientId) return;
  showBerthPicker(suitable, matchedBoat, request);
  } catch (err) {
    console.error('[approve] failed', err);
    toast(tr('Failed to create booking'), { kind: 'error' });
  } finally {
    approvalInProgress.delete(key);
  }
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

    toast(tr(`${request.vesselName} added to MarinaControl`), { kind: 'success' });
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
<div style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${t("Suitable Berths for")} ${escapeHtml(boat.name)}</div>
      <button type="button" data-sheet-close aria-label="${t('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
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
  sheet.querySelector('[data-sheet-close]').addEventListener('click', close);
  sheet.querySelector('#bkrBerthCancel').addEventListener('click', close);

  let selected = false;
  sheet.querySelectorAll('[data-berth-docid]').forEach(row => {
    row.addEventListener('click', async () => {
      if (selected) return;
      const berthDocId = row.dataset.berthDocid;
      const berth = berths.find(b => b._docId === berthDocId);
      if (!berth) return;
      selected = true;
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

    const bookingRef = doc(collection(db, 'berth_bookings'));
    const requestRef = doc(db, 'berth_booking_requests', String(request._docId));
    const bookingData = {
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
    };
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists() || !actionable(snapshot.data())) throw new Error('Request already processed or awaiting owner agreement');
      if (Number(snapshot.data().arrivalDate) !== Number(request.arrivalDate) || Number(snapshot.data().departureDate) !== Number(request.departureDate)) throw new Error('Dates changed. Refresh and check berth availability again.');
      if (Number(snapshot.data().clientId) !== clientId || Number(store.activeClientId) !== clientId) throw new Error('Marina changed');
      transaction.set(bookingRef, bookingData);
      transaction.update(requestRef, {
        status: 'APPROVED', requestedBerthId: berth.id,
        approvedBookingUuid: bookingUuid, approvedBookingDocId: bookingRef.id,
        assignedBerthNumber: berth.berthNumber || '', berthNumber: berth.berthNumber || '',
        assignedDockName: berth.dockName || '',
        lastModified: now
      });
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

    toast(tr(`Booking confirmed for ${boat.name} at berth ${berth.berthNumber || ''}`), { kind: 'success', duration: 4000 });
  } catch (err) {
    console.error('[approve] booking creation failed', err);
    toast(tr('Failed to create booking'), { kind: 'error' });
  }
}

/* ---------- MORE MENU ---------- */

export function showRequestMoreMenu(request) {
  if (request.approvedBookingUuid || !['NEW', 'REVIEWING', 'AWAITING_OWNER'].includes(request.status)) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${escapeHtml(request.vesselName || 'Request')}</div>
      <button type="button" data-sheet-close aria-label="${t('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="sheet-item" id="bkrActEdit">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t(request.dateProposal?.state === 'PENDING' ? 'Review date proposal' : 'Edit Dates')}</div></div>
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
  sheet.querySelector('[data-sheet-close]').addEventListener('click', close);

  sheet.querySelector('#bkrActEdit').addEventListener('click', () => {
    close();
    if (String(request.source).toUpperCase() === 'WHATSAPP') showDateProposal(request);
    else showEditDates(request);
  });


  sheet.querySelector('#bkrActDecline').addEventListener('click', async () => {
    close();
    const ok = await confirmSheet({
      title: 'Decline request?',
      message: tr(`Decline the berth request for ${request.vesselName || 'this vessel'}?`),
      confirmText: tr('Decline'),
      cancelText: tr('Cancel')
    });
    if (!ok) return;
    await declineRequest(request);
  });
}

function showEditDates(request) {
  if (request.dateProposal?.state === 'PENDING') { toast(tr('Resolve or withdraw the current proposal first'), {kind:'error'}); return; }
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const arrivalStr   = toInputDate(request.arrivalDate);
  const departureStr = toInputDate(request.departureDate);

  sheet.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${t("Edit Dates")}</div>
      <button type="button" data-sheet-close aria-label="${t('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

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

  const calendars = [];
  for (const [id, label] of [['dpArrival','Proposed arrival'],['dpDeparture','Proposed departure'],['bkrArrival','Arrival'],['bkrDeparture','Departure']]) {
    const input = sheet.querySelector('#' + id);
    if (input) calendars.push(wireBookingDatePicker(input, {label:tr(label),locale:getLocale()}));
  }
  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    calendars.forEach(c => c.close());
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('[data-sheet-close]').addEventListener('click', close);

  sheet.querySelector('#bkrDatesForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const aStr = sheet.querySelector('#bkrArrival').value;
    const dStr = sheet.querySelector('#bkrDeparture').value;

    if (!aStr || !dStr) { toast(tr('Both dates required'), { kind: 'error' }); return; }

    const arrival   = new Date(aStr + 'T12:00:00').getTime();
    const departure = new Date(dStr + 'T12:00:00').getTime();

    if (departure <= arrival) { toast(tr('Departure must be after arrival'), { kind: 'error' }); return; }

    try {
      await manageDates({clientId: Number(store.activeClientId), requestId: request._docId, action: 'CORRECT', arrival: aStr, departure: dStr});
      close();
      toast(tr('Dates updated'), { kind: 'success' });
    } catch (err) {
      console.error('[edit dates] failed', err);
      toast(tr('Failed to update dates'), { kind: 'error' });
    }
  });
}

async function declineRequest(request) {
  if (request.dateProposal?.state === 'PENDING') { toast(tr('Resolve or withdraw the proposal before declining'), {kind:'error'}); return; }
  try {
    await updateDoc(doc(db, 'berth_booking_requests', String(request._docId)), {
      status: 'DECLINED',
      lastModified: Date.now()
    });
    toast(tr('Booking request declined'), { kind: 'success' });
  } catch (err) {
    console.error('[decline] failed', err);
    toast(tr('Failed to decline request'), { kind: 'error' });
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
function showDateProposal(request) {
  const clientId = Number(store.activeClientId);
  const pending = request.dateProposal?.state === 'PENDING';
  const p = request.dateProposal;
  const reply = request.latestOwnerReply;
  const matchingReply = p?.id && reply?.proposalId === p.id ? String(reply?.text || '') : '';
  const backdrop = document.createElement('div'); backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div'); sheet.className = 'sheet dp-sheet';
  sheet.innerHTML = `
    <style>
      .dp-sheet .dp-summary{padding:14px;margin:12px 0 18px;border:1px solid #394654;border-radius:12px;background:#151c24;line-height:1.6}
      .dp-sheet .dp-summary strong{display:block;font-size:17px;color:#f5f7f9}
      .dp-sheet .dp-hint{font-size:13px;line-height:1.5;color:#aab5c2;margin:8px 0 12px}
      .dp-sheet #dpReply{display:block;box-sizing:border-box;width:100%;min-height:120px;padding:12px;border:1px solid #657587;border-radius:10px;background:#111923;color:#f5f7f9;font:inherit;font-size:14px;line-height:1.5;resize:vertical;margin:8px 0}
      .dp-sheet #dpReply::placeholder{color:#aab5c2;opacity:1}
      .dp-sheet #dpReply:focus{outline:2px solid #2e9bff;outline-offset:2px}
      .dp-sheet .dp-actions{display:grid;gap:10px;margin:18px 0}
      .dp-sheet .dp-action{appearance:none;box-sizing:border-box;width:100%;min-height:44px;padding:11px 14px;border:1px solid #596979;border-radius:10px;background:#283442;color:#f5f7f9;font:inherit;font-weight:600;cursor:pointer;text-align:center}
      .dp-sheet .dp-action[data-action=ACCEPT]{background:#258be0;border-color:#258be0;color:#fff}
      .dp-sheet .dp-action[data-action=REJECT]{border-color:#dd8383;color:#ffd4d4}
      .dp-sheet .dp-action[data-action=WITHDRAW]{background:transparent;color:#c4ced8}
      .dp-sheet .dp-action:focus-visible{outline:2px solid #fff;outline-offset:2px}
      .dp-sheet .dp-action:disabled{opacity:.45;cursor:not-allowed}
    </style>
    <div style="display:flex;align-items:center;min-height:48px;">
      <div class="sheet-title" style="flex:1;margin:0;">${tr(pending ? 'Review date proposal' : 'Edit Dates')}</div>
      <button type="button" id="dpClose" aria-label="${tr('Close')}" style="background:transparent;border:0;color:inherit;font-size:26px;width:44px;height:44px;">×</button>
    </div>
    <form class="add-form" id="dpForm"><div class="add-scroll">
      <p style="font-size:13px;color:var(--color-text-secondary,#AAB5C2);">${tr('Send alternative dates to the owner for agreement. The booking remains unconfirmed.')}</p>
      ${pending ? `<div class="dp-summary"><span>${tr('Awaiting owner agreement')}</span><strong>${escapeHtml(formatDate(p.arrivalDate))} → ${escapeHtml(formatDate(p.departureDate))}</strong><span>${tr('WhatsApp submission')}: ${escapeHtml(p.delivery || 'UNKNOWN')}</span></div>
        ${p.error ? `<p>${escapeHtml(p.error)}</p>` : ''}
        <label class="add-label" for="dpReply">${tr("Owner's response")}</label>
        <textarea class="add-input" id="dpReply" aria-describedby="dpReplyHint" maxlength="1000" placeholder="${tr('Type or paste the owner’s response here…')}" rows="4">${escapeHtml(matchingReply)}</textarea>
        <p class="dp-hint" id="dpReplyHint">${tr(matchingReply ? 'WhatsApp reply filled in. Review it, then choose an action below.' : 'Enter the response you received, then choose an action below.')}</p>
        <p class="dp-hint">${tr('Record acceptance only if the owner agreed to these exact dates. Staff must still approve the booking.')}</p>
        <div class="dp-actions">
          <button type="button" class="dp-action" data-action="ACCEPT" ${p.delivery !== 'SENT' ? 'disabled' : ''}>${tr('Record owner acceptance')}</button>
          <button type="button" class="dp-action" data-action="REJECT" ${p.delivery !== 'SENT' ? 'disabled' : ''}>${tr('Record owner rejection')}</button>
          <button type="button" class="dp-action" data-action="WITHDRAW">${tr('Withdraw proposal')}</button>
        </div>
        <p class="dp-hint">${tr('Withdrawal is internal only. Contact the owner if they received the proposal. A failed or unknown send may still have reached them.')}</p>` : `
        <label class="add-label" for="dpArrival">${tr('Proposed arrival')}</label>
        <input class="add-input" id="dpArrival" type="date" required value="${toInputDate(request.arrivalDate)}">
        <label class="add-label" for="dpDeparture">${tr('Proposed departure')}</label>
        <input class="add-input" id="dpDeparture" type="date" required value="${toInputDate(request.departureDate)}">
        <p style="font-size:12px;color:var(--color-text-secondary,#AAB5C2);">${tr('Original dates stay unchanged until the owner agrees.')}</p>
        <button type="submit" class="add-save">${tr('Send proposed dates')}</button>`}
    </div></form>`;
  const calendars = [];
  for (const [id, label] of [['dpArrival','Proposed arrival'],['dpDeparture','Proposed departure'],['bkrArrival','Arrival'],['bkrDeparture','Departure']]) {
    const input = sheet.querySelector('#' + id);
    if (input) calendars.push(wireBookingDatePicker(input, {label:tr(label),locale:getLocale()}));
  }
  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => { backdrop.classList.add('is-open'); sheet.classList.add('is-open'); });
  let busy = false;
  const close = () => { if (busy) return; calendars.forEach(c => c.close()); backdrop.remove(); sheet.remove(); };
  backdrop.onclick = close; sheet.querySelector('#dpClose').onclick = close;
  const send = async (action) => {
    if (busy || Number(store.activeClientId) !== clientId) return;
    const responseNote = sheet.querySelector('#dpReply')?.value.trim() || '';
    if (['ACCEPT', 'REJECT'].includes(action) && !responseNote) { toast(tr("Record the owner's reply first"), {kind:'error'}); sheet.querySelector("#dpReply")?.focus(); return; }
    if (action !== 'PROPOSE') {
      const ok = await confirmSheet({title: tr('Confirm date action'), message: tr(action === 'ACCEPT' ? 'Record the owner’s agreement to these exact dates? Staff must still approve the booking.' : action === 'REJECT' ? 'Record the owner’s rejection of these dates?' : 'Withdraw this proposal internally? Contact the owner separately if needed.'), confirmText:tr('Confirm'), cancelText:tr('Cancel')});
      if (!ok || busy) return;
    }
    busy = true; sheet.querySelectorAll('button,input,textarea').forEach(el => el.disabled = true);
    try {
      const result = await manageDates({clientId, requestId:request._docId, action,
        proposalId:p?.id, responseNote,
        arrival:sheet.querySelector('#dpArrival')?.value,
        departure:sheet.querySelector('#dpDeparture')?.value});
      busy = false; close();
      toast(tr(result.data.ok ? (action === 'PROPOSE' ? 'Proposal submitted to WhatsApp. Awaiting owner agreement.' : 'Date response recorded. Booking is not yet confirmed.') : 'Sending failed or is uncertain. Review the proposal before sending again.'), {kind:result.data.ok ? 'success' : 'error',duration:6000});
    } catch (error) {
      busy = false; sheet.querySelectorAll('button,input,textarea').forEach(el => el.disabled = false);
      if (pending && p.delivery !== 'SENT') sheet.querySelectorAll('[data-action="ACCEPT"],[data-action="REJECT"]').forEach(el => el.disabled = true);
      toast(error.message || tr('Could not update date proposal'), {kind:'error',duration:6000});
    }
  };
  sheet.querySelector('#dpForm').onsubmit = e => { e.preventDefault(); send('PROPOSE'); };
  sheet.querySelectorAll('[data-action]').forEach(button => button.onclick = () => send(button.dataset.action));
}
