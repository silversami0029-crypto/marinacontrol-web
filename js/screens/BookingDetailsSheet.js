import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const ACTIVE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN']);

export async function findActiveBookingForBerth(clientId, berthId) {
  const snapshot = await getDocs(query(
    collection(db, 'berth_bookings'),
    where('clientId', '==', Number(clientId)),
    where('berthId', '==', Number(berthId))
  ));

  const bookings = snapshot.docs
    .map(item => ({ _docId: item.id, ...item.data() }))
    .filter(item => ACTIVE_STATUSES.has(normaliseStatus(item.status)))
    .sort(compareBookings);

  return bookings[0] || null;
}

export function showBookingDetailsSheet({
  booking,
  berth,
  onCheckedIn
}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const status = normaliseStatus(booking.status);
  const canCheckIn = status === 'CONFIRMED';

  sheet.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${tr('Booking Details')}</div>
      <button type="button" data-sheet-close aria-label="${tr('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="bkr-detail-body">
      <div class="bkr-detail-row"><span>${tr('Vessel')}</span><b>${escapeHtml(booking.vesselName || 'Unknown vessel')}</b></div>
      <div class="bkr-detail-row"><span>${tr('Berth')}</span><b>${escapeHtml(formatBerth(berth))}</b></div>
      <div class="bkr-detail-row"><span>${tr('Arrival')}</span><b>${escapeHtml(formatDate(booking.arrivalDate))}</b></div>
      <div class="bkr-detail-row"><span>${tr('Departure')}</span><b>${escapeHtml(formatDate(booking.departureDate))}</b></div>
      <div class="bkr-detail-row"><span>${tr('Status')}</span><b>${escapeHtml(status)}</b></div>
      <div class="bkr-detail-row"><span>${tr('Source')}</span><b>${escapeHtml(booking.source || 'STAFF')}</b></div>
    </div>

    ${canCheckIn ? `
      <button type="button" class="add-save" id="bookingCheckIn" style="margin-top:12px;">${tr('Check In')}</button>
    ` : ''}

    <div class="ao-actions" style="margin-top:8px;">
      <button type="button" class="csv-btn csv-btn--cancel" data-sheet-close>${tr('Close')}</button>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelectorAll('[data-sheet-close]').forEach(button => {
    button.addEventListener('click', close);
  });

  const checkInButton = sheet.querySelector('#bookingCheckIn');
  if (checkInButton) {
    checkInButton.addEventListener('click', async () => {
      checkInButton.disabled = true;
      checkInButton.textContent = tr('Checking in...');

      try {
        await checkInBooking(booking, berth);
        close();
        onCheckedIn?.();
      } catch (err) {
        console.error('[booking check-in] failed', err);
        toast(tr(err?.message || 'Failed to check in'), { kind: 'error' });
        checkInButton.disabled = false;
        checkInButton.textContent = tr('Check In');
      }
    });
  }

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });
}

async function checkInBooking(booking, berth) {
  const clientId = Number(store.activeClientId);
  const bookingRef = doc(
    db,
    'berth_bookings',
    String(booking._docId)
  );
  const berthRef = await resolveBerthReference(clientId, berth);
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await runTransaction(db, async transaction => {
    const [bookingSnapshot, berthSnapshot] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(berthRef)
    ]);

    if (!bookingSnapshot.exists()) {
      throw new Error('Booking no longer exists');
    }
    if (!berthSnapshot.exists()) {
      throw new Error('Berth no longer exists');
    }

    const currentBooking = bookingSnapshot.data();
    const currentBerth = berthSnapshot.data();

    if (Number(currentBooking.clientId) !== clientId ||
        Number(currentBerth.clientId) !== clientId) {
      throw new Error('Marina changed. Please reopen the booking.');
    }
    if (Number(currentBooking.berthId) !== Number(berth.id)) {
      throw new Error('Booking is linked to another berth');
    }
    if (normaliseStatus(currentBooking.status) !== 'CONFIRMED') {
      throw new Error('Only confirmed bookings can be checked in');
    }
    if (currentBerth.boatId != null &&
        Number(currentBerth.boatId) !== Number(currentBooking.boatId)) {
      throw new Error('This berth is already assigned to another vessel');
    }

    transaction.update(bookingRef, {
      status: 'CHECKED_IN',
      checkedInAt: now,
      checkedInBy: userId,
      lastModified: now,
      lastModifiedBy: userId,
      syncTime: serverTimestamp()
    });

    transaction.update(berthRef, {
      status: 'OCCUPIED',
      boatId: Number(currentBooking.boatId),
      assignedBoatName: currentBooking.vesselName || '',
      assignedDate: now,
      actualEndDate: null,
      lastModified: now,
      lastModifiedBy: userId,
      syncedAt: 0
    });
  });

  await logHistory({
    entityType: 'BOOKING',
    entityId: booking.id || booking.bookingUuid,
    itemName: booking.vesselName || 'Vessel',
    boatId: booking.boatId,
    action: 'CHECKED_IN',
    title: 'Vessel checked in',
    detail: `Berth ${berth.berthNumber || ''}`
  });
}

async function resolveBerthReference(clientId, berth) {
  if (berth._docId) {
    return doc(db, 'berths', String(berth._docId));
  }

  const snapshot = await getDocs(query(
    collection(db, 'berths'),
    where('clientId', '==', clientId),
    where('id', '==', Number(berth.id))
  ));

  if (snapshot.empty) {
    throw new Error('Berth no longer exists');
  }

  return snapshot.docs[0].ref;
}

function compareBookings(left, right) {
  const leftCheckedIn = normaliseStatus(left.status) === 'CHECKED_IN';
  const rightCheckedIn = normaliseStatus(right.status) === 'CHECKED_IN';

  if (leftCheckedIn !== rightCheckedIn) {
    return leftCheckedIn ? -1 : 1;
  }

  return Number(left.arrivalDate || 0) - Number(right.arrivalDate || 0);
}

function normaliseStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function formatBerth(berth) {
  return [berth.dockName, berth.berthNumber]
    .filter(Boolean)
    .join(' · ') || String(berth.id || '');
}

function formatDate(timestamp) {
  if (!timestamp) return tr('Not specified');
  return new Date(Number(timestamp)).toLocaleDateString(
    uiLocale(),
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}
