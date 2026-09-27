// js/screens/InventoryDetailSheet.js

export function showInventoryDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const state = computeStatus(item.quantity);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(item.name || 'Inventory Item')}</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">Category:</span> <span class="md-value">${escapeHtml(item.category || '—')}</span></div>
      ${item.location ? `<div class="md-line"><span class="md-label">Location:</span> <span class="md-value">${escapeHtml(item.location)}</span></div>` : ''}
      <div class="md-line"><span class="md-label">Quantity:</span> <span class="md-value">${item.quantity}${item.unit ? ' ' + escapeHtml(item.unit) : ''}</span></div>
      <div class="md-line"><span class="md-label">Reorder Level:</span> <span class="md-value">${item.reorderLevel}</span></div>
      <div class="md-line"><span class="md-label">Status:</span> <span class="md-value" style="color:${state.color};">${state.label}</span></div>
      ${item.supplier ? `<div class="md-line"><span class="md-label">Supplier:</span> <span class="md-value">${escapeHtml(item.supplier)}</span></div>` : ''}
      ${item.assignedTo ? `<div class="md-line"><span class="md-label">Assigned To:</span> <span class="md-value">${escapeHtml(item.assignedTo)}</span></div>` : ''}
      ${item.lastUpdated ? `<div class="md-line"><span class="md-label">Last Updated:</span> <span class="md-value">${escapeHtml(item.lastUpdated)}</span></div>` : ''}
      ${item.notes ? `<div class="md-spacer"></div><div class="md-line"><span class="md-label">Notes:</span> <span class="md-value">${escapeHtml(item.notes)}</span></div>` : ''}
    </div>

    <button type="button" class="md-close-btn" id="invDetailClose">Close</button>
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
  sheet.querySelector('#invDetailClose').addEventListener('click', close);
}

function computeStatus(quantity) {
  const q = Number(quantity || 0);
  if (q <= 0) return { color: '#F44336', label: 'Out of Stock' };
  if (q <= 1) return { color: '#F44336', label: 'Critical Stock' };
  if (q <= 3) return { color: '#FF9800', label: 'Low Stock' };
  return { color: '#4CAF50', label: 'In Stock' };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}