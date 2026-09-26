// js/screens/DocumentMenuSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { showAddDocumentSheet } from './AddDocumentSheet.js';
import { showAssignDocumentOwnerSheet } from './AssignDocumentOwnerSheet.js';
import { doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showDocumentMenu(item, { onChanged } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(item.name || 'Document')}</div>

    <div class="sheet-item" id="dmEdit">
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

    <div class="sheet-item" id="dmRenew">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 8"/>
          <polyline points="21 3 21 8 16 8"/>
          <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.7-3L3 16"/>
          <polyline points="3 21 3 16 8 16"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Renew</div>
        <div class="sheet-item-subtitle">Update expiry date</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="dmAssignOwner">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Assign Owner</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="dmDelete">
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

  sheet.querySelector('#dmEdit').addEventListener('click', () => {
    close();
    setTimeout(() => showAddDocumentSheet({ item, boatName: '' }), 250);
  });

  sheet.querySelector('#dmRenew').addEventListener('click', () => {
    close();
    setTimeout(() => renewDocument(item), 250);
  });

  sheet.querySelector('#dmAssignOwner').addEventListener('click', () => {
    close();
    setTimeout(() => showAssignDocumentOwnerSheet(item), 250);
  });

  sheet.querySelector('#dmDelete').addEventListener('click', async () => {
    close();
    await deleteDocument(item);
  });
}

async function renewDocument(item) {
  const current = item.expiryDate
    ? new Date(item.expiryDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Renew Document</div>

    <div class="add-scroll">
      <label class="add-label" for="rn-date">New Expiry Date</label>
      <input class="add-input" id="rn-date" type="date" value="${current}">
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="rnCancel">Cancel</button>
      <button type="button" class="csv-btn csv-btn--choose" id="rnSave">Renew</button>
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
  sheet.querySelector('#rnCancel').addEventListener('click', close);

  sheet.querySelector('#rnSave').addEventListener('click', async () => {
    const v = sheet.querySelector('#rn-date').value;
    if (!v) { toast('Select a date', { kind: 'error' }); return; }

    const expiryMs = new Date(v + 'T00:00:00').getTime();
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    try {
      await updateDoc(doc(db, 'documents', String(item._docId)), {
        expiryDate: expiryMs,
        lastModified: now,
        lastModifiedBy: userId
      });
      close();
      toast('Document renewed', { kind: 'success' });
    } catch (err) {
      console.error('[document renew] failed', err);
      toast('Failed to renew', { kind: 'error' });
    }
  });
}

async function deleteDocument(item) {
  const ok = await confirmSheet({
    title: 'Delete document?',
    message: `This will permanently remove "${item.name}".`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    await deleteDoc(doc(db, 'documents', String(item._docId)));
    toast(`Deleted: ${item.name}`, { kind: 'success' });
  } catch (err) {
    console.error('[document delete] failed', err);
    toast('Failed to delete', { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}