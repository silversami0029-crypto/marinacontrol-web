// js/screens/AddTaskSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import {
  doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { db } from '../firebase.js';

const TASK_CATEGORIES = ['Cleaning', 'Crew', 'Administrative', 'Technical', 'Other'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'CRITICAL', 'OVERDUE'];

export function showAddTaskSheet(opts = {}) {
  const { boatId, boatName, item } = opts;
  const isEdit = !!item;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
<div class="task-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

  <div class="sheet-title"
    style="flex:1;margin:0;padding:12px 48px;text-align:center;">
    ${isEdit ? 'Edit Task' : 'Add Task'}
  </div>

  <button type="button" id="iv-close" aria-label="Close task sheet"
    style="position:absolute;right:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</div>

    <form id="tkForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">
        ${boatName ? `
          <label class="add-label">Boat</label>
          <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
            Boat: ${escapeHtml(boatName)}
          </div>
        ` : ''}

        <label class="add-label" for="tk-title">Title</label>
        <input class="add-input" id="tk-title" type="text" placeholder="e.g. Replace engine impeller">

        <label class="add-label" for="tk-category">Category</label>
        <select class="add-input add-select" id="tk-category">
          <option value="">Select category…</option>
          ${TASK_CATEGORIES.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>

        <label class="add-label" for="tk-priority">Priority</label>
        <select class="add-input add-select" id="tk-priority">
          ${TASK_PRIORITIES.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>

        <label class="add-label" for="tk-due">Due Date</label>
        <input class="add-input" id="tk-due" type="date">

        <label class="add-label" for="tk-notes">Notes</label>
        <textarea class="add-input" id="tk-notes" rows="3" placeholder="Notes"></textarea>
      </div>

      <button type="submit" class="add-save" id="tk-save">
        ${isEdit ? 'Update Task' : '+ Add Task'}
      </button>
    </form>
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

  if (isEdit) {
    sheet.querySelector('#tk-title').value = item.title || '';
    setSelectValue(sheet.querySelector('#tk-category'), item.category || '');
    sheet.querySelector('#tk-priority').value = item.priority || 'MEDIUM';
    sheet.querySelector('#tk-due').value = item.dueDate || '';
    sheet.querySelector('#tk-notes').value = item.notes || '';
  } else {
    sheet.querySelector('#tk-priority').value = 'MEDIUM';
  }

  const form = sheet.querySelector('#tkForm');
  const save = sheet.querySelector('#tk-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title    = sheet.querySelector('#tk-title').value.trim();
    const category = sheet.querySelector('#tk-category').value;
    const priority = sheet.querySelector('#tk-priority').value;
    const dueDate  = sheet.querySelector('#tk-due').value;
    const notes    = sheet.querySelector('#tk-notes').value.trim();

    if (!title) { toast('Enter a title', { kind: 'error' }); sheet.querySelector('#tk-title').focus(); return; }
    if (!category) { toast('Select a category', { kind: 'error' }); return; }

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateTask(item, { title, category, priority, dueDate, notes });
      } else {
        if (!boatId) throw new Error('No boat selected');
        await createTask({ boatId, title, category, priority, dueDate, notes });
      }
      close();
      toast(isEdit ? 'Task updated' : 'Task added', { kind: 'success' });
    } catch (err) {
      console.error('[task save] failed', err);
      save.disabled = false;
      save.textContent = isEdit ? 'Update Task' : '+ Add Task';
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to save.';
    }
  });
}

function setSelectValue(select, value) {
  if (!select) return;
  if (!value) { select.value = ''; return; }
  const exists = Array.from(select.options).some(o => o.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  select.value = value;
}

async function createTask(payload) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  const now = Date.now();
  const nextId = now;
  const userId = String(store.userProfile?.userId || 0);
  const cloudId = crypto.randomUUID ? crypto.randomUUID() : `task-${clientId}-${now}`;
  const boatName = store.boatsFull?.find(b => Number(b.id) === Number(payload.boatId))?.name || '';

  await setDoc(doc(db, 'tasks', cloudId), {
    id: nextId,
    cloudId,
    clientId,
    boatId: Number(payload.boatId),
    boatName,
    title: payload.title,
    category: payload.category,
    priority: payload.priority,
    dueDate: payload.dueDate || '',
    status: 'OPEN',
    notes: payload.notes || '',
    assignedTo: '',
    assignedBy: '',
    assignedAt: 0,
    alternate: 0,
    dueHours: 0,
    repeatType: 'Never',
    scheduleType: 'Onetime',
    recurringType: '',
    interval: 1,
    createdAt: now,
    completedAt: 0,
    deletedAt: 0,
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  await logHistory({
    entityType: 'TASK',
    entityId: nextId,
    itemName: payload.title,
    boatId: payload.boatId,
    action: 'CREATED',
    title: 'Task created',
    detail: `${payload.priority} · ${payload.category}`
  });

  return nextId;
}

async function updateTask(item, payload) {
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await updateDoc(doc(db, 'tasks', String(item._docId)), {
    title: payload.title,
    category: payload.category,
    priority: payload.priority,
    dueDate: payload.dueDate || '',
    notes: payload.notes || '',
    lastModified: now,
    lastModifiedBy: userId
  });

  await logHistory({
    entityType: 'TASK',
    entityId: item.id,
    itemName: payload.title,
    boatId: item.boatId,
    action: 'UPDATED',
    title: 'Task edited'
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}