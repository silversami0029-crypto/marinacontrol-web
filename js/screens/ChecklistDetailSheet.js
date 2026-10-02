import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ChecklistDetailSheet.js
import { store } from '../store.js';
import {
  collection, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const STATUS_COLORS = {
  COMPLETED: '#4CAF50',
  IN_PROGRESS: '#FF9800',
  PENDING: '#2196F3',
  CANCELLED: '#737D89'
};

export async function showChecklistDetail(checklist) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet sheet--tall';

  const statusColor = STATUS_COLORS[checklist.status] || '#737D89';
  const boatName = store.boatsFull?.find(b => Number(b.id) === Number(checklist.boatId))?.name || '—';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(checklist.name || 'Checklist')}</div>
    <div class="chk-detail-status" style="background:${statusColor};">${escapeHtml(checklist.status.replace('_',' '))}</div>

    <div class="chk-detail-scroll" id="chkDetailScroll">
      <div class="chk-detail-summary">
        <div class="chk-summary-col">
          <div class="chk-summary-label">${tr("Completed")}</div>
          <div class="chk-summary-value">${checklist.completedItems}/${checklist.totalItems}</div>
        </div>
        <div class="chk-summary-col">
          <div class="chk-summary-label">${tr("Passed")}</div>
          <div class="chk-summary-value" style="color:#4CAF50;">${checklist.passedItems}</div>
        </div>
        <div class="chk-summary-col">
          <div class="chk-summary-label">${tr("Failed")}</div>
          <div class="chk-summary-value" style="color:${checklist.failedItems > 0 ? '#F44336' : 'inherit'};">${checklist.failedItems}</div>
        </div>
      </div>

      <div class="md-body">
        <div class="md-line"><span class="md-label">${tr("Boat:")}</span> <span class="md-value">${escapeHtml(boatName)}</span></div>
        <div class="md-line"><span class="md-label">${tr("Type:")}</span> <span class="md-value">${escapeHtml(checklist.type || '—')}</span></div>
        ${checklist.photoCount > 0 ? `<div class="md-line"><span class="md-label">${tr("Photos:")}</span> <span class="md-value">📷 ${checklist.photoCount}</span></div>` : ''}
        ${checklist.completedBy ? `<div class="md-line"><span class="md-label">${tr("Completed by:")}</span> <span class="md-value">${escapeHtml(checklist.completedBy)}</span></div>` : ''}
        ${checklist.completedAt ? `<div class="md-line"><span class="md-label">${tr("Completed:")}</span> <span class="md-value">${escapeHtml(formatDate(checklist.completedAt))}</span></div>` : ''}
        <div class="md-line"><span class="md-label">${tr("Created:")}</span> <span class="md-value">${escapeHtml(formatDate(checklist.createdAt))}</span></div>
        ${checklist.notes ? `<div class="md-spacer"></div><div class="md-line"><span class="md-label">${tr("Notes:")}</span> <span class="md-value">${escapeHtml(checklist.notes)}</span></div>` : ''}
      </div>

      <div class="chk-items-header">${tr("Items")}</div>
      <div class="chk-items-list" id="chkItemsList">
        <div class="boats-loading"><div class="spinner-ring"></div></div>
      </div>
    </div>

    <button type="button" class="md-close-btn" id="chkDetailClose">${tr("Close")}</button>
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
  sheet.querySelector('#chkDetailClose').addEventListener('click', close);

  // Load items subcollection
  const itemsEl = sheet.querySelector('#chkItemsList');
  try {
    const snap = await getDocs(
      collection(db, 'checklists', checklist._docId, 'items')
    );

    if (snap.empty) {
      itemsEl.innerHTML = `<div class="eq-hist-empty">${tr("No items synced")}</div>`;
      return;
    }

    itemsEl.innerHTML = snap.docs.map(d => {
      const data = d.data();

      // Defensive field lookup — accept any of the common names
      const label =
        data.text || data.label || data.name || data.title ||
        data.description || data.item || '(untitled)';

      const isChecked =
        data.checked === true ||
        data.completed === true ||
        data.passed === true ||
        data.status === 'PASSED' ||
        data.status === 'COMPLETED';

      const isFailed =
        data.failed === true ||
        data.status === 'FAILED' ||
        data.result === 'FAIL';

      const mark = isFailed ? '✗' : (isChecked ? '✓' : '○');
      const markColor = isFailed ? '#F44336' : (isChecked ? '#4CAF50' : '#737D89');

      return `
        <div class="chk-item">
          <div class="chk-item-mark" style="color:${markColor};">${mark}</div>
          <div class="chk-item-info">
            <div class="chk-item-label">${escapeHtml(String(label))}</div>
            ${data.notes ? `<div class="chk-item-notes">${escapeHtml(data.notes)}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.warn('[checklist items] load failed', err?.code || err?.message || err);
    itemsEl.innerHTML = `<div class="eq-hist-empty">${tr("Couldn't load items")}</div>`;
  }
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  return d.toLocaleDateString(uiLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}