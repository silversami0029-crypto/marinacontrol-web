// js/screens/BoatsScreen.js
import { renderBoatRow }    from '../components/BoatRow.js';
import { showBoatMenu }     from '../components/BoatMenuSheet.js';
import { showAddBoatSheet } from '../components/AddBoatSheet.js';
import { showAssignCustomerSheet } from '../components/AssignCustomerSheet.js';
import { showBoatHelp }     from '../components/HelpDialog.js';
import {
  listenForBoats, setActiveBoat, deleteBoatById, deleteBoatDocsByIds,
  createBoat, findBoatByMmsi, updateBoat, assignCustomerToBoat
} from '../db.js';
import { store }        from '../store.js';
import { toast }        from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';

let unsubscribe = null;
let isBulkMode = false;
const selectedIds = new Set();
let isSearchOpen = false;

export function mountBoatsScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty">
         <h2>No client assigned</h2>
         <p>Your user profile doesn't include a clientId.</p>
       </div>`;
    return;
  }

  isBulkMode = false;
  selectedIds.clear();
  isSearchOpen = false;
  store.searchQuery = '';

  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="boats-header" id="boatsHeader">
      <h1>Boats</h1>
      <button class="info-btn" id="helpBtn" aria-label="Help">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <line x1="12" y1="11" x2="12" y2="16"/>
          <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
        </svg>
      </button>
      <button class="search-btn" id="searchToggle" aria-label="Search">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
      </button>
    </div>

    <div class="boats-search-bar" id="searchBar" hidden>
      <input id="searchInput" type="text" placeholder="Search boats..." autocomplete="off">
      <button type="button" class="search-cancel" id="searchCancel">Cancel</button>
    </div>

    <div class="boats-list" id="boatsList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="bulk-btn" id="bulkBtn" aria-label="Bulk delete" hidden>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
           stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
    </button>

    <div class="bulk-bar" id="bulkBar" hidden>
      <label class="bulk-select-all">
        <input type="checkbox" id="bulkSelectAll">
        <span>Select all</span>
      </label>
      <span class="bulk-count" id="bulkCount">0 selected</span>
      <button type="button" class="bulk-cancel" id="bulkCancel">Cancel</button>
    </div>

    <button class="fab" id="fabAddBoat">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
           stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      <span>Boat</span>
    </button>
  `;

  document.getElementById('fabAddBoat').addEventListener('click', openAddBoatSheet);
  document.getElementById('helpBtn').addEventListener('click', showBoatHelp);
  document.getElementById('bulkBtn').addEventListener('click', onBulkButtonTap);
  document.getElementById('bulkCancel').addEventListener('click', exitBulkMode);
  document.getElementById('bulkSelectAll').addEventListener('change', (e) => {
    if (e.target.checked) selectAllVisible();
    else clearSelection();
  });

  setupSearch();

  if (unsubscribe) unsubscribe();
  unsubscribe = listenForBoats(store.activeClientId, (boats, err) => {
    if (err) {
      document.getElementById('boatsList').innerHTML =
        `<div class="boats-empty">
           <h2>Couldn't load boats</h2>
           <p>${err.message || 'Permission denied.'}</p>
         </div>`;
      return;
    }

    enrichCustomerNames(boats);

    store.boatsFull = boats;
    store.boats     = applySearch(boats, store.searchQuery);
    store.syncTime  = Date.now();

    const sub = document.getElementById('topbarSync');
    if (sub) sub.textContent = 'Online · Synced just now';

    const liveIds = new Set(boats.map(b => b.id));
    for (const id of Array.from(selectedIds)) {
      if (!liveIds.has(id)) selectedIds.delete(id);
    }

    renderList();
    updateBulkVisibility();
  });
}

function enrichCustomerNames(boats) {
  boats.forEach(b => {
    const cid = Number(b.customerId || 0);
    const cust = cid > 0 ? (store.customers || []).find(c => c.id === cid) : null;
    b.customerName = cust ? cust.name : null;
  });
}

function setupSearch() {
  const header = document.getElementById('boatsHeader');
  const toggle = document.getElementById('searchToggle');
  const bar    = document.getElementById('searchBar');
  const input  = document.getElementById('searchInput');
  const cancel = document.getElementById('searchCancel');

  toggle.addEventListener('click', () => {
    isSearchOpen = true;
    header.hidden = true;
    bar.hidden = false;
    input.focus();
  });

  cancel.addEventListener('click', () => {
    isSearchOpen = false;
    bar.hidden = true;
    header.hidden = false;
    input.value = '';
    store.searchQuery = '';
    store.boats = applySearch(store.boatsFull, '');
    renderList();
    updateBulkVisibility();
  });

  input.addEventListener('input', (e) => {
    store.searchQuery = e.target.value;
    store.boats = applySearch(store.boatsFull, store.searchQuery);
    renderList();
    updateBulkVisibility();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel.click();
  });
}

function applySearch(boats, q) {
  if (!q) return boats;
  const lower = q.toLowerCase();
  return boats.filter(b => b.name.toLowerCase().includes(lower));
}

function updateBulkVisibility() {
  const btn = document.getElementById('bulkBtn');
  if (!btn) return;
  btn.hidden = store.boatsFull.length <= 1;
}

function renderList() {
  const listEl = document.getElementById('boatsList');
  const boats  = store.boats;

  if (!boats.length) {
    const msg = store.searchQuery
      ? `<div class="boats-empty">
           <h2>No matches</h2>
           <p>No boats match "${escapeHtml(store.searchQuery)}"</p>
         </div>`
      : `<div class="boats-empty">
           <h2>No boats yet</h2>
           <p>Tap "+ Boat" to add your first vessel.</p>
         </div>`;
    listEl.innerHTML = msg;
    return;
  }

  listEl.innerHTML = boats
    .map(b => renderBoatRow(b, {
      bulkMode: isBulkMode,
      selected: selectedIds.has(b.id)
    }))
    .join('');

  listEl.querySelectorAll('.boat-row').forEach((rowEl) => {
    const boatId = Number(rowEl.dataset.boatId);
    const boat   = boats.find(b => b.id === boatId);
    if (!boat) return;

    if (isBulkMode) {
      rowEl.addEventListener('click', () => toggleSelection(boatId));
      rowEl.querySelector('.boat-check')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelection(boatId);
      });
      return;
    }

    rowEl.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      onOpenDashboard(boat);
    });

    rowEl.querySelector('.boat-kebab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openMenu(boat);
    });

    rowEl.querySelector('[data-action="voice"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toast('Voice playback coming soon');
    });

    rowEl.querySelector('[data-action="photo"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toast('Photo viewer coming soon');
    });
  });
}

function enterBulkMode() {
  isBulkMode = true;
  selectedIds.clear();
  document.getElementById('bulkBtn')?.classList.add('is-armed');
  document.getElementById('bulkBar').hidden = false;
  document.getElementById('fabAddBoat').hidden = true;
  document.getElementById('bulkSelectAll').checked = false;
  updateCount();
  renderList();
}

function exitBulkMode() {
  isBulkMode = false;
  selectedIds.clear();
  document.getElementById('bulkBtn')?.classList.remove('is-armed');
  document.getElementById('bulkBar').hidden = true;
  document.getElementById('fabAddBoat').hidden = false;
  document.getElementById('bulkSelectAll').checked = false;
  updateCount();
  renderList();
}

function toggleSelection(boatId) {
  if (selectedIds.has(boatId)) selectedIds.delete(boatId);
  else selectedIds.add(boatId);
  const rowEl = document.querySelector(`.boat-row[data-boat-id="${boatId}"]`);
  if (rowEl) {
    rowEl.classList.toggle('is-selected', selectedIds.has(boatId));
    const cb = rowEl.querySelector('.boat-check');
    if (cb) cb.checked = selectedIds.has(boatId);
  }
  syncSelectAllCheckbox();
  updateCount();
}

function selectAllVisible() {
  store.boats.forEach(b => selectedIds.add(b.id));
  syncSelectAllCheckbox();
  updateCount();
  renderList();
}

function clearSelection() {
  selectedIds.clear();
  syncSelectAllCheckbox();
  updateCount();
  renderList();
}

function syncSelectAllCheckbox() {
  const cb = document.getElementById('bulkSelectAll');
  if (!cb) return;
  cb.checked = store.boats.length > 0 && selectedIds.size === store.boats.length;
}

function updateCount() {
  const el = document.getElementById('bulkCount');
  if (!el) return;
  const n = selectedIds.size;
  el.textContent = n === 1 ? '1 selected' : `${n} selected`;
}

function onBulkButtonTap() {
  if (!isBulkMode) { enterBulkMode(); return; }
  if (selectedIds.size === 0) { toast('No boats selected'); return; }
  confirmBulkDelete();
}

async function confirmBulkDelete() {
  const count = selectedIds.size;
  const ok = await confirmSheet({
    title: `Delete ${count} boat${count === 1 ? '' : 's'}?`,
    message: `This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;
  try {
    const docIds = Array.from(selectedIds).map(String);
    await deleteBoatDocsByIds(docIds);
    toast(`Deleted ${count} boat${count === 1 ? '' : 's'}`, { kind: 'success' });
    exitBulkMode();
  } catch (err) {
    toast('Failed to delete boats', { kind: 'error' });
  }
}

function openMenu(boat) {
  showBoatMenu(boat, {
    onDashboard:      onOpenDashboard,
    onNotes:          () => toast('Boat notes coming soon'),
    onAssignCustomer: onAssignCustomer,
    onEdit:           onEditBoat,
    onPhoto:          () => toast(boat.hasPhoto() ? 'Photo options coming soon' : 'Add photo coming soon'),
    onVoice:          () => toast(boat.hasVoiceNote() ? 'Voice options coming soon' : 'Add voice note coming soon'),
    onSetActive:      onSetActive,
    onDelete:         onDelete
  });
}

function onOpenDashboard(boat) {
   location.hash = `#/boat-dashboard?boatId=${boat.id}`;
}

async function onSetActive(boat) {
  try {
    toast('Setting active…', { duration: 1200 });
    await setActiveBoat(store.activeClientId, boat.id);
    toast(`${boat.name} is now active`, { kind: 'success' });
  } catch (err) {
    toast('Failed to set active', { kind: 'error' });
  }
}

async function onDelete(boat) {
  const ok = await confirmSheet({
    title: 'Delete boat',
    message: `Are you sure you want to delete "${boat.name}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;
  try {
    await deleteBoatById(String(boat.id));
    toast(`${boat.name} deleted`, { kind: 'success' });
  } catch (err) {
    toast('Failed to delete boat', { kind: 'error' });
  }
}

function openAddBoatSheet() {
  showAddBoatSheet({
    onSaveSingle: async (fields) => {
      if (fields.mmsi && fields.mmsi !== 'TBC') {
        const existingId = await findBoatByMmsi(store.activeClientId, fields.mmsi);
        if (existingId) throw new Error(`A boat with MMSI '${fields.mmsi}' already exists.`);
      }
      const userId = store.userProfile?.userId || 0;
      const newId  = await createBoat(store.activeClientId, userId, fields);
      if (fields.isActive) await setActiveBoat(store.activeClientId, newId);
      toast(`${fields.name} added`, { kind: 'success' });
    }
  });
}

function onEditBoat(boat) {
  showAddBoatSheet({
    boat,
    onUpdateSingle: async (fields) => {
      if (fields.mmsi && fields.mmsi !== 'TBC') {
        const existingId = await findBoatByMmsi(store.activeClientId, fields.mmsi);
        if (existingId && existingId !== boat.id) {
          throw new Error(`Another boat with MMSI '${fields.mmsi}' already exists.`);
        }
      }
      const userId = store.userProfile?.userId || 0;
      await updateBoat(String(boat.id), userId, fields);
      if (fields.isActive && !boat.isActive) {
        await setActiveBoat(store.activeClientId, boat.id);
      }
      toast(`${fields.name} updated`, { kind: 'success' });
    }
  });
}

async function onAssignCustomer(boat) {
  const customers = store.customers || [];
  showAssignCustomerSheet({
    boat,
    customers,
    onAssign: async (customerId) => {
      const userId = store.userProfile?.userId || 0;
      await assignCustomerToBoat(String(boat.id), customerId, userId);
      const customer = customers.find(c => c.id === customerId);
      toast(customer ? `${customer.name} assigned to ${boat.name}` : 'Customer assigned', { kind: 'success' });
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}