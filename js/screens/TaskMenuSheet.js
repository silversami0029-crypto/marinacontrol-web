// js/screens/TaskMenuSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { logHistory } from '../util/history.js';
import { showAddTaskSheet } from './AddTaskSheet.js';
import { showTaskDetail } from './TaskDetailSheet.js';
import { showTaskHistory } from './TaskHistorySheet.js';
import { doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showTaskMenu(item) {
  const isOpen      = item.status === 'OPEN';
  const isCompleted = item.status === 'COMPLETED';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(item.title || 'Task')}</div>

    <div class="sheet-item" id="tmView">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">View</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="tmEdit">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">Edit</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    ${isOpen ? `
      <div class="sheet-item" id="tmComplete">
        <div class="sheet-item-icon">
          <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div class="sheet-item-text"><div class="sheet-item-title">Mark Complete</div></div>
      </div>
      <div class="sheet-gap-8"></div>
    ` : ''}

    ${isCompleted ? `
      <div class="sheet-item" id="tmReopen">
        <div class="sheet-item-icon">
          <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7"/>
            <polyline points="3 4 3 9 8 9"/>
          </svg>
        </div>
        <div class="sheet-item-text"><div class="sheet-item-title">Reopen Task</div></div>
      </div>
      <div class="sheet-gap-8"></div>
    ` : ''}

    <div class="sheet-item" id="tmAssign">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">Assign Owner</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="tmDuplicate">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">Duplicate</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="tmHistory">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">History</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="tmDelete">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">Delete</div></div>
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

  sheet.querySelector('#tmView').addEventListener('click', () => {
    close(); setTimeout(() => showTaskDetail(item), 250);
  });
  sheet.querySelector('#tmEdit').addEventListener('click', () => {
    close(); setTimeout(() => showAddTaskSheet({ item }), 250);
  });
  const comp = sheet.querySelector('#tmComplete');
  if (comp) comp.addEventListener('click', () => { close(); setTimeout(() => markComplete(item), 250); });
  const re = sheet.querySelector('#tmReopen');
  if (re) re.addEventListener('click', () => { close(); setTimeout(() => reopenTask(item), 250); });
  sheet.querySelector('#tmAssign').addEventListener('click', () => {
    close(); setTimeout(() => showAssignOwner(item), 250);
  });
  sheet.querySelector('#tmDuplicate').addEventListener('click', () => {
    close(); setTimeout(() => duplicateTask(item), 250);
  });
  sheet.querySelector('#tmHistory').addEventListener('click', () => {
    close(); setTimeout(() => showTaskHistory(item), 250);
  });
  sheet.querySelector('#tmDelete').addEventListener('click', async () => {
    close(); await deleteTask(item);
  });
}

async function markComplete(item) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    await updateDoc(doc(db, 'tasks', String(item._docId)), {
      status: 'COMPLETED',
      completedAt: now,
      lastModified: now,
      lastModifiedBy: userId
    });
    await logHistory({
      entityType: 'TASK', entityId: item.id, itemName: item.title, boatId: item.boatId,
      action: 'COMPLETED', title: 'Task marked complete'
    });
    toast('Task completed', { kind: 'success' });
  } catch (err) {
    console.error('[task complete] failed', err);
    toast('Failed to complete task', { kind: 'error' });
  }
}

async function reopenTask(item) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    await updateDoc(doc(db, 'tasks', String(item._docId)), {
      status: 'OPEN',
      completedAt: 0,
      lastModified: now,
      lastModifiedBy: userId
    });
    await logHistory({
      entityType: 'TASK', entityId: item.id, itemName: item.title, boatId: item.boatId,
      action: 'REOPENED', title: 'Task reopened'
    });
    toast('Task reopened', { kind: 'success' });
  } catch (err) {
    console.error('[task reopen] failed', err);
    toast('Failed to reopen task', { kind: 'error' });
  }
}

async function showAssignOwner(item) {
  const clientId = Number(store.activeClientId);
  const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { db } = await import('../firebase.js');

  let crewNames = [];
  try {
    const snap = await getDocs(query(collection(db, 'crew'), where('clientId', '==', clientId)));
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
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Assign Owner</div>

    <div class="ao-scroll">
      ${crewNames.length === 0
        ? `<div class="assign-empty">No crew members found.<br>Add crew first.</div>`
        : crewNames.map(name => `
            <button type="button" class="ao-row${name === current ? ' is-current' : ''}" data-name="${escapeAttr(name)}">
              <span class="ao-radio"></span>
              <span class="ao-name">${escapeHtml(name)}</span>
              ${name === current ? '<span class="ao-check">✓</span>' : ''}
            </button>
          `).join('')}
    </div>

    <div class="ao-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="toCancel">Cancel</button>
      ${current ? `<button type="button" class="csv-btn ao-unassign" id="toUnassign">Unassign</button>` : ''}
      <button type="button" class="csv-btn csv-btn--choose" id="toAssign">Assign</button>
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
  sheet.querySelector('#toCancel').addEventListener('click', close);

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

  sheet.querySelector('#toAssign').addEventListener('click', async () => {
    if (!picked) { toast('Select a crew member', { kind: 'error' }); return; }
    close();
    await setOwner(item, picked);
  });

  const unBtn = sheet.querySelector('#toUnassign');
  if (unBtn) unBtn.addEventListener('click', async () => { close(); await setOwner(item, null); });
}

async function setOwner(item, name) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    await updateDoc(doc(db, 'tasks', String(item._docId)), {
      assignedTo: name || '',
      assignedBy: name ? userId : '',
      assignedAt: name ? now : 0,
      lastModified: now,
      lastModifiedBy: userId
    });
    await logHistory({
      entityType: 'TASK', entityId: item.id, itemName: item.title, boatId: item.boatId,
      action: 'OWNER_ASSIGNED',
      title: name ? `Owner assigned: ${name}` : 'Owner unassigned',
      detail: name ? `${item.assignedTo || 'None'} → ${name}` : `${item.assignedTo || 'None'} → None`
    });
    toast(name ? `Assigned to ${name}` : 'Unassigned', { kind: 'success' });
  } catch (err) {
    console.error('[task assign] failed', err);
    toast('Failed to assign owner', { kind: 'error' });
  }
}

async function duplicateTask(item) {
  try {
    const clientId = Number(store.activeClientId);
    const { collection, query, where, getDocs, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDocs(query(collection(db, 'tasks'), where('clientId', '==', clientId)));
    let maxId = 0;
    snap.forEach(d => {
      const v = Number(d.data()?.id || 0);
      if (v > maxId) maxId = v;
    });
    const nextId = maxId + 1;
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `task-${now}-${nextId}`);

    await setDoc(doc(db, 'tasks', cloudId), {
      id: nextId,
      clientId,
      boatId: Number(item.boatId),
      boatName: item.boatName || '',
      title: stripCopySuffix(item.title) + ' (Copy)',
      category: item.category || '',
      priority: item.priority || 'MEDIUM',
      dueDate: item.dueDate || '',
      status: 'OPEN',
      notes: item.notes || '',
      assignedTo: '',
      assignedBy: '',
      assignedAt: 0,
      alternate: item.alternate || 0,
      dueHours: item.dueHours || 0,
      repeatType: item.repeatType || 'Never',
      scheduleType: item.scheduleType || 'Onetime',
      recurringType: item.recurringType || '',
      interval: item.interval || 1,
      createdAt: now,
      completedAt: 0,
      deletedAt: 0,
      lastModified: now,
      lastModifiedBy: userId,
      syncTime: serverTimestamp(),
      syncedAt: 0
    });

    await logHistory({
      entityType: 'TASK', entityId: nextId,
      itemName: stripCopySuffix(item.title) + ' (Copy)',
      boatId: item.boatId,
      action: 'DUPLICATED', title: 'Task duplicated',
      detail: `Original: ${item.title}`
    });

    toast('Task duplicated', { kind: 'success' });
  } catch (err) {
    console.error('[task duplicate] failed', err);
    toast('Failed to duplicate', { kind: 'error' });
  }
}

async function deleteTask(item) {
  const ok = await confirmSheet({
    title: 'Delete task?',
    message: `This will permanently remove "${item.title}".`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    await logHistory({
      entityType: 'TASK', entityId: item.id, itemName: item.title, boatId: item.boatId,
      action: 'DELETED', title: 'Task deleted'
    });
    await deleteDoc(doc(db, 'tasks', String(item._docId)));
    toast(`Deleted: ${item.title}`, { kind: 'success' });
  } catch (err) {
    console.error('[task delete] failed', err);
    toast('Failed to delete', { kind: 'error' });
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