// js/screens/BerthsScreen.js
// Berths grid — mirrors fragment_berths.xml

import { renderBerthCard } from '../components/BerthCard.js';
import { listenForBerths } from '../db.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';

let unsubscribe = null;
let searchQuery = '';

export function mountBerthsScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty">
         <h2>No client assigned</h2>
         <p>Your user profile doesn't include a clientId.</p>
       </div>`;
    return;
  }

  searchQuery = '';

  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="berth-header">
      <div class="berth-header-row">
        <div class="berth-pill">Marina Berths</div>
        <button class="berth-info" id="berthHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="berth-header-spacer"></div>
        <button class="berth-icon-btn" id="berthSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
        <button class="berth-icon-btn" id="berthMenuBtn" aria-label="Berth menu">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <circle cx="12" cy="5"  r="1.6"/>
            <circle cx="12" cy="12" r="1.6"/>
            <circle cx="12" cy="19" r="1.6"/>
          </svg>
        </button>
      </div>

      <div class="berth-summary" id="berthSummary">Loading…</div>
    </div>

    <div class="berth-search" id="berthSearch" hidden>
      <input id="berthSearchInput" type="text" placeholder="Search berth or boat..."
             autocomplete="off">
      <button type="button" class="search-cancel" id="berthSearchCancel">Cancel</button>
    </div>

    <div class="berth-grid" id="berthGrid">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  // Wire header buttons
  document.getElementById('berthHelp').addEventListener('click', () => {
    toast('Berth help coming soon');
  });

  document.getElementById('berthMenuBtn').addEventListener('click', () => {
    toast('Berth menu coming soon');
  });

  setupSearch();

  if (unsubscribe) unsubscribe();
  unsubscribe = listenForBerths(store.activeClientId, (berths, err) => {
    if (err) {
      document.getElementById('berthGrid').innerHTML =
        `<div class="boats-empty">
           <h2>Couldn't load berths</h2>
           <p>${err.message || 'Permission denied.'}</p>
         </div>`;
      return;
    }

    store.berths = berths;
    store.berthsFull = berths;

    renderBerthGrid();
    updateSummary();
  });
}

/* ============================================================
   SEARCH
   ============================================================ */
function setupSearch() {
  const toggle = document.getElementById('berthSearchToggle');
  const bar    = document.getElementById('berthSearch');
  const input  = document.getElementById('berthSearchInput');
  const cancel = document.getElementById('berthSearchCancel');

  toggle.addEventListener('click', () => {
    bar.hidden = false;
    input.focus();
  });

  cancel.addEventListener('click', () => {
    bar.hidden = true;
    input.value = '';
    searchQuery = '';
    renderBerthGrid();
  });

  input.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderBerthGrid();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel.click();
  });
}

function applySearch(berths) {
  if (!searchQuery) return berths;
  const q = searchQuery.toLowerCase();
  return berths.filter(b =>
    (b.berthNumber || '').toLowerCase().includes(q) ||
    (b.assignedBoatName || '').toLowerCase().includes(q)
  );
}

/* ============================================================
   RENDER
   ============================================================ */
function renderBerthGrid() {
  const grid = document.getElementById('berthGrid');
  const berths = applySearch(store.berthsFull || []);

  if (!berths.length) {
    grid.innerHTML = `
      <div class="boats-empty" style="grid-column: 1 / -1;">
        <h2>${searchQuery ? 'No matches' : 'No berths yet'}</h2>
        <p>${searchQuery ? `No berths match "${escapeHtml(searchQuery)}"` : 'Add berths from your Android app or via CSV.'}</p>
      </div>`;
    return;
  }

  // Sort: by dock name, then berth number
  const sorted = [...berths].sort((a, b) => {
    const dc = (a.dockName || '').localeCompare(b.dockName || '');
    if (dc !== 0) return dc;
    return (a.berthNumber || '').localeCompare(b.berthNumber || '', undefined, { numeric: true });
  });

  grid.innerHTML = sorted.map(renderBerthCard).join('');

  grid.querySelectorAll('.berth-card').forEach(el => {
    const berthId = Number(el.dataset.berthId);
    const berth = store.berthsFull.find(b => b.id === berthId);

    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      toast(`Berth ${berth.berthNumber} — menu coming soon`);
    });

    el.querySelector('.berth-card-kebab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toast(`Berth ${berth.berthNumber} — menu coming soon`);
    });
  });
}

function updateSummary() {
  const el = document.getElementById('berthSummary');
  if (!el) return;

  const berths = store.berthsFull || [];
  const total = berths.length;
  const occupied = berths.filter(b => b.status === 'OCCUPIED').length;
  const maintenance = berths.filter(b => b.status === 'MAINTENANCE').length;
  const available = berths.filter(b => b.status === 'AVAILABLE').length;
  const booked = 0;        // no booking system yet
  const alerts = 0;        // no asset faults yet

  const pct = total > 0 ? Math.round((occupied * 100) / total) : 0;

  el.innerHTML = `
    <div>Occupied: <b>${occupied}</b> (${pct}%)  •  Total: <b>${total}</b></div>
    <div>Booked: <b>${booked}</b>  •  Available: <b>${available}</b></div>
    <div>Maintenance: <b>${maintenance}</b>  •  Alerts: <b>${alerts}</b></div>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}