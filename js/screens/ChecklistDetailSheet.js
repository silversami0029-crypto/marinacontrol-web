import { checklistItemStatus, createChecklistMaintenance } from '../util/ChecklistMaintenance.js';
import { showMaintenanceDetail } from './MaintenanceDetailSheet.js';
import { sheetCloseButton } from '../ui/sheetClose.js';
import { italianUI as itUI } from '../i18n.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ChecklistDetailSheet.js
import { canEditChecklists } from './ChecklistCreateSheet.js';
import { toast } from '../ui/toast.js';
import { store } from '../store.js';
import {
  collection, doc, getDoc, getDocs, runTransaction
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const STATUS_COLORS = {
  COMPLETED: '#4CAF50',
  IN_PROGRESS: '#FF9800',
  PENDING: '#2196F3',
  CANCELLED: '#737D89'
};

export async function showChecklistDetail(checklist, boats = store.boatsFull || []) {
  const uid = store.authUser?.uid;
  const editable = canEditChecklists() && ['IN_PROGRESS', 'PENDING'].includes(checklist.status);
  let saving = false;
  let closed = false;
  const hasCurrentContext = () => !closed && sheet.isConnected && uid && uid === store.authUser?.uid
    && Number(store.activeClientId) === Number(checklist.clientId) && !store.marinaSwitching
    && (store.activeMarina?.clientType !== 'yacht_operator'
      || Number(store.assignedYacht?.id) === Number(checklist.boatId));
  const isCurrent = () => hasCurrentContext() && canEditChecklists();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet sheet--tall';

  const statusColor = STATUS_COLORS[checklist.status] || '#737D89';
  const boatName = boats.find(b => Number(b.id) === Number(checklist.boatId))?.name
    || (Number(checklist.boatId) > 0
      ? `${tr('Boat')} #${checklist.boatId} — ${tr('name unavailable')}` : tr('Boat not assigned'));

  sheet.innerHTML = `
    ${sheetCloseButton()}
    <div class="sheet-title" style="text-align:center;">${escapeHtml(checklist.name || itUI('Checklist'))}</div>
    <div class="chk-detail-status" style="background:${statusColor};">${escapeHtml(itUI(checklist.status.replace('_',' ')))}</div>

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
        <div class="md-line"><span class="md-label">${tr("Type:")}</span> <span class="md-value">${escapeHtml(itUI(checklist.type || '—'))}</span></div>
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
    if (saving) return;
    closed = true;
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('[data-sheet-close]').addEventListener('click', close);
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

    const items = snap.docs.map(item => ({ ...item.data(), ref: item.ref }))
      .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
    if (!hasCurrentContext()) return;
    itemsEl.innerHTML = items.map((data, index) => {
      const label = data.text || data.itemText || data.label || data.name || data.title ||
        data.description || data.item || '(untitled)';
      const status = checklistItemStatus(data);
      const mark = status === 'FAIL' ? '✗' : status === 'PASS' ? '✓' : '○';
      const color = status === 'FAIL' ? '#F44336' : status === 'PASS' ? '#4CAF50' : '#737D89';

      return `
        <div class="chk-item">
          <div class="chk-item-mark" style="color:${color};">${mark}</div>
          <div class="chk-item-info">
            ${data.category ? `<div class="chk-item-notes">${escapeHtml(data.category)}</div>` : ''}
            <div class="chk-item-label">${escapeHtml(label)}</div>
            ${data.notes ? `<div class="chk-item-notes">${escapeHtml(data.notes)}</div>` : ''}
            ${editable ? `<select class="add-input chk-result-select" data-checklist-result aria-label="${escapeHtml(label)}">
              ${[['NOT_STARTED','Not started'],['PASS','Pass'],['FAIL','Fail']].map(([value, text]) =>
                `<option value="${value}"${status === value ? ' selected' : ''}>${escapeHtml(tr(text))}</option>`).join('')}
            </select>` : ''}
            ${canEditChecklists() && checklist.status !== 'CANCELLED' && (status === 'FAIL' || data.maintenanceTaskCloudId || data.maintenanceTaskId || data.maintenanceId) ? `
              <div style="margin-top:8px"><button type="button" class="dash-filter" style="border:1px solid var(--color-water-blue, #2196F3);color:var(--color-water-blue, #2196F3)" data-maintenance-item="${index}">${tr(data.maintenanceTaskCloudId ? 'View maintenance' : data.maintenanceTaskId || data.maintenanceId ? 'Maintenance already linked' : 'Create maintenance task')}</button>
              <div role="status" data-maintenance-message></div></div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    itemsEl.querySelectorAll('[data-maintenance-item]').forEach(button => {
      button.onclick = async () => {
        if (saving || !isCurrent()) return;
        const item = items[Number(button.dataset.maintenanceItem)];
        const message = button.parentElement.querySelector('[data-maintenance-message]');
        const controls = [...itemsEl.querySelectorAll('[data-checklist-result]')];
        if (controls.some((control, index) => control.value !== checklistItemStatus(items[index]))) {
          message.textContent = tr('Save your checklist changes before opening maintenance.');
          return;
        }
        saving = true;
        const buttons = [...sheet.querySelectorAll('button, select')];
        buttons.forEach(control => { control.disabled = true; });
        message.textContent = '';
        try {
          let task;
          if (item.maintenanceTaskCloudId) {
            const snapshot = await getDoc(doc(db, 'maintenance', item.maintenanceTaskCloudId));
            task = snapshot.exists() ? { ...snapshot.data(), _docId: snapshot.id } : null;
            if (!task || Number(task.clientId) !== Number(checklist.clientId))
              throw new Error(tr('Linked maintenance is unavailable. Check Maintenance before creating another task.'));
          } else {
            const result = await createChecklistMaintenance(checklist, item,
              store.userProfile?.userId || uid, isCurrent);
            task = result.task;
            // Reusing another user's task must not acknowledge their unrelated result edits.
            if (result.created) checklist.revision = result.revision;
            item.maintenanceTaskCloudId = task._docId;
            item.maintenanceTaskId = task.id;
            button.textContent = tr('View maintenance');
            if (result.created) toast(tr('Maintenance task created'), { kind: 'success' });
          }
          if (isCurrent()) {
            if (Number(task.boatId) !== Number(checklist.boatId))
              toast(tr('This linked task has a different boat reference from the checklist. Check both records before making changes.'), { kind: 'error', duration: 8000 });
            showMaintenanceDetail(task);
          }
        } catch (err) {
          if (isCurrent()) message.textContent = err.message || tr('Could not create maintenance.');
        } finally {
          saving = false;
          buttons.forEach(control => { control.disabled = false; });
        }
      };
    });

    if (editable && sheet.isConnected) {
      const actions = document.createElement('div');
      actions.style.cssText = 'padding:8px 16px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center';
      actions.innerHTML = `
        <p role="alert" style="flex-basis:100%;margin:0;color:#ff9999"></p>
        <button type="button" class="dash-filter" data-save-progress>${tr('Save progress')}</button>
        <button type="button" class="dash-filter is-active" data-complete>${tr('Complete checklist')}</button>`;
      sheet.querySelector('#chkDetailClose').before(actions);
      const error = actions.querySelector('[role=alert]');
      const controls = [...itemsEl.querySelectorAll('[data-checklist-result]')];
      const update = async complete => {
        if (saving || !isCurrent()) return;
        const statuses = controls.map(select => select.value);
        if (complete && (items.length !== checklist.totalItems
            || items.some((item, index) => (item.mandatory ?? item.isMandatory ?? true) && statuses[index] === 'NOT_STARTED'))) {
          error.textContent = tr('Record a result for every mandatory item before completing.');
          return;
        }
        saving = true;
        error.textContent = '';
        const busy = [...controls, ...actions.querySelectorAll('button')];
        busy.forEach(button => { button.disabled = true; });
        try {
          await saveChecklistResults(checklist, items, statuses, complete,
            store.userProfile?.name || store.authUser?.displayName || '', isCurrent);
          saving = false;
          if (sheet.isConnected) {
            close();
            toast(tr(complete ? 'Checklist completed' : 'Checklist progress saved'), { kind: 'success' });
          }
        } catch (err) {
          if (sheet.isConnected) error.textContent = err.message || tr('Could not save checklist.');
        } finally {
          saving = false;
          busy.forEach(button => { button.disabled = false; });
        }
      };
      actions.querySelector('[data-save-progress]').onclick = () => update(false);
      actions.querySelector('[data-complete]').onclick = () => update(true);
    }
  } catch (err) {
    console.warn('[checklist items] load failed', err?.code || err?.message || err);
    itemsEl.innerHTML = `<div class="eq-hist-empty">${tr("Couldn't load items")}</div>`;
  }
}

async function saveChecklistResults(checklist, items, statuses, complete, userName, isCurrent) {
  if (items.length !== statuses.length || items.length !== Number(checklist.totalItems)
      || statuses.some(status => !['NOT_STARTED', 'PASS', 'FAIL'].includes(status))) {
    throw new Error(tr('Checklist items changed. Close it and open it again before saving.'));
  }
  const parent = doc(db, 'checklists', checklist._docId);
  const now = Date.now();
  await runTransaction(db, async transaction => {
    if (!isCurrent()) throw new Error(tr('Your marina or session changed. Reopen the checklist.'));
    const snapshot = await transaction.get(parent);
    const current = snapshot.data();
    if (!current || Number(current.clientId) !== checklist.clientId || Number(current.boatId) !== checklist.boatId
        || (current.status || 'PENDING').toUpperCase() !== checklist.status
        || Number(current.webChecklistRevision || 0) !== checklist.revision
        || Number(current.completedItems || 0) !== checklist.completedItems
        || Number(current.totalItems || 0) !== checklist.totalItems) {
      throw new Error(tr('This checklist changed. Close it and open it again before saving.'));
    }
    const freshItems = await Promise.all(items.map(item => transaction.get(item.ref)));
    if (!isCurrent()) throw new Error(tr('Your marina or session changed. Reopen the checklist.'));
    if (freshItems.some((fresh, index) => !fresh.exists()
        || checklistItemStatus(fresh.data()) !== checklistItemStatus(items[index]))) {
      throw new Error(tr('This checklist changed. Close it and open it again before saving.'));
    }
    if (complete && freshItems.some((fresh, index) =>
      (fresh.data().mandatory ?? fresh.data().isMandatory ?? true) && statuses[index] === 'NOT_STARTED')) {
      throw new Error(tr('Record a result for every mandatory item before completing.'));
    }
    const passedItems = statuses.filter(status => status === 'PASS').length;
    const failedItems = statuses.filter(status => status === 'FAIL').length;
    items.forEach((item, index) => {
      const status = statuses[index];
      if (status === checklistItemStatus(item)) return;
      const answered = status !== 'NOT_STARTED';
      transaction.update(item.ref, {
        status, checked: status === 'PASS', passed: status === 'PASS', failed: status === 'FAIL',
        completed: answered, result: answered ? status : null,
        completedAt: answered ? now : 0, completedBy: answered ? userName : ''
      });
    });
    transaction.update(parent, {
      status: complete ? 'COMPLETED' : 'IN_PROGRESS',
      passedItems, failedItems, completedItems: passedItems + failedItems,
      completedAt: complete ? now : 0, completedBy: complete ? userName : '',
      webChecklistRevision: checklist.revision + 1, lastModified: now
    });
  });
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
