// js/screens/SafetyScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showSafetyMenu } from './SafetyMenuSheet.js';
import { showSafetyDetail } from './SafetyDetailSheet.js';
import { showSafetyHelp } from './SafetyHelp.js';
import {
  collection, query, where, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentBoatId = 0;
let currentBoatName = '';
let currentItems = [];
let isSearchOpen = false;
let filter = 'ALL';   // ALL | EXPIRED | EXPIRING_SOON | NEEDS_DATES

export function mountSafetyScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlBoatId = Number(params.get('boatId') || 0);
  const initialFilter = (params.get('filter') || '').toUpperCase();
  filter = ['ALL', 'EXPIRED', 'EXPIRING_SOON', 'NEEDS_DATES'].includes(initialFilter) ? initialFilter : 'ALL';

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="sf-header" id="sfHeader">
      <div class="sf-header-row">
        <button class="sf-icon-btn" id="sfBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="sf-pill" id="sfPill">Safety</div>
        <button class="sf-icon-btn" id="sfHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="sf-header-spacer"></div>
        <button class="sf-icon-btn" id="sfSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="sfSearchBar" hidden>
      <input id="sfSearchInput" type="text" placeholder="Search safety items..." autocomplete="off">
      <button type="button" class="search-cancel" id="sfSearchCancel">Cancel</button>
    </div>

    <div class="sf-cards" id="sfCards">
      <button class="sf-card" data-filter="ALL">
        <div class="sf-card-label">All</div>
        <div class="sf-card-count" id="sfCountAll">—</div>
      </button>
      <button class="sf-card sf-card-expired" data-filter="EXPIRED">
        <div class="sf-card-label">Expired</div>
        <div class="sf-card-count" id="sfCountExpired">—</div>
      </button>
      <button class="sf-card sf-card-soon" data-filter="EXPIRING_SOON">
        <div class="sf-card-label">Expiring</div>
        <div class="sf-card-count" id="sfCountSoon">—</div>
      </button>
      <button class="sf-card sf-card-dates" data-filter="NEEDS_DATES">
        <div class="sf-card-label">Needs Dates</div>
        <div class="sf-card-count" id="sfCountDates">—</div>
      </button>
    </div>

    <div class="sf-list" id="sfList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="sfFabAdd" aria-label="Add safety item">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  /* back arrow*/

 document.getElementById('sfBack')?.addEventListener('click', () => history.back());

  document.getElementById('sfHelp').addEventListener('click', showSafetyHelp);
  

  document.getElementById('sfSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('sfHeader').hidden = true;
    document.getElementById('sfSearchBar').hidden = false;
    document.getElementById('sfSearchInput').focus();
  });

  document.getElementById('sfSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('sfSearchBar').hidden = true;
    document.getElementById('sfHeader').hidden = false;
    document.getElementById('sfSearchInput').value = '';
    renderList();
  });

  document.getElementById('sfSearchInput').addEventListener('input', renderList);

  document.getElementById('sfFabAdd').addEventListener('click', () => {
    showAddSafetyChooser({ boatId: currentBoatId, boatName: currentBoatName });
  });

  // Filter card taps
  document.querySelectorAll('.sf-card').forEach(card => {
    card.addEventListener('click', () => {
      filter = card.dataset.filter;
      updateCardState();
      renderList();
    });
  });

  resolveBoatAndSubscribe(urlBoatId);
}

/* ============================================================
   RESOLVE BOAT → SUBSCRIBE
   ============================================================ */
async function resolveBoatAndSubscribe(urlBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('sfList').innerHTML =
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
    console.error('[safety] boat lookup failed', err);
  }

  if (!boatId) {
    document.getElementById('sfList').innerHTML =
      `<div class="boats-empty">
         <h2>No active boat</h2>
         <p>Set a boat as active to see its safety items.</p>
       </div>`;
    return;
  }

  currentBoatId = boatId;
  document.getElementById('sfPill').textContent = currentBoatName
    ? `Safety · ${currentBoatName}`
    : 'Safety';

  updateCardState();
  subscribeToSafety(clientId);
}

/* ============================================================
   SUBSCRIBE
   ============================================================ */
function subscribeToSafety(clientId) {
  const q = query(
    collection(db, 'safety_items'),
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
          boatName: data.boatName || '',
          title: data.title || '',
          category: data.category || '',
          location: data.location || '',
          importance: data.importance || 'MEDIUM',
          status: data.status || 'ACTIVE',
          expiryDate: Number(data.expiryDate || 0),
          nextInspectionDate: Number(data.nextInspectionDate || 0),
          lastInspectedDate: Number(data.lastInspectedDate || 0),
          purchaseDate: Number(data.purchaseDate || 0),
          alertDaysBefore: Number(data.alertDaysBefore || 30),
          validityYears: Number(data.validityYears || 0),
          validityMonths: Number(data.validityMonths || 0),
          notes: data.notes || '',
          lastModified: Number(data.lastModified || 0)
        };
      })
      .filter(item =>
        Number(item.boatId) === Number(currentBoatId) &&
        item.status !== 'DELETED'
      );

    renderList();
  }, (err) => {
    console.error('[safety] listen failed', err);
    document.getElementById('sfList').innerHTML =
      `<div class="boats-empty">
         <h2>Couldn't load safety items</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

/* ============================================================
   FILTER + RENDER
   ============================================================ */
function getVisibleItems() {
  const q = (document.getElementById('sfSearchInput')?.value || '').trim().toLowerCase();
  let items = currentItems;

  if (filter === 'EXPIRED') {
    items = items.filter(i => i.expiryDate > 0 && i.expiryDate < Date.now());
  } else if (filter === 'EXPIRING_SOON') {
    const cutoff = Date.now() + 30 * 24 * 60 * 60 * 1000;
    items = items.filter(i => i.expiryDate > Date.now() && i.expiryDate <= cutoff);
  } else if (filter === 'NEEDS_DATES') {
    items = items.filter(i => !i.expiryDate || i.expiryDate <= 0);
  }

  if (!q) return items;
  return items.filter(i =>
    (i.title || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q) ||
    (i.location || '').toLowerCase().includes(q) ||
    (i.importance || '').toLowerCase().includes(q)
  );
}

function computeCounts() {
  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000;
  let all = 0, expired = 0, soon = 0, dates = 0;
  for (const i of currentItems) {
    all++;
    if (!i.expiryDate || i.expiryDate <= 0) dates++;
    else if (i.expiryDate < now) expired++;
    else if (i.expiryDate <= cutoff) soon++;
  }
  return { all, expired, soon, dates };
}

function renderList() {
  const listEl = document.getElementById('sfList');
  if (!listEl) return;

  // update counts (based on full dataset, not the filtered view)
  const counts = computeCounts();
  document.getElementById('sfCountAll').textContent = counts.all;
  document.getElementById('sfCountExpired').textContent = counts.expired;
  document.getElementById('sfCountSoon').textContent = counts.soon;
  document.getElementById('sfCountDates').textContent = counts.dates;

  const items = getVisibleItems();

  if (!items.length) {
    const q = (document.getElementById('sfSearchInput')?.value || '').trim();
    let msg;
    if (q) msg = `<h2>No matches</h2><p>No safety items match "${escapeHtml(q)}"</p>`;
    else if (filter === 'EXPIRED') msg = `<h2>Nothing expired</h2>`;
    else if (filter === 'EXPIRING_SOON') msg = `<h2>Nothing expiring soon</h2>`;
    else if (filter === 'NEEDS_DATES') msg = `<h2>All items have dates</h2>`;
    else msg = `<h2>No safety items</h2><p>Tap + to add the first one.</p>`;
    listEl.innerHTML = `<div class="boats-empty">${msg}</div>`;
    return;
  }

  const sorted = [...items].sort((a, b) => {
    // Expired first, then expiring soon, then needs dates, then normal
    const rank = i => {
      const now = Date.now();
      if (!i.expiryDate || i.expiryDate <= 0) return 3;
      if (i.expiryDate < now) return 0;
      if (i.expiryDate <= now + 30 * 24 * 60 * 60 * 1000) return 1;
      return 2;
    };
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.expiryDate || Infinity) - (b.expiryDate || Infinity);
  });

  listEl.innerHTML = sorted.map(item => {
    const state = getRowState(item);

    return `
      <div class="sf-row" data-safety-id="${item.id}">
        <div class="sf-indicator" style="background:${state.color};">
          <span class="sf-indicator-icon">${state.icon}</span>
        </div>

        <div class="sf-info">
          <div class="sf-title">${escapeHtml(item.title || 'Untitled')}</div>
          <div class="sf-category">${escapeHtml(item.category || '')}${item.location ? ' · ' + escapeHtml(item.location) : ''}</div>
          ${item.expiryDate > 0
            ? `<div class="sf-expiry" style="color:${state.dateColor};">Expires: ${escapeHtml(formatDate(item.expiryDate))}</div>`
            : `<div class="sf-expiry sf-expiry-dim">No expiry date set</div>`}
          <div class="sf-importance sf-imp-${String(item.importance || '').toLowerCase()}">${escapeHtml(item.importance || 'MEDIUM')}</div>
          ${item.notes ? `<div class="sf-notes">${escapeHtml(item.notes)}</div>` : ''}
        </div>

        <button class="sf-kebab" data-safety-menu="${item.id}" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="12" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
          </svg>
        </button>
        <div class="sf-row-divider"></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.sf-row').forEach(row => {
    const id = Number(row.dataset.safetyId);
    const item = sorted.find(i => i.id === id);
    if (!item) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-safety-menu]')) return;
      showSafetyDetail(item);
    });
  });

  listEl.querySelectorAll('[data-safety-menu]').forEach(btn => {
    const id = Number(btn.dataset.safetyMenu);
    const item = sorted.find(i => i.id === id);
    if (!item) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showSafetyMenu(item);
    });
  });
}

function getRowState(item) {
  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000;

  if (!item.expiryDate || item.expiryDate <= 0) {
    return { color: '#737D89', icon: '•', dateColor: '#737D89' };
  }
  if (item.expiryDate < now) {
    return { color: '#F44336', icon: '!', dateColor: '#F44336' };
  }
  if (item.expiryDate <= cutoff) {
    return { color: '#FF9800', icon: '⏰', dateColor: '#FF9800' };
  }
  return { color: '#4CAF50', icon: '✓', dateColor: '#4CAF50' };
}

function updateCardState() {
  document.querySelectorAll('.sf-card').forEach(c => {
    c.classList.toggle('is-active', c.dataset.filter === filter);
  });
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return '—'; }
}

/* ============================================================
   ADD CHOOSER
   ============================================================ */
function showAddSafetyChooser({ boatId, boatName }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
sheet.innerHTML = `
  <div style="position:relative;min-height:48px;">
    <div class="sheet-title" style="margin:0;padding:12px 48px;text-align:center;">
      Add Safety Item
    </div>
    <button type="button" id="safetySheetClose" aria-label="Close safety sheet"
      style="position:absolute;right:8px;top:2px;width:44px;height:44px;padding:0;border:0;background:transparent;color:#F5F7F9;font-size:28px;cursor:pointer;">
      &times;
    </button>
  </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="ascSingle">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Add Single Item</div>
        <div class="sheet-item-subtitle">Add one safety item manually</div>
      </div>
    </div>

    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="ascBulk">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Bulk Import</div>
        <div class="sheet-item-subtitle">Import safety items from CSV</div>
      </div>
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
sheet.querySelector('#safetySheetClose').addEventListener('click', close);

  sheet.querySelector('#ascSingle').addEventListener('click', async () => {
    close();
    const m = await import('./AddSafetySheet.js');
    m.showAddSafetySheet({ boatId, boatName });
  });

  sheet.querySelector('#ascBulk').addEventListener('click', async () => {
    close();
    const m = await import('./ImportSafetySheet.js');
    m.showImportSafetySheet({ boatId, boatName });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}