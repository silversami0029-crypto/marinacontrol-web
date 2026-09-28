// js/screens/InventoryScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showInventoryMenu } from './InventoryMenuSheet.js';
import { showInventoryDetail } from './InventoryDetailSheet.js';
import { showInventoryHelp } from './InventoryHelp.js';
import {
  collection, query, where, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentBoatId = 0;
let currentBoatName = '';
let currentItems = [];
let isSearchOpen = false;

export function mountInventoryScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlBoatId = Number(params.get('boatId') || 0);

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="eq-header" id="invHeader">
      <div class="eq-header-row">
        <button class="eq-icon-btn" id="invBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="eq-pill" id="invPill">Inventory</div>
        <button class="eq-icon-btn" id="invHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="eq-header-spacer"></div>
        <button class="eq-icon-btn" id="invSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="invSearchBar" hidden>
      <input id="invSearchInput" type="text" placeholder="Search inventory..." autocomplete="off">
      <button type="button" class="search-cancel" id="invSearchCancel">Cancel</button>
    </div>

    <div class="eq-list" id="invList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="invFabAdd" aria-label="Add inventory item">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('invBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  const invHelpBtn = document.getElementById('invHelp');
  if (invHelpBtn) invHelpBtn.addEventListener('click', showInventoryHelp);

  document.getElementById('invSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('invHeader').hidden = true;
    document.getElementById('invSearchBar').hidden = false;
    document.getElementById('invSearchInput').focus();
  });

  document.getElementById('invSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('invSearchBar').hidden = true;
    document.getElementById('invHeader').hidden = false;
    document.getElementById('invSearchInput').value = '';
    renderList();
  });

  document.getElementById('invSearchInput').addEventListener('input', renderList);

  document.getElementById('invFabAdd').addEventListener('click', async () => {
    const m = await import('./AddInventorySheet.js');
    m.showAddInventorySheet({ boatId: currentBoatId, boatName: currentBoatName });
  });

  resolveBoatAndSubscribe(urlBoatId);
}

async function resolveBoatAndSubscribe(urlBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('invList').innerHTML =
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
    console.error('[inventory] boat lookup failed', err);
  }

  if (!boatId) {
    document.getElementById('invList').innerHTML =
      `<div class="boats-empty">
         <h2>No active boat</h2>
         <p>Set a boat as active to see its inventory.</p>
       </div>`;
    return;
  }

  currentBoatId = boatId;
  document.getElementById('invPill').textContent = currentBoatName
    ? `Inventory · ${currentBoatName}`
    : 'Inventory';

  subscribeToInventory(clientId);
}

function subscribeToInventory(clientId) {
  const q = query(
    collection(db, 'inventory'),
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
          name: data.name || '',
          category: data.category || '',
          location: data.location || '',
          quantity: Number(data.quantity || 0),
          reorderLevel: Number(data.reorderLevel || 0),
          unit: data.unit || '',
          supplier: data.supplier || '',
          notes: data.notes || '',
          status: data.status || '',
          assignedTo: data.assignedTo || '',
          assignedBy: data.assignedBy || '',
          assignedAt: Number(data.assignedAt || 0),
          lastUpdated: data.lastUpdated || '',
          lastModified: Number(data.lastModified || 0)
        };
      })
      .filter(item => Number(item.boatId) === Number(currentBoatId));

    renderList();
  }, (err) => {
    console.error('[inventory] listen failed', err);
    document.getElementById('invList').innerHTML =
      `<div class="boats-empty">
         <h2>Couldn't load inventory</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

function getVisibleItems() {
  const q = (document.getElementById('invSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentItems;
  return currentItems.filter(i =>
    (i.name || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q) ||
    (i.location || '').toLowerCase().includes(q) ||
    (i.notes || '').toLowerCase().includes(q) ||
    (i.supplier || '').toLowerCase().includes(q) ||
    (i.assignedTo || '').toLowerCase().includes(q)
  );
}

// Android InventoryAdapter: qty<=0 OUT_OF_STOCK, qty<=1 CRITICAL, qty<=3 LOW_STOCK, else IN_STOCK
function computeStatus(quantity) {
  const q = Number(quantity || 0);
  if (q <= 0) return 'OUT_OF_STOCK';
  if (q <= 1) return 'CRITICAL';
  if (q <= 3) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function getStatusState(item) {
  const s = computeStatus(item.quantity);
  switch (s) {
    case 'OUT_OF_STOCK': return { key: s, color: '#F44336', icon: '!', label: 'Out of Stock' };
    case 'CRITICAL':     return { key: s, color: '#F44336', icon: '!', label: 'Critical Stock' };
    case 'LOW_STOCK':    return { key: s, color: '#FF9800', icon: '!', label: 'Low Stock' };
    case 'REORDER':      return { key: s, color: '#2196F3', icon: '↑', label: 'Reorder Required' };
    case 'IN_STOCK':
    default:             return { key: 'IN_STOCK', color: '#4CAF50', icon: '✓', label: 'In Stock' };
  }
}

function renderList() {
  const listEl = document.getElementById('invList');
  if (!listEl) return;

  const items = getVisibleItems();

  if (!items.length) {
    const q = (document.getElementById('invSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>No matches</h2><p>No items match "${escapeHtml(q)}"</p></div>`
      : `<div class="boats-empty"><h2>No inventory items</h2><p>Tap + to add the first item.</p></div>`;
    return;
  }

  const sorted = [...items].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  listEl.innerHTML = sorted.map(e => {
    const state = getStatusState(e);
    return `
      <div class="eq-row" data-inv-id="${e.id}">
        <div class="eq-indicator" style="background:${state.color};">
          <span class="eq-indicator-icon">${state.icon}</span>
        </div>

        <div class="eq-info">
          <div class="eq-boat">Boat: ${escapeHtml(e.boatName || '—')}</div>
          <div class="eq-manufacturer">${escapeHtml(e.name || 'Unnamed')}</div>
          ${e.category ? `<div class="eq-type">${escapeHtml(e.category)}</div>` : ''}
          ${e.location ? `<div class="eq-location"><span class="eq-loc-pin">📍</span>${escapeHtml(e.location)}</div>` : ''}
          ${e.assignedTo ? `<div class="eq-assigned">👤 Assigned: ${escapeHtml(e.assignedTo)}</div>` : ''}
          <div class="eq-model-line">Qty: ${e.quantity}${e.unit ? ' ' + escapeHtml(e.unit) : ''} · <span style="color:${state.color};font-weight:600;">${state.label}</span></div>
          ${e.supplier ? `<div class="eq-serial">Supplier: ${escapeHtml(e.supplier)}</div>` : ''}
          ${e.lastUpdated ? `<div class="eq-notes">Updated: ${escapeHtml(e.lastUpdated)}</div>` : ''}
        </div>

        <button class="eq-kebab" data-inv-menu="${e.id}" aria-label="Menu">
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
    const id = Number(row.dataset.invId);
    const item = sorted.find(i => i.id === id);
    if (!item) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-inv-menu]')) return;
      showInventoryDetail(item);
    });
  });

  listEl.querySelectorAll('[data-inv-menu]').forEach(btn => {
    const id = Number(btn.dataset.invMenu);
    const item = sorted.find(i => i.id === id);
    if (!item) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showInventoryMenu(item);
    });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}