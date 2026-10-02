import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/EquipmentDetailSheet.js

export function showEquipmentDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(item.manufacturer || 'Equipment')} ${item.model ? escapeHtml(item.model) : ''}</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">${tr("Type:")}</span> <span class="md-value">${escapeHtml(tr(item.type || '—'))}</span></div>
      ${item.location ? `<div class="md-line"><span class="md-label">${tr("Location:")}</span> <span class="md-value">${escapeHtml(item.location)}</span></div>` : ''}
      ${item.serialNumber ? `<div class="md-line"><span class="md-label">${tr("Serial Number:")}</span> <span class="md-value">${escapeHtml(item.serialNumber)}</span></div>` : ''}
      <div class="md-line"><span class="md-label">${tr("Status:")}</span> <span class="md-value">${escapeHtml(item.status || 'OPERATIONAL')}</span></div>
      ${item.assignedTo ? `<div class="md-line"><span class="md-label">${tr("Assigned To:")}</span> <span class="md-value">${escapeHtml(item.assignedTo)}</span></div>` : ''}
      ${item.notes ? `<div class="md-spacer"></div><div class="md-line"><span class="md-label">${tr("Notes:")}</span> <span class="md-value">${escapeHtml(item.notes)}</span></div>` : ''}
    </div>

    <button type="button" class="md-close-btn" id="eqDetailClose">${tr("Close")}</button>
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
  sheet.querySelector('#eqDetailClose').addEventListener('click', close);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}