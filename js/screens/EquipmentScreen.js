// js/screens/EquipmentScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showEquipmentMenu } from './EquipmentMenuSheet.js';
import { showEquipmentDetail } from './EquipmentDetailSheet.js';
import { showEquipmentHelp } from './EquipmentHelp.js';
import {
  collection, query, where, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentBoatId = 0;
let currentBoatName = '';
let currentItems = [];
let isSearchOpen = false;

export function mountEquipmentScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlBoatId = Number(params.get('boatId') || 0);

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="eq-header" id="eqHeader">
      <div class="eq-header-row">
        <button class="eq-icon-btn" id="eqBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="eq-pill" id="eqPill">Equipment</div>
        <button class="eq-icon-btn" id="eqHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="eq-header-spacer"></div>
        <button class="eq-icon-btn" id="eqSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="eqSearchBar" hidden>
      <input id="eqSearchInput" type="text" placeholder="Search equipment..." autocomplete="off">
      <button type="button" class="search-cancel" id="eqSearchCancel">Cancel</button>
    </div>

    <div class="eq-list" id="eqList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="eqFabAdd" aria-label="Add equipment">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('eqBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  const eqHelpBtn = document.getElementById('eqHelp');
  if (eqHelpBtn) eqHelpBtn.addEventListener('click', showEquipmentHelp);

  document.getElementById('eqSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('eqHeader').hidden = true;
    document.getElementById('eqSearchBar').hidden = false;
    document.getElementById('eqSearchInput').focus();
  });

  document.getElementById('eqSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('eqSearchBar').hidden = true;
    document.getElementById('eqHeader').hidden = false;
    document.getElementById('eqSearchInput').value = '';
    renderList();
  });

  document.getElementById('eqSearchInput').addEventListener('input', renderList);

  document.getElementById('eqFabAdd').addEventListener('click', async () => {
    const m = await import('./AddEquipmentSheet.js');
    m.showAddEquipmentSheet({ boatId: currentBoatId, boatName: currentBoatName });
  });

  resolveBoatAndSubscribe(urlBoatId);
}

async function resolveBoatAndSubscribe(urlBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('eqList').innerHTML =
      `<div class="boats-empty"><h2>No client assigned</h2></div>`;
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
    console.error('[equipment] boat lookup failed', err);
  }

  if (!boatId) {
    document.getElementById('eqList').innerHTML =
      `<div class="boats-empty">
         <h2>No active boat</h2>
         <p>Set a boat as active to see its equipment.</p>
       </div>`;
    return;
  }

  currentBoatId = boatId;
  document.getElementById('eqPill').textContent = currentBoatName
    ? `Equipment · ${currentBoatName}`
    : 'Equipment';

  subscribeToEquipment(clientId);
}

function subscribeToEquipment(clientId) {
  const q = query(
    collection(db, 'equipment'),
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
          type: data.type || '',
          manufacturer: data.manufacturer || '',
          model: data.model || '',
          serialNumber: data.serialNumber || '',
          location: data.location || '',
          status: (data.status && String(data.status).trim()) || 'OPERATIONAL',
          assignedTo: data.assignedTo || '',
          assignedBy: data.assignedBy || '',
          assignedAt: Number(data.assignedAt || 0),
          notes: data.notes || '',
          lastModified: Number(data.lastModified || 0)
        };
      })
      .filter(item => Number(item.boatId) === Number(currentBoatId));

    renderList();
  }, (err) => {
    console.error('[equipment] listen failed', err);
    document.getElementById('eqList').innerHTML =
      `<div class="boats-empty">
         <h2>Couldn't load equipment</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

function getVisibleItems() {
  const q = (document.getElementById('eqSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentItems;
  return currentItems.filter(i =>
    (i.manufacturer || '').toLowerCase().includes(q) ||
    (i.type || '').toLowerCase().includes(q) ||
    (i.model || '').toLowerCase().includes(q) ||
    (i.location || '').toLowerCase().includes(q) ||
    (i.serialNumber || '').toLowerCase().includes(q) ||
    (i.notes || '').toLowerCase().includes(q) ||
    (i.status || '').toLowerCase().includes(q) ||
    (i.assignedTo || '').toLowerCase().includes(q)
  );
}

function renderList() {
  const listEl = document.getElementById('eqList');
  if (!listEl) return;

  const items = getVisibleItems();

  if (!items.length) {
    const q = (document.getElementById('eqSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>No matches</h2><p>No equipment matches "${escapeHtml(q)}"</p></div>`
      : `<div class="boats-empty"><h2>No equipment</h2><p>Tap + to add the first item.</p></div>`;
    return;
  }

  const sorted = [...items].sort((a, b) =>
    (a.manufacturer || '').localeCompare(b.manufacturer || '')
  );

  listEl.innerHTML = sorted.map(e => {
    const state = getStatusState(e.status);
    return `
      <div class="eq-row" data-equip-id="${e.id}">
        <div class="eq-indicator" style="background:${state.color};">
          <span class="eq-indicator-icon">${state.icon}</span>
        </div>

        <div class="eq-info">
          <div class="eq-boat">Boat: ${escapeHtml(e.boatName || '—')}</div>
          <div class="eq-manufacturer">${escapeHtml(e.manufacturer || 'Unnamed')}</div>
          ${e.type ? `<div class="eq-type">${escapeHtml(e.type)}</div>` : ''}
          ${e.model ? `<div class="eq-model-line">${escapeHtml(e.model)}</div>` : ''}
          ${e.serialNumber ? `<div class="eq-serial">Serial: ${escapeHtml(midEllipsize(e.serialNumber, 20))}</div>` : ''}
          ${e.location ? `<div class="eq-location"><span class="eq-loc-pin">📍</span>${escapeHtml(e.location)}</div>` : ''}
          ${e.notes ? `<div class="eq-notes">${escapeHtml(e.notes)}</div>` : ''}
          ${e.assignedTo ? `<div class="eq-assigned">👤 Assigned: ${escapeHtml(e.assignedTo)}</div>` : ''}
        </div>

        <button class="eq-kebab" data-equip-menu="${e.id}" aria-label="Menu">
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

  listEl.querySelectorAll('.eq-row').forEach(row => {
    const id = Number(row.dataset.equipId);
    const item = sorted.find(i => i.id === id);
    if (!item) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-equip-menu]')) return;
      showEquipmentDetail(item);
    });
  });

  listEl.querySelectorAll('[data-equip-menu]').forEach(btn => {
    const id = Number(btn.dataset.equipMenu);
    const item = sorted.find(i => i.id === id);
    if (!item) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEquipmentMenu(item);
    });
  });
}

function getStatusState(status) {
  // Exact match — mirrors Android's onBindViewHolder switch.
  // Android's default bucket is GREEN, so unknown values (incl. "FAULT") also
  // render green there. We match that so the two apps agree.
  const s = String(status || '').trim().toUpperCase();

  switch (s) {
    case 'OPERATIONAL':    return { color: '#4CAF50', icon: '✓' };  // green
    case 'SERVICE_DUE':    return { color: '#FF9800', icon: '!' };  // orange
    case 'UNDER_REPAIR':   return { color: '#2196F3', icon: '…' };  // blue
    case 'OUT_OF_SERVICE': return { color: '#F44336', icon: '!' };  // red
    case 'RETIRED':        return { color: '#757575', icon: '✓' };  // grey
    default:               return { color: '#4CAF50', icon: '✓' };  // green (Android default)
  }
}

function midEllipsize(s, max) {
  const str = String(s || '');
  if (str.length <= max) return str;
  const half = Math.floor((max - 1) / 2);
  return str.slice(0, half) + '…' + str.slice(-half);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}