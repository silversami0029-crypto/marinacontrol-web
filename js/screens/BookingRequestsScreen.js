// js/screens/BookingRequestsScreen.js
// Berth Booking Requests — mirrors fragment_berth_booking_requests.xml

import { listenForBookingRequests } from '../db.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';

let unsubscribe = null;
let searchQuery = '';

export function mountBookingRequestsScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty">
         <h2>No client assigned</h2>
         <p>Your user profile doesn't include a clientId.</p>
       </div>`;
    return;
  }

  searchQuery = '';

  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="bkr-header">
      <div class="bkr-header-row">
        <div class="bkr-pill" id="bkrCount">Booking Requests: 0</div>
        <button class="bkr-icon-btn" id="bkrHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="bkr-header-spacer"></div>
        <button class="bkr-icon-btn" id="bkrSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="berth-search" id="bkrSearchBar" hidden>
      <input id="bkrSearchInput" type="text" placeholder="Search booking requests..."
             autocomplete="off">
      <button type="button" class="search-cancel" id="bkrSearchCancel">Cancel</button>
    </div>

    <div class="bkr-list" id="bkrList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  document.getElementById('bkrHelp').addEventListener('click', () => {
    toast('Booking request help coming soon');
  });

  setupSearch();

  if (unsubscribe) unsubscribe();
  unsubscribe = listenForBookingRequests(store.activeClientId, (requests, err) => {
    if (err) {
      document.getElementById('bkrList').innerHTML =
        `<div class="boats-empty">
           <h2>Couldn't load requests</h2>
           <p>${err.message || 'Permission denied.'}</p>
         </div>`;
      return;
    }

    store.bookingRequests = requests;
    renderList();
  });
}

/* ---------- Search ---------- */
function setupSearch() {
  const toggle = document.getElementById('bkrSearchToggle');
  const bar    = document.getElementById('bkrSearchBar');
  const input  = document.getElementById('bkrSearchInput');
  const cancel = document.getElementById('bkrSearchCancel');

  toggle.addEventListener('click', () => {
    bar.hidden = false;
    input.focus();
  });

  cancel.addEventListener('click', () => {
    bar.hidden = true;
    input.value = '';
    searchQuery = '';
    renderList();
  });

  input.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel.click();
  });
}

function applySearch(requests) {
  if (!searchQuery) return requests;
  const q = searchQuery.toLowerCase();
  return requests.filter((r) => {
    const hay = [
      r.vesselName, r.senderName, r.senderPhone, r.message,
      r.status, r.source
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

/* ---------- Render ---------- */
function renderList() {
  const listEl = document.getElementById('bkrList');
  const countEl = document.getElementById('bkrCount');
  const all = store.bookingRequests || [];
  const filtered = applySearch(all);

  if (countEl) countEl.textContent = `Booking Requests: ${filtered.length}`;

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="boats-empty">
        <h2>${searchQuery ? 'No matches' : 'No booking requests'}</h2>
        <p>${searchQuery
              ? `No requests match "${escapeHtml(searchQuery)}"`
              : 'Incoming berth booking requests will appear here.'}</p>
      </div>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => (b.receivedAt || 0) - (a.receivedAt || 0));
  listEl.innerHTML = sorted.map(renderRequestCard).join('');

  listEl.querySelectorAll('.bkr-card').forEach((el) => {
    const id = Number(el.dataset.requestId);
    const req = all.find(r => r.id === id);
    el.addEventListener('click', () => showDetail(req));
  });
}

function renderRequestCard(r) {
  const status = r.status || 'NEW';
  const source = r.source || 'UNKNOWN';
  const vessel = r.vesselName || 'Unknown vessel';

  const sender = r.senderName || 'Unknown sender';
  const senderLine = r.senderPhone ? `${sender} · ${r.senderPhone}` : sender;

  const arrival   = r.arrivalDate   ? formatDate(r.arrivalDate)   : 'Arrival not specified';
  const departure = r.departureDate ? formatDate(r.departureDate) : 'Departure not specified';

  const message = r.message && r.message.trim() ? r.message : 'No message';

  return `
    <div class="bkr-card" data-request-id="${esc(r.id)}">
      <div class="bkr-status">${esc(status)} · ${esc(source)}</div>
      <div class="bkr-vessel">${esc(vessel)}</div>
      <div class="bkr-sender">${esc(senderLine)}</div>
      <div class="bkr-dates">${esc(arrival)} → ${esc(departure)}</div>
      <div class="bkr-message">"${esc(message)}"</div>
    </div>
  `;
}

/* ---------- Detail sheet ---------- */
function showDetail(r) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  const arrival   = r.arrivalDate   ? formatDate(r.arrivalDate)   : 'Not specified';
  const departure = r.departureDate ? formatDate(r.departureDate) : 'Not specified';
  const vessel    = r.vesselName || 'Unknown vessel';
  const sender    = r.senderName || 'Unknown sender';
  const phone     = r.senderPhone || 'Not provided';
  const source    = r.source || 'UNKNOWN';
  const status    = r.status || 'NEW';
  const message   = r.message || 'No message';

  let berthText = 'Not assigned';
  if (r.requestedBerthId) {
    const b = (store.berthsFull || []).find(x => x.id === r.requestedBerthId);
    if (b) berthText = `${b.dockName || ''} ${b.berthNumber || ''}`.trim();
  }

  sheet.innerHTML = `
    <div class="assign-handle"></div>
    <div class="assign-title">Booking Request</div>
    <div class="assign-divider"></div>

    <div class="bkr-detail-body">
      <div class="bkr-detail-row"><span>Vessel</span><b>${esc(vessel)}</b></div>
      <div class="bkr-detail-row"><span>From</span><b>${esc(sender)}</b></div>
      <div class="bkr-detail-row"><span>Phone</span><b>${esc(phone)}</b></div>
      <div class="bkr-detail-row"><span>Arrival</span><b>${esc(arrival)}</b></div>
      <div class="bkr-detail-row"><span>Departure</span><b>${esc(departure)}</b></div>
      <div class="bkr-detail-row"><span>Berth</span><b>${esc(berthText)}</b></div>
      <div class="bkr-detail-row"><span>Source</span><b>${esc(source)}</b></div>
      <div class="bkr-detail-row"><span>Status</span><b>${esc(status)}</b></div>

      <div class="bkr-detail-message-label">Message</div>
      <div class="bkr-detail-message">${esc(message)}</div>
    </div>

    <div class="assign-divider"></div>
    <button class="assign-cancel" id="bkrClose">Close</button>
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
  sheet.querySelector('#bkrClose').addEventListener('click', close);
}

/* ---------- Helpers ---------- */
function formatDate(ms) {
  const d = new Date(Number(ms));
  const day   = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year  = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function esc(s) {
  return escapeHtml(s);
}