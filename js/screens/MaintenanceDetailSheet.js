// js/screens/MaintenanceDetailSheet.js

export function showMaintenanceDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const body = buildDetailBody(item);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(item.type || 'Maintenance Details')}</div>

    <div class="md-body">${body}</div>

      <button type="button" class="md-close-btn" id="mdClose">Close</button>
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
  sheet.querySelector('#mdClose').addEventListener('click', close);
}

/* ============================================================
   BODY BUILDER
   ============================================================ */
function buildDetailBody(item) {
  const parts = [];

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
    parts.push(row('Status', item.status || 'N/A'));
    parts.push(row('Reason', item.deferReason));
    parts.push(row('Risk', item.riskLevel || 'N/A'));
    parts.push(row('Mitigation', item.mitigation || 'N/A'));
    parts.push(row('Review', getReviewDateDisplay(item.reviewDate)));
    parts.push(row('Deferred By', item.deferredBy || 'N/A'));
    parts.push(row('Deferred', getRelativeTime(item.deferredAt)));
    parts.push(row('', `(${formatTimestamp(item.deferredAt)})`));

    parts.push(spacer());
  }

  // --- Source ---
  if (item.source && item.source.trim()) {
    parts.push(row('Source', item.source));
    parts.push(spacer());
  }

  // --- Notes ---
  parts.push(row('Notes', item.notes || 'No notes'));

  return parts.join('');
}

function row(label, value) {
  if (!label) {
    return `<div class="md-line md-line-empty">${escapeHtml(value)}</div>`;
  }
  return `<div class="md-line"><span class="md-label">${escapeHtml(label)}:</span> <span class="md-value">${escapeHtml(value)}</span></div>`;
}

function spacer() {
  return `<div class="md-spacer"></div>`;
}

/* ============================================================
   TIME HELPERS — mirrors Android's getRelativeTime / formatTimestamp
   ============================================================ */
function getRelativeTime(timestamp) {
  if (!timestamp) return 'N/A';
  const now = Date.now();
  const diff = Math.max(0, now - timestamp);

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor(diff / (60 * 1000));

  if (days > 0)   return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours > 0)  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return 'just now';
}

function formatTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  const d = new Date(timestamp);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function getReviewDateDisplay(reviewDate) {
  if (!reviewDate) return 'N/A';

  try {
    const d = new Date(reviewDate + 'T00:00:00');
    if (isNaN(d.getTime())) return reviewDate;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diff = d.getTime() - now.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    const formatted = d.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    if (days < 0)  return `Overdue for review (${formatted})`;
    if (days === 0) return `Today (${formatted})`;
    if (days === 1) return `Tomorrow (${formatted})`;
    if (days <= 7) return `In ${days} days (${formatted})`;
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