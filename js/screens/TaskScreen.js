import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/TaskScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showTaskMenu } from './TaskMenuSheet.js';
import { showTaskDetail } from './TaskDetailSheet.js';
import { showTaskHelp } from './TaskHelp.js';
import {
  collection, query, where, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';


let unsubscribe = null;
let currentBoatId = 0;
let currentBoatName = '';
let currentItems = [];
let filterMode = 'ALL';   // 'ALL' | 'OPEN' | 'OVERDUE' | 'COMPLETED'
let isSearchOpen = false;

/* Android parity: priority_overdue #EF4444, priority_critical #DC2626,
   priority_medium #F59E0B, priority_low #10B981 */
const PRIORITY_COLORS = {
  OVERDUE:  '#EF4444',
  CRITICAL: '#DC2626',
  MEDIUM:   '#F59E0B',
  LOW:      '#10B981'
};

export function mountTaskScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlBoatId = Number(params.get('boatId') || 0);

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  isSearchOpen = false;
  filterMode = 'ALL';

  screen.innerHTML = `
    <div class="eq-header" id="tkHeader">
      <div class="eq-header-row">
        <button class="eq-icon-btn" id="tkBack" aria-label="${tr("Back")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="eq-pill" id="tkPill">${tr("Tasks")}</div>
        <button class="eq-icon-btn" id="tkHelp" aria-label="${tr("Help")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="eq-header-spacer"></div>
        <button class="eq-icon-btn" id="tkSearchToggle" aria-label="${tr("Search")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="tkSearchBar" hidden>
      <input id="tkSearchInput" type="text" placeholder="${tr("Search tasks...")}" autocomplete="off">
      <button type="button" class="search-cancel" id="tkSearchCancel">${tr("Cancel")}</button>
    </div>

    <div class="dash-filters" id="tkFilters">
      <button type="button" class="dash-filter is-active" data-tk-filter="ALL">${tr("All")}<span class="tk-count" data-tk-count="ALL"></span></button>
      <button type="button" class="dash-filter" data-tk-filter="OPEN">${tr("Open")}<span class="tk-count" data-tk-count="OPEN"></span></button>
      <button type="button" class="dash-filter" data-tk-filter="OVERDUE">${tr("Overdue")}<span class="tk-count" data-tk-count="OVERDUE"></span></button>
      <button type="button" class="dash-filter" data-tk-filter="COMPLETED">${tr("Completed")}<span class="tk-count" data-tk-count="COMPLETED"></span></button>
    </div>

    <div class="eq-list" id="tkList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="tkFabAdd" aria-label="${tr("Add task")}">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('tkBack').addEventListener('click', () => {
    location.hash = '#/boat-dashboard?boatId=' + currentBoatId;
  });

    document.getElementById('tkHelp').addEventListener('click', () => {
    showTaskHelp();
  });

  document.getElementById('tkSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('tkHeader').hidden = true;
    document.getElementById('tkSearchBar').hidden = false;
    document.getElementById('tkSearchInput').focus();
  });

  document.getElementById('tkSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('tkSearchBar').hidden = true;
    document.getElementById('tkHeader').hidden = false;
    document.getElementById('tkSearchInput').value = '';
    renderList();
  });

  document.getElementById('tkSearchInput').addEventListener('input', renderList);

  document.getElementById('tkFabAdd').addEventListener('click', async () => {
    const m = await import('./AddTaskSheet.js');
    m.showAddTaskSheet({ boatId: currentBoatId, boatName: currentBoatName });
  });

  screen.querySelectorAll('[data-tk-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterMode = btn.dataset.tkFilter;
      screen.querySelectorAll('[data-tk-filter]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.tkFilter === filterMode)
      );
      renderList();
    });
  });

  resolveBoatAndSubscribe(urlBoatId);
}

async function resolveBoatAndSubscribe(urlBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('tkList').innerHTML =
      `<div class="boats-empty"><h2>${tr("No client assigned")}</h2></div>`;
    return;
  }

  let boatId = urlBoatId;

  try {
    if (!boatId && store.activeBoatId) boatId = Number(store.activeBoatId);

    if (!boatId) {
      const snap = await getDocs(query(
        collection(db, 'boats'),
        where('clientId', '==', clientId),
        where('isActive', '==', true)
      ));
      if (!snap.empty) {
        const d = snap.docs[0].data();
        boatId = Number(d.id || snap.docs[0].id);
        currentBoatName = d.name || '';
      }
    } else {
      const snap = await getDocs(query(
        collection(db, 'boats'),
        where('clientId', '==', clientId),
        where('id', '==', Number(boatId))
      ));
      if (!snap.empty) currentBoatName = snap.docs[0].data().name || '';
    }
  } catch (err) {
    console.error('[tasks] boat lookup failed', err);
  }

  if (!boatId) {
    document.getElementById('tkList').innerHTML =
      `<div class="boats-empty">
         <h2>${tr("No active boat")}</h2>
         <p>${tr("Set a boat as active to see its tasks.")}</p>
       </div>`;
    return;
  }

  currentBoatId = boatId;
  document.getElementById('tkPill').textContent = currentBoatName
    ? `${tr('Tasks')} · ${currentBoatName}`
    : tr('Tasks');

  subscribeToTasks(clientId);
}

function subscribeToTasks(clientId) {
  const q = query(
    collection(db, 'tasks'),
    where('clientId', '==', Number(clientId))
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentItems = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: Number(data.id || 0),
          _docId: d.id,
          clientId: Number(data.clientId || 0),
          boatId: Number(data.boatId || 0),
          boatName: currentBoatName,
          title: data.title || '',
          priority: (data.priority || 'MEDIUM').toUpperCase(),
          category: data.category || '',
          status: (data.status || 'OPEN').toUpperCase(),
          dueDate: data.dueDate || '',
          notes: data.notes || '',
          assignedTo: data.assignedTo || '',
          createdAt: Number(data.createdAt || 0),
          completedAt: Number(data.completedAt || 0),
          deletedAt: Number(data.deletedAt || 0),
          repeatType: data.repeatType || 'Never',
          scheduleType: data.scheduleType || 'Onetime',
          recurringType: data.recurringType || '',
          interval: Number(data.interval || 1),
          alternate: Number(data.alternate || 0),
          dueHours: Number(data.dueHours || 0),
          lastModified: Number(data.lastModified || 0)
        };
      })
      .filter(item => Number(item.boatId) === Number(currentBoatId))
      .filter(item => item.status !== 'DELETED');

    paintCounts();
    renderList();
  }, (err) => {
    console.error('[tasks] listen failed', err);
    document.getElementById('tkList').innerHTML =
      `<div class="boats-empty">
         <h2>${tr("Couldn't load tasks")}</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

function paintCounts() {
  const counts = {
    ALL:       currentItems.length,
    OPEN:      currentItems.filter(t => t.status === 'OPEN').length,
    OVERDUE:   currentItems.filter(t => t.status === 'OPEN' && isOverdue(t)).length,
    COMPLETED: currentItems.filter(t => t.status === 'COMPLETED').length
  };
  document.querySelectorAll('[data-tk-count]').forEach(el => {
    const n = counts[el.dataset.tkCount] || 0;
    el.textContent = n > 0 ? String(n) : '';
  });
}

function isOverdue(task) {
  if (task.priority === 'OVERDUE') return true;
  if (task.status !== 'OPEN') return false;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate + 'T00:00:00').getTime();
  if (isNaN(due)) return false;
  return due < Date.now();
}

function getVisibleItems() {
  const q = (document.getElementById('tkSearchInput')?.value || '').trim().toLowerCase();

  let list = currentItems;

  if (filterMode === 'OPEN')      list = list.filter(t => t.status === 'OPEN');
  if (filterMode === 'COMPLETED') list = list.filter(t => t.status === 'COMPLETED');
  if (filterMode === 'OVERDUE')   list = list.filter(t => t.status === 'OPEN' && isOverdue(t));

  if (q) {
    list = list.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.assignedTo || '').toLowerCase().includes(q) ||
      (t.priority || '').toLowerCase().includes(q)
    );
  }

  return list;
}

function getPriorityColor(priority) {
  return PRIORITY_COLORS[String(priority || '').toUpperCase()] || PRIORITY_COLORS.MEDIUM;
}

function formatDue(dueDate) {
  if (!dueDate) return '';
  try {
    const d = new Date(dueDate + 'T00:00:00');
    if (isNaN(d.getTime())) return dueDate;
    return d.toLocaleDateString(uiLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return dueDate; }
}

function renderList() {
  const listEl = document.getElementById('tkList');
  if (!listEl) return;

  const items = getVisibleItems();

  if (!items.length) {
    const q = (document.getElementById('tkSearchInput')?.value || '').trim();
    let msg = 'No tasks';
    if (q) msg = `${escapeHtml(tr("ui.noMatches", {query:q}))}`;
    else if (filterMode === 'OPEN') msg = 'No open tasks';
    else if (filterMode === 'OVERDUE') msg = 'No overdue tasks';
    else if (filterMode === 'COMPLETED') msg = 'No completed tasks';

    listEl.innerHTML = `<div class="boats-empty"><h2>${msg}</h2><p>${tr("Tap + to add the first task.")}</p></div>`;
    return;
  }

  const sorted = [...items].sort((a, b) => {
    // Open first, then by due date ascending, then priority
    if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1;
    const ad = a.dueDate || '9999-12-31';
    const bd = b.dueDate || '9999-12-31';
    if (ad !== bd) return ad.localeCompare(bd);
    return (a.priority || '').localeCompare(b.priority || '');
  });

  listEl.innerHTML = sorted.map(e => {
    const color = getPriorityColor(e.priority);
    const isDone = e.status === 'COMPLETED';
    return `
      <div class="tk-row${isDone ? ' is-complete' : ''}" data-task-id="${e.id}">
        <div class="tk-priority-strip" style="background:${color};"></div>

        <div class="tk-info">
          <div class="tk-badge" style="background:${color};">${escapeHtml(tr(e.priority))}</div>
          <div class="tk-title">${escapeHtml(e.title || tr('Untitled'))}</div>
          ${e.boatName ? `<div class="tk-boat">${escapeHtml(e.boatName)}</div>` : ''}
          ${e.dueDate ? `<div class="tk-due">${tr("Due:" )} ${escapeHtml(formatDue(e.dueDate))}${isOverdue(e) ? ` · <span style="color:#EF4444;">${tr("OVERDUE")}</span>` : ''}</div>` : ''}
        </div>

        <button class="eq-kebab" data-task-menu="${e.id}" aria-label="${tr("Menu")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="12" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
          </svg>
        </button>
        <div class="eq-row-divider"></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.tk-row').forEach(row => {
    const id = Number(row.dataset.taskId);
    const item = sorted.find(i => i.id === id);
    if (!item) return;
    row.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-task-menu]')) return;
      showTaskDetail(item);
    });
  });

  listEl.querySelectorAll('[data-task-menu]').forEach(btn => {
    const id = Number(btn.dataset.taskMenu);
    const item = sorted.find(i => i.id === id);
    if (!item) return;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      showTaskMenu(item);
    });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}