import {showDocumentWork} from './DocumentWorkSheet.js';
import {showDocumentHelp} from './DocumentHelp.js';
import {canManageWork} from '../util/StaffWorkApi.js';
import {ensureWorkInputStyles,revealFieldErrors,clearFieldError} from '../util/WorkFormFeedback.js';
import { italianUI as itUI } from '../i18n.js';
import { t } from '../i18n.js';
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
   
  


<div class="invoice-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

  <div class="sheet-title" style="text-align:center;">${escapeHtml(item.name || t('Document'))}</div>

  <button type="button" id="iv-close" aria-label="${itUI("Close document menu")}"
    style="position:absolute;right:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</div>

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
        <div class="sheet-item-title">${t("Edit")}</div>
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
        <div class="sheet-item-title">${t("Renew")}</div>
        <div class="sheet-item-subtitle">${t("Update expiry date")}</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    ${canManageWork()?`<button type="button" class="sheet-item" id="dmWork" style="width:100%;box-sizing:border-box;text-align:start;font:inherit;color:inherit;border:0"><span class="sheet-item-icon"><svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10l2 2 4-4M9 16h6"/></svg></span><span class="sheet-item-text"><span class="sheet-item-title" style="display:block">${t('Assign work')}</span><span class="sheet-item-subtitle" style="display:block">${t('Describe a document job and send it to Staff Work')}</span></span></button><div class="sheet-gap-8"></div>`:''}
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
        <div class="sheet-item-title">${t("Set responsible person")}</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

<button type="button" class="sheet-item" id="dmHelp" style="width:100%;box-sizing:border-box;text-align:start;font:inherit;color:inherit;border:0"><span class="sheet-item-icon"><svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/></svg></span><span class="sheet-item-text"><span class="sheet-item-title" style="display:block">${t('Help')}</span><span class="sheet-item-subtitle" style="display:block">${t('Responsibility, renewals and manager review')}</span></span></button><div class="sheet-gap-8"></div>
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
        <div class="sheet-item-title">${t("Delete")}</div>
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

  sheet.querySelector('#dmWork')?.addEventListener('click',()=>{close();setTimeout(()=>showDocumentWork(item),250);});
  sheet.querySelector('#dmHelp').addEventListener('click',()=>{close();setTimeout(()=>showDocumentHelp(),250);});
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
  ensureWorkInputStyles();
  const current = item.expiryDate
    ? new Date(item.expiryDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet work-input-sheet';
  sheet.style.display='block';

  sheet.innerHTML = `
    
    

<div class="doc-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

<div class="sheet-title" style="text-align:center;">${t("Renew Document")}</div>

  <button type="button" id="iv-close" aria-label="${itUI("Close doc sheet")}"
    style="position:absolute;right:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</div>


    <div class="add-scroll">
      <label class="add-label" for="rn-date">${t("New Expiry Date")}</label>
      <input class="add-input" id="rn-date" type="date" value="${current}">
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="rnCancel">${t("Cancel")}</button>
      <button type="button" class="csv-btn csv-btn--choose" id="rnSave">${t("Renew")}</button>
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
  sheet.querySelector('#rnCancel').addEventListener('click', close);

  sheet.querySelector('#rnSave').addEventListener('click', async () => {
    const v = sheet.querySelector('#rn-date').value;
    if(revealFieldErrors(sheet,!v?[[sheet.querySelector('#rn-date'),'Select a new expiry date.']]:[]))return;

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
      toast(t('Document renewed'), { kind: 'success' });
    } catch (err) {
      console.error('[document renew] failed', err);
      toast(t('Failed to renew'), { kind: 'error' });
    }
  });
}

async function deleteDocument(item) {
  const ok = await confirmSheet({
    title: t('Delete document?'),
    message: t('removeNamed', {name:item.name}),
    confirmText: t('Delete'),
    cancelText: t('Cancel')
  });
  if (!ok) return;

  try {
    await deleteDoc(doc(db, 'documents', String(item._docId)));
    toast(t('deletedNamed', {name:item.name}), { kind: 'success' });
  } catch (err) {
    console.error('[document delete] failed', err);
    toast(t('Failed to delete'), { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}