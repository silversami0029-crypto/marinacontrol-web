import {showEquipmentHelp} from './EquipmentHelp.js';
import {showEquipmentWork} from './EquipmentWorkSheet.js';
import {canManageWork} from '../util/StaffWorkApi.js';
import { sheetCloseButton } from '../ui/sheetClose.js';
import { italianUI as itUI } from '../i18n.js';
import { t } from '../i18n.js';
// js/screens/EquipmentMenuSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { showAddEquipmentSheet } from './AddEquipmentSheet.js';
import { showEquipmentDetail } from './EquipmentDetailSheet.js';
import { doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { showEquipmentHistory } from './EquipmentHistorySheet.js';
import { logHistory } from '../util/history.js';

export function showEquipmentMenu(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    ${sheetCloseButton()}
    <div class="sheet-title" style="text-align:center;">${escapeHtml(item.manufacturer || t('Equipment'))}</div>

    <div class="sheet-item" id="emView">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("View")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="emEdit">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Edit")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    ${canManageWork()?`<button type="button" class="sheet-item" id="emWork" style="width:100%;box-sizing:border-box;text-align:start;font:inherit;color:inherit;border:0">
      <span class="sheet-item-icon"><svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10l2 2 4-4M9 16h6"/></svg></span>
      <span class="sheet-item-text"><span class="sheet-item-title" style="display:block">${t('Assign work')}</span><span class="sheet-item-subtitle" style="display:block">${t('Describe a job and send it to Staff Work')}</span></span>
    </button><div class="sheet-gap-8"></div>`:''}
    <div class="sheet-item" id="emAssign">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Set responsible person")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="emDuplicate">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Duplicate")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="emHistory">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("History")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <button type="button" class="sheet-item" id="emHelp" style="width:100%;box-sizing:border-box;text-align:start;font:inherit;color:inherit;border:0">
      <span class="sheet-item-icon"><svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/></svg></span>
      <span class="sheet-item-text"><span class="sheet-item-title" style="display:block">${t('Help')}</span><span class="sheet-item-subtitle" style="display:block">${t('Responsibility, jobs and manager review')}</span></span>
    </button><div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="emDelete">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Delete")}</div></div>
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
  sheet.querySelector('[data-sheet-close]').addEventListener('click', close);

  sheet.querySelector('#emView').addEventListener('click', () => {
    close();
    setTimeout(() => showEquipmentDetail(item), 250);
  });

  sheet.querySelector('#emEdit').addEventListener('click', () => {
    close();
    setTimeout(() => showAddEquipmentSheet({ item }), 250);
  });

  sheet.querySelector('#emHelp').addEventListener('click',()=>{close();setTimeout(()=>showEquipmentHelp(),250);});
  sheet.querySelector('#emWork')?.addEventListener('click',()=>{close();setTimeout(()=>showEquipmentWork(item),250);});
  sheet.querySelector('#emAssign').addEventListener('click', () => {
    close();
    setTimeout(() => showAssignOwner(item), 250);
  });

  sheet.querySelector('#emDuplicate').addEventListener('click', () => {
    close();
    setTimeout(() => duplicateEquipment(item), 250);
  });

  sheet.querySelector('#emHistory').addEventListener('click', () => {
    close();
    setTimeout(() => showEquipmentHistory(item), 250);
  });

  sheet.querySelector('#emDelete').addEventListener('click', async () => {
    close();
    await deleteEquipment(item);
  });
}



async function showAssignOwner(item) {
  const clientId = Number(store.activeClientId);

  const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { db } = await import('../firebase.js');

  let crewNames = [];
  try {
    const snap = await getDocs(query(
      collection(db, 'crew'),
      where('clientId', '==', clientId)
    ));
    const unique = new Set();
    snap.forEach(d => {
      const name = (d.data().name || '').trim();
      if (name) unique.add(name);
    });
    crewNames = Array.from(unique).sort((a, b) => a.localeCompare(b));
  } catch {}

  const current = item.assignedTo || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    ${sheetCloseButton()}
    <div class="sheet-title" style="text-align:center;">${t("Set responsible person")}</div>

    <p class="work-input-hint">${t("This records equipment responsibility. It does not create a task or send a Staff Work alert. Use Assign work to give someone a job.")}</p><div class="ao-scroll">
      ${crewNames.length === 0
        ? `<div class="assign-empty">${t("No crew members found.")}<br>${t("Add crew first.")}</div>`
        : crewNames.map(name => `
            <button type="button" class="ao-row${name === current ? ' is-current' : ''}" data-name="${escapeAttr(name)}">
              <span class="ao-radio"></span>
              <span class="ao-name">${escapeHtml(name)}</span>
              ${name === current ? '<span class="ao-check">✓</span>' : ''}
            </button>
          `).join('')}
    </div>

    <div class="ao-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="eoCancel">${t("Cancel")}</button>
      ${current ? `<button type="button" class="csv-btn ao-unassign" id="eoUnassign">${t("Unassign")}</button>` : ''}
      <button type="button" class="csv-btn csv-btn--choose" id="eoAssign">${t("Assign")}</button>
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
  sheet.querySelector('[data-sheet-close]').addEventListener('click', close);
  sheet.querySelector('#eoCancel').addEventListener('click', close);

  let picked = current;

  sheet.querySelectorAll('.ao-row').forEach(row => {
    row.addEventListener('click', () => {
      picked = row.dataset.name;
      sheet.querySelectorAll('.ao-row').forEach(r => {
        r.classList.toggle('is-current', r.dataset.name === picked);
        const check = r.querySelector('.ao-check');
        if (check) check.remove();
        if (r.dataset.name === picked) {
          const span = document.createElement('span');
          span.className = 'ao-check';
          span.textContent = '✓';
          r.appendChild(span);
        }
      });
    });
  });

  sheet.querySelector('#eoAssign').addEventListener('click', async () => {
    if (!picked) { toast(t('Select a crew member'), { kind: 'error' }); return; }
    close();
    await setOwner(item, picked);
  });

  const unassignBtn = sheet.querySelector('#eoUnassign');
  if (unassignBtn) {
    unassignBtn.addEventListener('click', async () => {
      close();
      await setOwner(item, null);
    });
  }
}

async function setOwner(item, name) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    await updateDoc(doc(db, 'equipment', String(item._docId)), {
      assignedTo: name || '',
      assignedBy: name ? userId : '',
      assignedAt: name ? now : 0,
      lastModified: now,
      lastModifiedBy: userId
    });

  await logHistory({
      entityType: 'EQUIPMENT',
      entityId: item.id,
      itemName: item.manufacturer || '',
      boatId: item.boatId,
      action: 'OWNER_ASSIGNED',
      title: name ? `Owner assigned: ${name}` : itUI('Owner unassigned'),
      detail: name ? `${item.assignedTo || 'None'} → ${name}` : `${item.assignedTo || 'None'} → None`
    });

    toast(name ? t('assignedNamed', {name:name}) : itUI('Unassigned'), { kind: 'success' });
  } catch (err) {
    console.error('[equipment assign] failed', err);
    toast(t('Failed to assign owner'), { kind: 'error' });
  }
}

async function duplicateEquipment(item) {
  try {
    const clientId = Number(store.activeClientId);
    const snap = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).getDocs(
      (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).query(
        (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).collection(db, 'equipment'),
        (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).where('clientId', '==', clientId)
      )
    );
    let maxId = 0;
    snap.forEach(d => {
      const v = Number(d.data()?.id || 0);
      if (v > maxId) maxId = v;
    });
    const nextId = maxId + 1;
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `eq-${now}-${nextId}`);
    const { setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    await setDoc(doc(db, 'equipment', cloudId), {
      id: nextId,
      clientId,
      boatId: Number(item.boatId),
      manufacturer: stripCopySuffix(item.manufacturer) + ' (Copy)',
      model: item.model || '',
      type: item.type || '',
      serialNumber: item.serialNumber || '',
      location: item.location || '',
      status: item.status || 'OPERATIONAL',
      assignedTo: item.assignedTo || '',
      assignedBy: '',
      assignedAt: 0,
      notes: item.notes || '',
      lastModified: now,
      lastModifiedBy: userId,
      syncTime: serverTimestamp(),
      syncedAt: 0
    });
    await logHistory({
      entityType: 'EQUIPMENT',
      entityId: nextId,
      itemName: stripCopySuffix(item.manufacturer) + ' (Copy)',
      boatId: item.boatId,
      action: 'DUPLICATED',
      title: 'Equipment duplicated',
      detail: `Original: ${item.manufacturer}`
    });

    toast(t('Equipment duplicated'), { kind: 'success' });
  } catch (err) {
    console.error('[equipment duplicate] failed', err);
    toast(t('Failed to duplicate'), { kind: 'error' });
  }
}

async function deleteEquipment(item) {
  const ok = await confirmSheet({
    title: t('Delete equipment?'),
    message: t('removeNamed', {name:item.manufacturer}),
    confirmText: t('Delete'),
    cancelText: t('Cancel')
  });
  if (!ok) return;

    await logHistory({
      entityType: 'EQUIPMENT',
      entityId: item.id,
      itemName: item.manufacturer || '',
      boatId: item.boatId,
      action: 'DELETED',
      title: 'Equipment deleted'
    });

  try {
    await deleteDoc(doc(db, 'equipment', String(item._docId)));
    toast(t('deletedNamed', {name:item.manufacturer}), { kind: 'success' });
  } catch (err) {
    console.error('[equipment delete] failed', err);
    toast(t('Failed to delete'), { kind: 'error' });
  }
}

function stripCopySuffix(name) {
  return String(name || '').replace(/(\s*\(Copy\))+\s*$/i, '').trim();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}