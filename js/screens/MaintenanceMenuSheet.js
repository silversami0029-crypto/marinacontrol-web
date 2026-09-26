// js/screens/MaintenanceMenuSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { showAssignOwnerSheet } from './AssignOwnerSheet.js';
import { showDeferMaintenanceSheet } from './DeferMaintenanceSheet.js';
import { showAddMaintenanceSheet } from './AddMaintenanceSheet.js';
import { showReviewMaintenanceSheet } from './ReviewMaintenanceSheet.js';
import { doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showMaintenanceMenu(item, { onChanged } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const status = (item.status || 'ACTIVE').toUpperCase();
  const isCompleted = item.completed || status === 'COMPLETED';
  const isDeferred = status === 'DEFERRED';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(item.type || 'Maintenance')}</div>

    ${isDeferred ? `
      <div class="sheet-item" id="mmReview">
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
          <div class="sheet-item-title">Review Due</div>
          <div class="sheet-item-subtitle">Complete, extend, or escalate</div>
        </div>
      </div>
      <div class="sheet-gap-8"></div>
    ` : ''}

    ${!isCompleted ? `
      <div class="sheet-item" id="mmComplete">
        <div class="sheet-item-icon">
          <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <polyline points="8 12 11 15 16 9"/>
          </svg>
        </div>
        <div class="sheet-item-text">
          <div class="sheet-item-title">Complete</div>
          <div class="sheet-item-subtitle">Mark this task as done</div>
        </div>
      </div>
      <div class="sheet-gap-8"></div>
    ` : ''}

    <div class="sheet-item" id="mmDefer">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2h12v6l-6 4 6 4v6H6v-6l6-4-6-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">${isDeferred ? 'Update Defer' : 'Defer'}</div>
        <div class="sheet-item-subtitle">${isDeferred ? 'Change reason, risk, or date' : 'Postpone with a review date'}</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="mmEdit">
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
        <div class="sheet-item-subtitle">Change type, date, or notes</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="mmAssignOwner">
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
        <div class="sheet-item-subtitle">Assign this task to a crew member</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="mmDelete">
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
        <div class="sheet-item-subtitle">Remove this task permanently</div>
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

  sheet.querySelector('#mmReview')?.addEventListener('click', () => {
    close();
    setTimeout(() => showReviewMaintenanceSheet(item, { onChanged }), 250);
  });

  sheet.querySelector('#mmComplete')?.addEventListener('click', async () => {
    close();
    await completeItem(item, onChanged);
  });

  sheet.querySelector('#mmDefer').addEventListener('click', () => {
    close();
    setTimeout(() => showDeferMaintenanceSheet(item, { onChanged }), 250);
  });

  sheet.querySelector('#mmEdit').addEventListener('click', () => {
    close();
    setTimeout(() => showAddMaintenanceSheet({ item, onSaved: onChanged }), 250);
  });

  sheet.querySelector('#mmAssignOwner').addEventListener('click', () => {
    close();
    setTimeout(() => showAssignOwnerSheet(item, { onChanged }), 250);
  });

  sheet.querySelector('#mmDelete').addEventListener('click', async () => {
    close();
    await deleteItem(item, onChanged);
  });
}

async function completeItem(item, onChanged) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    await updateDoc(doc(db, 'maintenance', String(item._docId)), {
      completed: true,
      status: 'COMPLETED',
      lastModified: now,
      lastModifiedBy: userId
    });

    toast(`Marked complete: ${item.type}`, { kind: 'success' });
    if (onChanged) onChanged();
  } catch (err) {
    console.error('[maintenance] complete failed', err);
    toast('Failed to mark complete', { kind: 'error' });
  }
}

async function deleteItem(item, onChanged) {
  const ok = await confirmSheet({
    title: 'Delete maintenance task?',
    message: `This will permanently remove "${item.type}". This cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    await deleteDoc(doc(db, 'maintenance', String(item._docId)));
    toast(`Deleted: ${item.type}`, { kind: 'success' });
    if (onChanged) onChanged();
  } catch (err) {
    console.error('[maintenance] delete failed', err);
    toast('Failed to delete', { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}