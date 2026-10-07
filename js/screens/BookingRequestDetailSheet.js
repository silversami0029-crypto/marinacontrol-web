import { renderBookingTimeline } from './BookingRequestTimeline.js';
import { getLanguage } from '../i18n.js';
import { t, t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/BookingRequestDetailSheet.js
import { approveBookingRequest, showRequestMoreMenu } from './BookingRequestActions.js';
import { toast } from '../ui/toast.js';
import {
  doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showBookingRequestDetail(request, berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const arrival   = request.arrivalDate   ? formatDate(request.arrivalDate)   : 'Not specified';
  const departure = request.departureDate ? formatDate(request.departureDate) : 'Not specified';
  const vessel    = request.vesselName || 'Unknown vessel';
  const sender    = request.senderName || 'Unknown sender';
  const phone     = request.senderPhone || 'Not provided';
  const source    = request.source || 'UNKNOWN';
  const status    = request.status || 'NEW';
  const message   = request.message || 'No message';

  let berthText = [request.assignedDockName, request.assignedBerthNumber || request.berthNumber].filter(Boolean).join(' ') || (request.requestedBerthId != null ? String(request.requestedBerthId) : tr('Not assigned'));
  if (berth) {
    const dock = berth.dockName ? berth.dockName + ' ' : '';
    berthText = dock + (berth.berthNumber || '');
  }

  const isActionable = !request.approvedBookingUuid && ['NEW', 'REVIEWING', 'AWAITING_OWNER'].includes(String(status).toUpperCase());

  sheet.innerHTML = `
    <div style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface,#1C222A);">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${tr("Booking Request")}</div>
      <button type="button" data-sheet-close aria-label="${t('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="bkr-detail-body">
      ${request.dateProposal ? `<div class="bkr-detail-row"><span>${tr('Date proposal')}</span><b>${escapeHtml(request.dateProposal.state)} · ${escapeHtml(request.dateProposal.delivery)}</b></div>` : ''}
      <div class="bkr-detail-row"><span>${tr("Vessel")}</span><b>${escapeHtml(vessel)}</b></div>
      <div class="bkr-detail-row"><span>${tr("From")}</span><b>${escapeHtml(sender)}</b></div>
      <div class="bkr-detail-row"><span>${tr("Phone")}</span><b>${escapeHtml(phone)}</b></div>
      <div class="bkr-detail-row"><span>${tr("Arrival")}</span><b>${escapeHtml(arrival)}</b></div>
      <div class="bkr-detail-row"><span>${tr("Departure")}</span><b>${escapeHtml(departure)}</b></div>
      <div class="bkr-detail-row"><span>${tr("Berth")}</span><b>${escapeHtml(berthText)}</b></div>
      <div class="bkr-detail-row"><span>${tr("Source")}</span><b>${escapeHtml(source)}</b></div>
      <div class="bkr-detail-row"><span>${tr("Status")}</span><b>${escapeHtml(requestStatusLabel(request))}</b></div>

      ${renderBookingTimeline(request)}
      ${request.latestOwnerReply?.text ? `<div class="bkr-detail-message-label">${tr("Owner reply — review before recording acceptance")}</div><div class="bkr-detail-message">${escapeHtml(request.latestOwnerReply.text)}</div>` : ''}
      <div class="bkr-detail-message-label">${tr("Message")}</div>
      <div class="bkr-detail-message">${escapeHtml(message)}</div>
    </div>

    ${isActionable && status !== 'AWAITING_OWNER' ? `
      <button type="button" class="add-save" id="bkrDetailApprove">${tr("Approve")}</button>
    ` : ''}

    <div class="ao-actions" style="margin-top:8px;">
      <button type="button" class="csv-btn csv-btn--cancel" id="bkrDetailClose">${tr("Close")}</button>
      ${isActionable ? `
        <button type="button" class="csv-btn csv-btn--choose" id="bkrDetailMore" style="background:transparent;border:1px solid var(--color-divider);color:var(--color-text-primary);">${tr("More")}</button>
      ` : ''}
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
  sheet.querySelector('#bkrDetailClose').addEventListener('click', close);

  const approveBtn = sheet.querySelector('#bkrDetailApprove');
  if (approveBtn) {
    approveBtn.addEventListener('click', () => {
      close();
      approveBookingRequest(request);
    });
  }

  const moreBtn = sheet.querySelector('#bkrDetailMore');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      close();
      showRequestMoreMenu(request);
    });
  }
}

function showRequestActions(request) {
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
      <div class="sheet-item-text"><div class="sheet-item-title">${tr("Edit Dates")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="bkrActDecline">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${tr("Decline Request")}</div></div>
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
    toast(tr('Date editing coming soon'));
  });

  sheet.querySelector('#bkrActDecline').addEventListener('click', async () => {
    close();
    await declineRequest(request);
  });
}

async function declineRequest(request) {
  try {
    await updateDoc(doc(db, 'berth_booking_requests', String(request._docId)), {
      status: 'DECLINED',
      lastModified: Date.now()
    });
    toast(tr('Booking request declined'), { kind: 'success' });
  } catch (err) {
    console.error('[booking request decline] failed', err);
    toast(tr('Failed to decline request'), { kind: 'error' });
  }
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  return d.toLocaleDateString(uiLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function requestStatusLabel(request) {
  const status = String(request.status || 'NEW').toUpperCase();
  if (status === 'APPROVED' && request.approvedBookingUuid) return getLanguage() === 'ar' ? 'تم الحجز' : 'Booked';
  if (status === 'AWAITING_OWNER') return tr('Awaiting owner agreement');
  return tr(status);
}
