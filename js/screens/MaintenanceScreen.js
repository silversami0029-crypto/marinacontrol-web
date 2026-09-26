// js/screens/MaintenanceScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showMaintenanceMenu } from './MaintenanceMenuSheet.js';
import { showMaintenanceDetail } from './MaintenanceDetailSheet.js';
import {
  collection, query, where, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentBoatId = 0;
let currentBoatName = '';
let currentItems = [];
let isSearchOpen = false;

export function mountMaintenanceScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(
    (location.hash.split('?')[1] || '')
  );
  const urlBoatId = Number(params.get('boatId') || 0);

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="mt-header" id="mtHeader">
      <div class="mt-header-row">
        <button class="mt-icon-btn" id="mtBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="mt-pill" id="mtPill">Maintenance</div>
        <button class="mt-icon-btn" id="mtHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="mt-header-spacer"></div>
        <button class="mt-icon-btn" id="mtSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="mtSearchBar" hidden>
      <input id="mtSearchInput" type="text" placeholder="Search maintenance..." autocomplete="off">
      <button type="button" class="search-cancel" id="mtSearchCancel">Cancel</button>
    </div>

      <div class="mt-list" id="mtList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="mtFabAdd" aria-label="Add maintenance">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('mtBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  document.getElementById('mtHelp').addEventListener('click', () => {
    toast('Maintenance help coming soon');
  });

  document.getElementById('mtSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('mtHeader').hidden = true;
    document.getElementById('mtSearchBar').hidden = false;
    document.getElementById('mtSearchInput').focus();
  });

  document.getElementById('mtSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('mtSearchBar').hidden = true;
    document.getElementById('mtHeader').hidden = false;
    document.getElementById('mtSearchInput').value = '';
    renderList();
  });

  document.getElementById('mtSearchInput').addEventListener('input', renderList);

  resolveBoatAndSubscribe(urlBoatId);
}

/* ============================================================
   RESOLVE BOAT → SUBSCRIBE
   ============================================================ */
async function resolveBoatAndSubscribe(urlBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('mtList').innerHTML =
      `<div class="boats-empty"><h2>No client assigned</h2></div>`;
    return;
  }

  let boatId = urlBoatId;

  try {
    if (!boatId) {
      const snap = await getDocs(
        query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('isActive', '==', true)
        )
      );
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        boatId = Number(data.id || docSnap.id);
        currentBoatName = data.name || '';
      }
    } else {
      const boatSnap = await getDocs(
        query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('id', '==', boatId)
        )
      );
      if (!boatSnap.empty) {
        currentBoatName = boatSnap.docs[0].data().name || '';
      }
    }
  } catch (err) {
    console.error('[maintenance] boat lookup failed', err);
  }

  if (!boatId) {
    document.getElementById('mtList').innerHTML =
      `<div class="boats-empty">
         <h2>No active boat</h2>
         <p>Set a boat as active to see its maintenance.</p>
       </div>`;
    return;
  }

  currentBoatId = boatId;
  document.getElementById('mtPill').textContent = currentBoatName
    ? `Maintenance · ${currentBoatName}`
    : 'Maintenance';

  subscribeToMaintenance(clientId, boatId);
}



function subscribeToMaintenance(clientId, boatId) {
  const q = query(
    collection(db, 'maintenance'),
    where('clientId', '==', Number(clientId)),
    where('boatId', '==', Number(boatId))
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentItems = snap.docs
      .map(d => {
        const data = d.data();

        return {
          id: data.id != null ? Number(data.id) : Number(d.id),
          _docId: d.id,
          clientId: Number(data.clientId || 0),
          boatId: data.boatId != null
            ? Number(data.boatId)
            : null,
          berthId: data.berthId != null
            ? Number(data.berthId)
            : null,
          type: data.type || '',
          date: data.date || '',
          status: data.status || 'ACTIVE',
          priority: data.priority || '',
          completed: !!data.completed,
          notes: data.notes || '',
          source: data.source || '',
          assignedTo: data.assignedTo || '',
          assignedBy: data.assignedBy || '',
          assignedAt: Number(data.assignedAt || 0),
          deferReason: data.deferReason || '',
          riskLevel: data.riskLevel || '',
          mitigation: data.mitigation || '',
          reviewDate: data.reviewDate || '',
          deferredBy: data.deferredBy || '',
          deferredAt: Number(data.deferredAt || 0),
          lastModified: Number(data.lastModified || 0)
        };
      })
      .filter(item =>
        Number(item.boatId) === Number(boatId) &&
        !(Number(item.berthId) > 0)
      );

    renderList();
  }, (err) => {
    console.error('[maintenance] listen failed', err);

    const listEl = document.getElementById('mtList');
    if (!listEl) return;

    listEl.innerHTML = `
      <div class="boats-empty">
        <h2>Couldn't load maintenance</h2>
        <p>${escapeHtml(err.message || 'Permission denied.')}</p>
      </div>
    `;
  });
}

/* ============================================================
   LIST
   ============================================================ */
function getVisibleItems() {
  const q = (document.getElementById('mtSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentItems;
  return currentItems.filter(m =>
    (m.type || '').toLowerCase().includes(q) ||
    (m.notes || '').toLowerCase().includes(q) ||
    (m.status || '').toLowerCase().includes(q) ||
    (m.priority || '').toLowerCase().includes(q) ||
    (m.assignedTo || '').toLowerCase().includes(q) ||
    (m.source || '').toLowerCase().includes(q)
  );
}

function renderList() {
  const listEl = document.getElementById('mtList');
  if (!listEl) return;

  const items = getVisibleItems();

  if (!items.length) {
    const q = (document.getElementById('mtSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>No matches</h2><p>No maintenance matches "${escapeHtml(q)}"</p></div>`
      : `<div class="boats-empty"><h2>No maintenance</h2><p>Tap + to add a task.</p></div>`;
    return;
  }

  const sorted = [...items].sort((a, b) => {
    const order = { ACTIVE: 0, ESCALATED: 1, DEFERRED: 2, COMPLETED: 3 };
    const ao = order[a.status] ?? 4;
    const bo = order[b.status] ?? 4;
    if (ao !== bo) return ao - bo;
    return (b.date || '').localeCompare(a.date || '');
  });

  listEl.innerHTML = sorted.map(m => {
    const state = getRowState(m);
    const isChecklist = (m.source || '').startsWith('CHECKLIST:');

    return `
      <div class="mt-row" data-maint-id="${m.id}">
        <div class="mt-indicator" style="background:${state.color};">
          <span class="mt-indicator-icon">${state.icon}</span>
        </div>

        <div class="mt-info">
          <div class="mt-title">${escapeHtml(m.type || 'Maintenance')}</div>
          ${m.notes ? `<div class="mt-notes">${escapeHtml(m.notes)}</div>` : ''}
          ${m.assignedTo ? `<div class="mt-assigned">Assigned: ${escapeHtml(m.assignedTo)}</div>` : ''}
          ${m.source ? `
            <span class="mt-source-badge ${isChecklist ? 'mt-source-checklist' : 'mt-source-manual'}">
              ${isChecklist ? '📝 Checklist' : '🔧 Manual'}
            </span>
          ` : ''}
          <div class="mt-date" style="color:${state.dateColor};">
            ${escapeHtml(state.dateLabel)}
          </div>
        </div>

        <button class="mt-kebab" data-maint-menu="${m.id}" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="12" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
          </svg>
        </button>
        <div class="mt-row-divider"></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.mt-row').forEach(row => {
    const id = Number(row.dataset.maintId);
    const item = sorted.find(m => m.id === id);
    if (!item) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-maint-menu]')) return;
      showMaintenanceDetail(item);
    });
  });

   listEl.querySelectorAll('[data-maint-menu]').forEach(btn => {
    const id = Number(btn.dataset.maintMenu);
    const item = sorted.find(m => m.id === id);
    if (!item) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showMaintenanceMenu(item);
    });
  });
}

/* ============================================================
   ROW STATE (color, icon, date label)
   ============================================================ */
function getRowState(m) {
  const now = Date.now();

  if (m.status === 'ESCALATED') {
    return { color: '#9C27B0', icon: '↑', dateLabel: 'Escalated', dateColor: '#9C27B0' };
  }
  if (m.status === 'DEFERRED') {
    return { color: '#2196F3', icon: '⏳', dateLabel: 'Deferred', dateColor: '#2196F3' };
  }
  if (m.completed || m.status === 'COMPLETED') {
    return { color: '#4CAF50', icon: '✓', dateLabel: 'Completed', dateColor: '#4CAF50' };
  }

  if (!m.date) {
    return { color: '#737D89', icon: '•', dateLabel: 'No date', dateColor: '#737D89' };
  }

  const due = new Date(m.date + 'T00:00:00').getTime();
  if (isNaN(due)) {
    return { color: '#737D89', icon: '•', dateLabel: m.date, dateColor: '#737D89' };
  }

  const diffDays = Math.floor((due - now) / (24 * 60 * 60 * 1000));

  if (due < now) {
    const abs = Math.abs(diffDays);
    return {
      color: '#F44336',
      icon: '!',
      dateLabel: `Overdue by ${abs} ${abs === 1 ? 'day' : 'days'}`,
      dateColor: '#F44336'
    };
  }
  if (diffDays === 0) {
    return { color: '#FF9800', icon: '⏰', dateLabel: 'Due Today', dateColor: '#FF9800' };
  }
  if (diffDays === 1) {
    return { color: '#FF9800', icon: '⏰', dateLabel: 'Due Tomorrow', dateColor: '#FF9800' };
  }
  if (diffDays <= 7) {
    return { color: '#FF9800', icon: '⏰', dateLabel: `Due in ${diffDays} days`, dateColor: '#FF9800' };
  }

  const d = new Date(m.date + 'T00:00:00');
  const label = d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
  return { color: '#3DD68C', icon: '', dateLabel: label, dateColor: '#AEB6C1' };
}

/* ============================================================
   HELPERS
   ============================================================ */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}