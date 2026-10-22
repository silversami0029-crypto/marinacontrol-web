import {launchLabel} from '../util/YardWorkPackageApi.js';
import { maintenanceColours, maintenanceStatusColour } from '../util/MaintenanceState.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/MaintenanceDetailSheet.js

export function showMaintenanceDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const body = buildDetailBody(item);

  sheet.innerHTML = `
    

<div class="invoice-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

     <div class="sheet-title" style="width:100%;box-sizing:border-box;padding:0 48px;text-align:center;">
${escapeHtml(item.type || 'Maintenance Details')}
</div>

  <button type="button" id="iv-close" aria-label="Close invoice sheet"
    style="position:absolute;right:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</div>

    <div class="md-body">${body}</div>

      <button type="button" class="md-close-btn" id="mdClose">${tr("Close")}</button>
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
  sheet.querySelector('#iv-close').addEventListener('click', close);
  sheet.querySelector('#mdClose').addEventListener('click', close);
}

/* ============================================================
   BODY BUILDER
   ============================================================ */
function buildDetailBody(item) {
  const parts = [];
  if (item.archived === true) parts.push(row('Archived', tr('Yes'), maintenanceColours.archived));
  parts.push(row('Status', tr(item.status || (item.completed ? 'COMPLETED' : 'ACTIVE')), maintenanceStatusColour(item)));
  parts.push(spacer());

  // --- Assigned To ---
  if (item.assignedTo) {
    parts.push(row('Assigned To', item.assignedTo));
    if (item.assignedBy) parts.push(row('Assigned By', item.assignedBy));
    if (item.assignedAt > 0) {
      parts.push(row('Assigned', getRelativeTime(item.assignedAt)));
      parts.push(row('', `(${formatTimestamp(item.assignedAt)})`));
    }
  } else {
    parts.push(row('Assigned To', 'Unassigned'));
  }

  parts.push(spacer());

  // --- Date ---
  parts.push(row('Date', item.date || '—'));

  parts.push(spacer());

  // --- Deferral (only if deferReason exists) ---
  if (item.deferReason && item.deferReason.trim()) {
    parts.push(row('Reason', item.deferReason));
    parts.push(row('Risk', tr(item.riskLevel || 'N/A')));
    parts.push(row('Mitigation', item.mitigation || 'N/A'));
    parts.push(row('Review', getReviewDateDisplay(item.reviewDate)));
    parts.push(row('Deferred By', item.deferredBy || 'N/A'));
    parts.push(row('Deferred', getRelativeTime(item.deferredAt)));
    parts.push(row('', `(${formatTimestamp(item.deferredAt)})`));

    parts.push(spacer());
  }

  // --- Source ---
  if (item.source && item.source.trim()) {
    parts.push(row('Source', item.source.startsWith('YARD_STORAGE:') ? 'Yard Storage · ' + item.source.slice('YARD_STORAGE:'.length) : item.source));
    parts.push(spacer());
  }

  if(item.workPackageName)parts.push(row('Work package',item.workPackageName));
  parts.push(row('Launch requirement',launchLabel(item)));

  // --- Notes ---
  parts.push(row('Notes', item.notes || tr('No notes')));

  return parts.join('');
}

function row(label, value, colour = '') {
  if (!label) {
    return `<div class="md-line md-line-empty">${escapeHtml(value)}</div>`;
  }
  return `<div class="md-line"><span class="md-label">${escapeHtml(tr(label))}:</span> <span class="md-value"${colour ? ` style="color:${colour}"` : ''}>${escapeHtml(value)}</span></div>`;
}

function spacer() {
  return `<div class="md-spacer"></div>`;
}

/* ============================================================
   TIME HELPERS — mirrors Android's getRelativeTime / formatTimestamp
   ============================================================ */
function getRelativeTime(timestamp) {
  if (!timestamp) return tr('N/A');
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor(diff / (60 * 1000));

  if (days > 0)   return tr(days === 1 ? '1 day ago' : `${days} days ago`);
  if (hours > 0)  return tr(hours === 1 ? '1 hour ago' : `${hours} hours ago`);
  if (minutes > 0) return tr(minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`);
  return tr('just now');
}

function formatTimestamp(timestamp) {
  if (!timestamp) return tr('N/A');
  const d = new Date(timestamp);
  return d.toLocaleString(uiLocale(), {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getReviewDateDisplay(reviewDate) {
  if (!reviewDate) return tr('N/A');

  try {
    const d = new Date(reviewDate + 'T00:00:00');
    if (isNaN(d.getTime())) return reviewDate;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diff = d.getTime() - now.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    const formatted = d.toLocaleDateString(uiLocale(), {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    if (days < 0)  return tr(`Overdue for review (${formatted})`);
    if (days === 0) return tr(`Today (${formatted})`);
    if (days === 1) return tr(`Tomorrow (${formatted})`);
    if (days <= 7) return tr(`In ${days} days (${formatted})`);
    return formatted;
  } catch {
    return reviewDate;
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}