import { mountWhatsAppReplyReview } from './WhatsAppReplyReview.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { getLanguage } from '../i18n.js';
import { t, getLocale, languagePicker } from '../i18n.js';
// js/screens/BookingRequestsScreen.js
// Berth Booking Requests — mirrors fragment_berth_booking_requests.xml

import { listenForBookingRequests } from '../db.js';
import { store } from '../store.js';
import { approveBookingRequest, showRequestMoreMenu } from './BookingRequestActions.js';
import { showBookingRequestsHelp } from './BookingRequestsHelp.js';
let unsubscribe = null;
let searchQuery = '';
let openRequestDocId = null;


export function mountBookingRequestsScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty">
         <h2>${t("No client assigned")}</h2>
         <p>${t("Your user profile doesn't include a clientId.")}</p>
       </div>`;
    return;
  }

  searchQuery = '';
  openRequestDocId = null;

  const screen = document.getElementById('screen');

  screen.innerHTML = `
    <div class="bkr-header">
      <div class="bkr-header-row">
        <div class="bkr-pill" id="bkrCount">${t("Booking Requests: 0")}</div>
        <button class="bkr-icon-btn" id="bkrHelp" aria-label="${t("Help")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="bkr-header-spacer"></div>
        <button class="bkr-icon-btn" id="bkrSearchToggle" aria-label="${t("Search")}">
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
      <input id="bkrSearchInput" type="text" placeholder="${t("Search booking requests...")}"
             autocomplete="off">
      <button type="button" class="search-cancel" id="bkrSearchCancel">${t("Cancel")}</button>
    </div>

    <div id="bkrReplyReview"></div>
    <div class="bkr-list" id="bkrList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;



  setupSearch();
  const refreshReplyReview = mountWhatsAppReplyReview(screen.querySelector("#bkrReplyReview"));

  if (unsubscribe) unsubscribe();
  unsubscribe = listenForBookingRequests(store.activeClientId, (requests, err) => {
    if (err) {
      document.getElementById('bkrList').innerHTML =
        `<div class="boats-empty">
           <h2>${t("Couldn't load requests")}</h2>
           <p>${err.message || 'Permission denied.'}</p>
         </div>`;
      return;
    }

    store.bookingRequests = requests;
    renderList();
    refreshReplyReview();
  });
}

/* ---------- Search ---------- */
function setupSearch() {
  const toggle = document.getElementById('bkrSearchToggle');
  const bar    = document.getElementById('bkrSearchBar');
  const input  = document.getElementById('bkrSearchInput');
  const cancel = document.getElementById('bkrSearchCancel');
  const bkrHelpBtn = document.getElementById('bkrHelp');
  if (bkrHelpBtn) bkrHelpBtn.addEventListener('click', showBookingRequestsHelp);

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
  const q = searchQuery.trim().toLowerCase();
  return requests.filter((r) => {
    const hay = [
      r.vesselName, r.senderName, r.senderPhone, r.message,
      r.status, r.source, r.requestUuid || r._docId
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

  if (countEl) {
    countEl.textContent = t('requestsCount', {count: filtered.length});
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="boats-empty">
        <h2>${searchQuery ? t("No matches") : t("No booking requests")}</h2>
        <p>${searchQuery
          ? `No requests match "${escapeHtml(searchQuery)}"`
          : t("Incoming berth booking requests will appear here.")}</p>
      </div>
    `;
    return;
  }

  const sorted = [...filtered].sort(
    (a, b) => (b.receivedAt || 0) - (a.receivedAt || 0)
  );

  listEl.innerHTML = sorted.map(renderRequestCard).join('');

  listEl.querySelectorAll('.bkr-card').forEach((card) => {
    const docId = card.dataset.requestDocId;
    const request = all.find(
      r => String(r._docId) === String(docId)
    );

    if (!request) return;

    card.addEventListener('click', () => showDetail(request));
  });
}

function renderRequestCard(r) {
  const status = requestStatusLabel(r);
  const source = r.source || 'UNKNOWN';
  const vessel = r.vesselName || t("Unknown vessel");
  const sender = r.senderName || t("Unknown sender");

  const senderLine = r.senderPhone
    ? `${sender} · ${r.senderPhone}`
    : sender;

  const arrival = r.arrivalDate
    ? formatDate(r.arrivalDate)
    : t("Arrival not specified");

  const departure = r.departureDate
    ? formatDate(r.departureDate)
    : t("Departure not specified");

  const message = r.message?.trim() || t("No message");

  const isSelected =
    String(r._docId) === String(openRequestDocId);

  return `
    <div class="bkr-card${isSelected ? ' is-selected' : ''}"
         data-request-doc-id="${esc(r._docId)}">
      <div class="bkr-status">${esc(t(status))} · ${esc(t(source))}</div>
      <div class="bkr-vessel">${esc(vessel)}</div>
      <div class="bkr-reference" style="font-size:12px;line-height:1.5;margin:5px 0 8px;color:var(--color-text-secondary,#aab5c2);overflow-wrap:anywhere;">${esc(t("Enquiry reference"))}: <span dir="ltr" style="unicode-bidi:isolate;">${esc(r.requestUuid || r._docId)}</span></div>
      <div class="bkr-sender">${esc(senderLine)}</div>
      ${r.assignedBerthNumber || r.berthNumber ? `<div class="bkr-sender">${esc(t("Berth"))}: ${esc([r.assignedDockName, r.assignedBerthNumber || r.berthNumber].filter(Boolean).join(" "))}</div>` : ''}
      <div class="bkr-dates">${esc(arrival)} → ${esc(departure)}</div>
      <div class="bkr-message">"${esc(message)}"</div>
    </div>
  `;
}
/* ---------- Detail sheet ---------- */
async function showDetail(r) {
  const clientId = Number(store.activeClientId);
  const resolvedBerth = await resolveRequestBerth(r, clientId);
  if (Number(store.activeClientId) !== clientId || !document.getElementById('bkrList')) return;

 openRequestDocId = r._docId;
  renderList();   // re-render so the selected class applies
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';


  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  const arrival   = r.arrivalDate   ? formatDate(r.arrivalDate)   : t("Not specified");
  const departure = r.departureDate ? formatDate(r.departureDate) : t("Not specified");
  const vessel    = r.vesselName || t("Unknown vessel");
  const sender    = r.senderName || t("Unknown sender");
  const phone     = r.senderPhone || t("Not provided");
  const source    = r.source || 'UNKNOWN';
  const status    = r.status || 'NEW';
  const isActionable = !r.approvedBookingUuid && ['NEW', 'REVIEWING', 'AWAITING_OWNER'].includes(String(status).toUpperCase());
  const message   = r.message || t("No message");

  const berthText = resolvedBerth;

  sheet.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${t("Booking Request")}</div>
      <button type="button" data-sheet-close aria-label="${t('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="assign-divider"></div>

    <div class="bkr-detail-body">
      <div class="bkr-detail-row"><span>${t("Vessel")}</span><b>${esc(vessel)}</b></div>
      <div class="bkr-detail-row"><span>${t("Enquiry reference")}</span><b dir="ltr" style="font-size:12px;overflow-wrap:anywhere;max-width:70%;">${esc(r.requestUuid || r._docId)}</b></div>
      <div class="bkr-detail-row"><span>${t("From")}</span><b>${esc(sender)}</b></div>
      <div class="bkr-detail-row"><span>${t("Phone")}</span><b>${esc(phone)}</b></div>
      <div class="bkr-detail-row"><span>${t("Arrival")}</span><b>${esc(arrival)}</b></div>
      <div class="bkr-detail-row"><span>${t("Departure")}</span><b>${esc(departure)}</b></div>
      <div class="bkr-detail-row"><span>${t("Berth")}</span><b>${esc(berthText)}</b></div>
      <div class="bkr-detail-row"><span>${t("Source")}</span><b>${esc(t(source))}</b></div>
      <div class="bkr-detail-row"><span>${t("Status")}</span><b>${esc(requestStatusLabel(r))}</b></div>

      ${r.dateProposal ? `<div class="bkr-detail-row"><span>${t("Date proposal")}</span><b>${esc(r.dateProposal.state)} · ${esc(r.dateProposal.delivery)}</b></div>` : ''}
      ${r.latestOwnerReply?.text ? `<div class="bkr-detail-message-label">${t("Owner reply — review before recording acceptance")}</div><div class="bkr-detail-message">${esc(r.latestOwnerReply.text)}</div>` : ''}
      <div class="bkr-detail-message-label">${t("Message")}</div>
      <div class="bkr-detail-message">${esc(message)}</div>
    </div>

    ${isActionable && status !== 'AWAITING_OWNER' ? `<button type="button" class="add-save" id="bkrApprove" style="margin-top:12px;">${t("Approve")}</button>` : ''}

    <div class="ao-actions" style="margin-top:8px;">
      <button type="button" class="csv-btn csv-btn--cancel" id="bkrClose">${t("Close")}</button>
      ${isActionable ? `<button type="button" class="csv-btn csv-btn--cancel" id="bkrMore">${t("More")}</button>` : ''}
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
  sheet.querySelector('#bkrClose').addEventListener('click', close);

  sheet.querySelector('#bkrApprove')?.addEventListener('click', () => {
    close();
    approveBookingRequest(r);
  });

  sheet.querySelector('#bkrMore')?.addEventListener('click', () => {
    close();
    showRequestMoreMenu(r);
  });
}

/* ---------- Helpers ---------- */
function formatDate(ms) {
  return new Date(Number(ms)).toLocaleDateString(getLocale(), {day:'2-digit',month:'short',year:'numeric'});
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function esc(s) {
  return escapeHtml(s);
}
async function resolveRequestBerth(request, clientId) {
  const saved = [request.assignedDockName, request.assignedBerthNumber || request.berthNumber].filter(Boolean).join(' ');
  if (request.requestedBerthId == null) return saved || t('Not assigned');
  const matches = b => Number(b.id) === Number(request.requestedBerthId) && Number(b.clientId) === clientId;
  let berth = (store.berthsFull || []).find(matches);
  if (!berth) {
    try {
      const snap = await getDocs(query(collection(db, 'berths'), where('clientId', '==', clientId), where('id', '==', Number(request.requestedBerthId))));
      berth = snap.docs.map(d => d.data()).find(matches);
    } catch (err) { console.warn('[booking request] berth lookup failed', err?.code); }
  }
  return berth ? [berth.dockName, berth.berthNumber].filter(Boolean).join(' ') || saved || String(request.requestedBerthId) : saved || String(request.requestedBerthId);
}

function requestStatusLabel(request) {
  const status = String(request.status || 'NEW').toUpperCase();
  if (status === 'APPROVED' && request.approvedBookingUuid) return getLanguage() === 'ar' ? 'تم الحجز' : 'Booked';
  if (status === 'AWAITING_OWNER') return t('Awaiting owner agreement');
  return t(status);
}
