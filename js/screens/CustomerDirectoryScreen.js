// js/screens/CustomerDirectoryScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { showAddCustomerChooser } from './AddCustomerSheet.js';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let isBulkMode = false;
const selectedIds = new Set();
let currentCustomers = [];
let isSearchOpen = false;

export function mountCustomerDirectoryScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty"><h2>No client assigned</h2></div>`;
    return;
  }

  isBulkMode = false;
  selectedIds.clear();
  currentCustomers = [];
  isSearchOpen = false;

  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="cd-header" id="cdHeader">
      <div class="cd-header-row">
        <button class="cd-icon-btn" id="cdBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="cd-pill">Customers</div>
        <div class="cd-header-spacer"></div>
        <button class="cd-icon-btn" id="cdSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="cdSearchBar" hidden>
      <input id="cdSearchInput" type="text" placeholder="Search customers..." autocomplete="off">
      <button type="button" class="search-cancel" id="cdSearchCancel">Cancel</button>
    </div>

    <div class="cd-list" id="cdList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="bulk-btn" id="cdBulkBtn" aria-label="Bulk delete" hidden>
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

    <div class="bulk-bar" id="cdBulkBar" hidden>
      <label class="bulk-select-all">
        <input type="checkbox" id="cdBulkSelectAll">
        <span>Select all</span>
      </label>
      <span class="bulk-count" id="cdBulkCount">0 selected</span>
      <button type="button" class="bulk-cancel" id="cdBulkCancel">Cancel</button>
    </div>

    <button class="cd-fab" id="cdFabAdd" aria-label="Add customer">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('cdBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  document.getElementById('cdSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('cdHeader').hidden = true;
    document.getElementById('cdSearchBar').hidden = false;
    document.getElementById('cdSearchInput').focus();
  });

  document.getElementById('cdSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('cdSearchBar').hidden = true;
    document.getElementById('cdHeader').hidden = false;
    document.getElementById('cdSearchInput').value = '';
    renderList();
    updateBulkVisibility();
  });

  document.getElementById('cdSearchInput').addEventListener('input', () => {
    renderList();
    updateBulkVisibility();
  });

  document.getElementById('cdFabAdd').addEventListener('click', showAddCustomerChooser);

  document.getElementById('cdBulkBtn').addEventListener('click', onBulkButtonTap);
  document.getElementById('cdBulkCancel').addEventListener('click', exitBulkMode);
  document.getElementById('cdBulkSelectAll').addEventListener('change', (e) => {
    if (e.target.checked) selectAllVisible();
    else clearSelection();
  });

  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, 'customers'),
    where('clientId', '==', Number(store.activeClientId))
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentCustomers = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: data.id != null ? Number(data.id) : d.id,
          _docId: d.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          notes: data.notes || '',
          isPreferred: !!data.isPreferred,
          createdDate: Number(data.createdDate || 0),
          isActive: data.isActive,
          removedAt: data.removedAt
        };
      })
      .filter(c => {
        if (c.removedAt) return false;
        if (Number(c.isActive) === 0) return false;
        return true;
      });

    const liveIds = new Set(currentCustomers.map(c => c.id));
    for (const id of Array.from(selectedIds)) {
      if (!liveIds.has(id)) selectedIds.delete(id);
    }

    renderList();
    updateBulkVisibility();
  }, (err) => {
    console.error('[customers] listen failed', err);
    document.getElementById('cdList').innerHTML =
      `<div class="boats-empty">
         <h2>Couldn't load customers</h2>
         <p>${err.message || 'Permission denied.'}</p>
       </div>`;
  });
}

/* ============================================================
   LIST
   ============================================================ */
function getVisibleCustomers() {
  const q = (document.getElementById('cdSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentCustomers;
  return currentCustomers.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.phone || '').toLowerCase().includes(q)
  );
}

function renderList() {
  const listEl = document.getElementById('cdList');
  if (!listEl) return;

  const customers = getVisibleCustomers();

  if (!customers.length) {
    const q = (document.getElementById('cdSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>No matches</h2><p>No customers match "${escapeHtml(q)}"</p></div>`
      : `<div class="boats-empty"><h2>No customers yet</h2><p>Tap + to add your first customer.</p></div>`;
    return;
  }

  const sorted = [...customers].sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );

  listEl.innerHTML = sorted.map(c => {
    const selected = selectedIds.has(c.id);
    return `
      <div class="cd-row${selected ? ' is-selected' : ''}" data-customer-id="${c.id}">
        ${isBulkMode ? `<input type="checkbox" class="cd-check" ${selected ? 'checked' : ''}>` : ''}
        <div class="cd-avatar">${escapeHtml(computeInitials(c.name))}</div>
        <div class="cd-info">
          <div class="cd-name-line">
            <div class="cd-name">${escapeHtml(c.name || 'Unnamed')}</div>
            ${c.isPreferred ? '<span class="cd-star">★</span>' : ''}
          </div>
          ${c.email ? `<div class="cd-email">${escapeHtml(c.email)}</div>` : ''}
          ${c.phone ? `<div class="cd-phone">${escapeHtml(c.phone)}</div>` : ''}
        </div>
        ${isBulkMode ? '' : `
          <div class="cd-chevron">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </div>
        `}
        <div class="cd-row-divider"></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.cd-row').forEach(row => {
    const id = Number(row.dataset.customerId);
    const customer = customers.find(c => c.id === id);
    if (!customer) return;

    if (isBulkMode) {
      row.addEventListener('click', () => toggleSelection(id));
      row.querySelector('.cd-check')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelection(id);
      });
      return;
    }

    row.addEventListener('click', () => {
      location.hash = `#/client-360?customerId=${id}`;
    });
  });
}

/* ============================================================
   BULK MODE
   ============================================================ */
function updateBulkVisibility() {
  const btn = document.getElementById('cdBulkBtn');
  if (!btn) return;
  btn.hidden = currentCustomers.length <= 1 || isSearchOpen || isBulkMode;
}

function enterBulkMode() {
  isBulkMode = true;
  selectedIds.clear();
  document.getElementById('cdBulkBtn')?.classList.add('is-armed');
  document.getElementById('cdBulkBar').hidden = false;
  document.getElementById('cdFabAdd').hidden = true;
  document.getElementById('cdBulkSelectAll').checked = false;
  updateCount();
  renderList();
}

function exitBulkMode() {
  isBulkMode = false;
  selectedIds.clear();
  document.getElementById('cdBulkBtn')?.classList.remove('is-armed');
  document.getElementById('cdBulkBar').hidden = true;
  document.getElementById('cdFabAdd').hidden = false;
  document.getElementById('cdBulkSelectAll').checked = false;
  updateCount();
  renderList();
  updateBulkVisibility();
}

function toggleSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  const row = document.querySelector(`.cd-row[data-customer-id="${id}"]`);
  if (row) {
    row.classList.toggle('is-selected', selectedIds.has(id));
    const cb = row.querySelector('.cd-check');
    if (cb) cb.checked = selectedIds.has(id);
  }
  syncSelectAllCheckbox();
  updateCount();
}

function selectAllVisible() {
  getVisibleCustomers().forEach(c => selectedIds.add(c.id));
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
  const cb = document.getElementById('cdBulkSelectAll');
  if (!cb) return;
  const visible = getVisibleCustomers();
  cb.checked = visible.length > 0 && visible.every(c => selectedIds.has(c.id));
}

function updateCount() {
  const el = document.getElementById('cdBulkCount');
  if (!el) return;
  const n = selectedIds.size;
  el.textContent = n === 1 ? '1 selected' : `${n} selected`;
}

function onBulkButtonTap() {
  if (!isBulkMode) { enterBulkMode(); return; }
  if (selectedIds.size === 0) { toast('No customers selected'); return; }
  confirmBulkDelete();
}

async function confirmBulkDelete() {
  const count = selectedIds.size;
  const ok = await confirmSheet({
    title: `Delete ${count} customer${count === 1 ? '' : 's'}?`,
    message: `Boats linked to these customers will be unlinked.`,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  const ids = Array.from(selectedIds);
  const clientId = Number(store.activeClientId);
  let deleted = 0;
  let unlinked = 0;
  let failed = 0;

  for (const customerId of ids) {
    try {
      const docRef = doc(db, 'customers', String(customerId));
      await updateDoc(docRef, {
        isActive: 0,
        removedAt: serverTimestamp(),
        removedBy: String(store.userProfile?.userId || 0),
        lastModified: Date.now(),
        lastModifiedBy: String(store.userProfile?.userId || 0)
      });

      const boatsSnap = await getDocs(
        query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('customerId', '==', customerId)
        )
      );

      for (const boatDoc of boatsSnap.docs) {
        try {
          await updateDoc(boatDoc.ref, {
            customerId: 0,
            lastModified: Date.now(),
            lastModifiedBy: String(store.userProfile?.userId || 0)
          });
          unlinked++;
        } catch (err) {
          console.error('[bulk delete] boat unlink failed', boatDoc.id, err);
        }
      }

      deleted++;
    } catch (err) {
      console.error('[bulk delete] customer failed', customerId, err);
      failed++;
    }
  }

  const parts = [`Deleted ${deleted} customer${deleted === 1 ? '' : 's'}`];
  if (unlinked > 0) parts.push(`${unlinked} boat${unlinked === 1 ? '' : 's'} unlinked`);
  if (failed > 0)  parts.push(`${failed} failed`);

  toast(parts.join(' · '), { kind: failed > 0 ? 'error' : 'success' });

  exitBulkMode();
}

/* ============================================================
   HELPERS
   ============================================================ */
function computeInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}