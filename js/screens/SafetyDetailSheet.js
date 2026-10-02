import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/SafetyDetailSheet.js

export function showSafetyDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000;

  let status = 'No expiry';
  let statusColor = '#737D89';
  if (item.expiryDate > 0) {
    if (item.expiryDate < now) { status = 'Expired'; statusColor = '#F44336'; }
    else if (item.expiryDate <= cutoff) { status = 'Expiring soon'; statusColor = '#FF9800'; }
    else { status = 'Valid'; statusColor = '#4CAF50'; }
  }

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(item.title || 'Safety Item')}</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">${tr("Category:")}</span> <span class="md-value">${escapeHtml(tr(item.category || '—'))}</span></div>
      ${item.location ? `<div class="md-line"><span class="md-label">${tr("Location:")}</span> <span class="md-value">${escapeHtml(item.location)}</span></div>` : ''}
      <div class="md-line"><span class="md-label">${tr("Importance:")}</span> <span class="md-value">${escapeHtml(tr(item.importance || '—'))}</span></div>
      <div class="md-line"><span class="md-label">${tr("Status:")}</span> <span class="md-value" style="color:${statusColor};">${escapeHtml(status)}</span></div>
      ${item.expiryDate > 0 ? `<div class="md-line"><span class="md-label">${tr("Expiry:")}</span> <span class="md-value">${escapeHtml(formatDate(item.expiryDate))}</span></div>` : ''}
      ${item.nextInspectionDate > 0 ? `<div class="md-line"><span class="md-label">${tr("Next Inspection:")}</span> <span class="md-value">${escapeHtml(formatDate(item.nextInspectionDate))}</span></div>` : ''}
      ${item.purchaseDate > 0 ? `<div class="md-line"><span class="md-label">${tr("Purchased:")}</span> <span class="md-value">${escapeHtml(formatDate(item.purchaseDate))}</span></div>` : ''}
      ${(item.validityYears || item.validityMonths) ? `<div class="md-line"><span class="md-label">${tr("Validity:")}</span> <span class="md-value">${item.validityYears || 0}y ${item.validityMonths || 0}m</span></div>` : ''}
      ${item.notes ? `<div class="md-spacer"></div><div class="md-line"><span class="md-label">${tr("Notes:")}</span> <span class="md-value">${escapeHtml(item.notes)}</span></div>` : ''}
    </div>

    <button type="button" class="md-close-btn" id="sfDetailClose">${tr("Close")}</button>
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
  sheet.querySelector('#sfDetailClose').addEventListener('click', close);
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