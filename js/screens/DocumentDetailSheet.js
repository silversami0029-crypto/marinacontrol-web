import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/DocumentDetailSheet.js

export function showDocumentDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  let statusText = 'No expiry';
  let statusColor = '#737D89';

  if (item.expiryDate) {
    if (item.expiryDate < now) { statusText = 'Expired'; statusColor = '#F44336'; }
    else if (item.expiryDate <= now + thirtyDays) { statusText = 'Expiring soon'; statusColor = '#FF9800'; }
    else { statusText = 'Valid'; statusColor = '#4CAF50'; }
  }

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(item.name || 'Document')}</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">${tr("Type:")}</span> <span class="md-value">${escapeHtml(tr(item.type || '—'))}</span></div>
      <div class="md-line"><span class="md-label">${tr("Status:")}</span> <span class="md-value" style="color:${statusColor};">${escapeHtml(tr(statusText))}</span></div>
      ${item.expiryDate ? `<div class="md-line"><span class="md-label">${tr("Expiry:")}</span> <span class="md-value">${escapeHtml(formatDate(item.expiryDate))}</span></div>` : ''}
      ${item.assignedTo ? `<div class="md-line"><span class="md-label">${tr("Assigned To:")}</span> <span class="md-value">${escapeHtml(item.assignedTo)}</span></div>` : ''}
      ${item.notes ? `<div class="md-spacer"></div><div class="md-line"><span class="md-label">${tr("Notes:")}</span> <span class="md-value">${escapeHtml(item.notes)}</span></div>` : ''}
    </div>

    <button type="button" class="md-close-btn" id="docDetailClose">${tr("Close")}</button>
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
  sheet.querySelector('#docDetailClose').addEventListener('click', close);
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(uiLocale(), {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return '—'; }
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}