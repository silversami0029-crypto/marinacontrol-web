// js/screens/SafetyMenuSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { showAddSafetySheet } from './AddSafetySheet.js';
import { doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showSafetyMenu(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const hasExpiry = item.expiryDate > 0;

  sheet.innerHTML = `
    /*<div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(item.title || 'Safety Item')}</div>*/

<div class="invoice-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

  <div class="sheet-title"
    style="flex:1;margin:0;padding:12px 48px;text-align:center;">
    ${isEdit ? 'Edit Invoice' : 'Add Invoice'}
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



    ${!hasExpiry ? `
      <div class="sheet-item" id="smSetDate">
        <div class="sheet-item-icon">
          <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="sheet-item-text">
          <div class="sheet-item-title">Set Purchase Date</div>
          <div class="sheet-item-subtitle">Needed to calculate expiry</div>
        </div>
      </div>
      <div class="sheet-gap-8"></div>
    ` : ''}

    <div class="sheet-item" id="smInspect">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <polyline points="8 12 11 15 16 9"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Mark Inspected</div>
        <div class="sheet-item-subtitle">Record today's inspection</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="smEdit">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Edit</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="smDelete">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Delete</div>
      </div>
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

sheet.querySelector('#iv-close').addEventListener('click', close);

  sheet.querySelector('#smSetDate')?.addEventListener('click', () => {
    close();
    setTimeout(() => showAddSafetySheet({ item }), 250);
  });

  sheet.querySelector('#smInspect').addEventListener('click', () => {
    close();
    setTimeout(() => markInspected(item), 250);
  });

  sheet.querySelector('#smEdit').addEventListener('click', () => {
    close();
    setTimeout(() => showAddSafetySheet({ item }), 250);
  });

  sheet.querySelector('#smDelete').addEventListener('click', async () => {
    close();
    await deleteSafety(item);
  });
}

async function markInspected(item) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    // nextInspectionDate = expiryDate - alertDaysBefore (default 30)
    const alertDays = item.alertDaysBefore || 30;
    const nextInspectionDate = item.expiryDate > 0
      ? item.expiryDate - alertDays * 24 * 60 * 60 * 1000
      : 0;

    await updateDoc(doc(db, 'safety_items', String(item._docId)), {
      lastInspectedDate: now,
      nextInspectionDate,
      updatedAt: now,
      lastModified: now,
      lastModifiedBy: userId
    });

    toast('Marked inspected', { kind: 'success' });
  } catch (err) {
    console.error('[safety inspect] failed', err);
    toast('Failed to mark inspected', { kind: 'error' });
  }
}

async function deleteSafety(item) {
  const ok = await confirmSheet({
    title: 'Delete safety item?',
    message: `This will permanently remove "${item.title}".`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    await deleteDoc(doc(db, 'safety_items', String(item._docId)));
    toast(`Deleted: ${item.title}`, { kind: 'success' });
  } catch (err) {
    console.error('[safety delete] failed', err);
    toast('Failed to delete', { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}