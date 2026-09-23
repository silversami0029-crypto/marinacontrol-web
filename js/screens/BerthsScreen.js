// js/screens/BerthsScreen.js
// Berths grid — mirrors fragment_berths.xml

import { renderBerthCard } from '../components/BerthCard.js';
import { listenForBerths } from '../db.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showBerthToolbarMenu } from '../components/BerthToolbarMenu.js';
import { createBerth, deleteAllBerths, importBerthsFromRows } from '../db.js';
import { showBerthMenu } from '../components/BerthMenuSheet.js';
import { updateBerthStatus, updateBerth, deleteBerth } from '../db.js';
import { confirmSheet } from '../ui/confirm.js';

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

document.getElementById('berthMenuBtn').addEventListener('click', openToolbarMenu);

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
         openBerthMenu(berth);
    });

    el.querySelector('.berth-card-kebab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openBerthMenu(berth);
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

/* ============================================================
   TOOLBAR MENU
   ============================================================ */
function openToolbarMenu() {
  showBerthToolbarMenu({
    onDockWalk:        () => toast('Dock Walk is available in the Android app'),
    onBookingRequests: () => { location.hash = '#/booking-requests'; },
    onImportCsv:       onImportCsv,
    onExportCsv:       onExportCsv,
    onRestoreDefaults: onRestoreDefaults,
    onDeleteAll:       onDeleteAll
  });
}

/* ---------- Import CSV ---------- */
function onImportCsv() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.txt,text/csv';
  input.style.display = 'none';

  input.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    input.remove();
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseBerthCsv(text);
      if (!rows.length) {
        toast('No valid rows found', { kind: 'error' });
        return;
      }
      await runBerthImport(rows);
    } catch (err) {
      console.error('[berth csv] failed', err);
      toast('Failed to read file', { kind: 'error' });
    }
  });

  document.body.appendChild(input);
  input.click();
}

function parseBerthCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const parts = splitCsvLine(line);
    if (parts.length < 8) continue;

    rows.push({
      dockName:    parts[0]?.trim() ?? '',
      berthNumber: parts[1]?.trim() ?? '',
      length:      parts[2]?.trim() ?? '',
      width:       parts[3]?.trim() ?? '',
      depth:       parts[4]?.trim() ?? '',
      hasElectric: parts[5]?.trim() ?? '',
      hasWater:    parts[6]?.trim() ?? '',
      status:      parts[7]?.trim() ?? ''
    });
  }
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

async function runBerthImport(rows) {
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop is-open';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet is-open';
  sheet.innerHTML = `
    <div class="confirm-handle"></div>
    <div class="confirm-title">Importing berths…</div>
    <div class="confirm-message" id="berthImportProgress">Starting…</div>
    <div class="import-bar-wrap"><div class="import-bar" id="berthImportBar"></div></div>
  `;
  document.getElementById('modalRoot').append(backdrop, sheet);

  const progressEl = sheet.querySelector('#berthImportProgress');
  const barEl      = sheet.querySelector('#berthImportBar');

  try {
    const userId = store.userProfile?.userId || 0;
    const result = await importBerthsFromRows(
      store.activeClientId, userId, rows,
      (done, skipped, total) => {
        const processed = done + skipped;
        const pct = Math.round((processed / total) * 100);
        progressEl.textContent = `${processed} of ${total} · ${done} added, ${skipped} skipped`;
        barEl.style.width = pct + '%';
      }
    );

    progressEl.textContent = 'Done';
    barEl.style.width = '100%';
    await new Promise(r => setTimeout(r, 300));
    backdrop.remove();
    sheet.remove();

    toast(`Imported ${result.success} · skipped ${result.skipped} · failed ${result.failed}`,
          { kind: result.success > 0 ? 'success' : 'info' });
  } catch (err) {
    console.error('[berth import] failed', err);
    backdrop.remove();
    sheet.remove();
    toast('Import failed', { kind: 'error' });
  }
}

/* ---------- Export CSV ---------- */
function onExportCsv() {
  const berths = store.berthsFull || [];
  if (!berths.length) {
    toast('No berths to export', { kind: 'error' });
    return;
  }

  const header = 'Dock Name,Berth Number,Length (m),Width (m),Depth (m),Has Electric,Has Water,Status';
  const lines = [...berths]
    .sort((a,b) => {
      const dc = (a.dockName || '').localeCompare(b.dockName || '');
      if (dc !== 0) return dc;
      return (a.berthNumber || '').localeCompare(b.berthNumber || '', undefined, { numeric: true });
    })
    .map(b => [
      escapeCsv(b.dockName),
      escapeCsv(b.berthNumber),
      b.length,
      b.width,
      b.depth,
      b.hasElectric,
      b.hasWater,
      b.status
    ].join(','));

  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0,16).replace(/[:T]/g,'_');
  a.download = `berths_export_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  toast(`Exported ${berths.length} berths`, { kind: 'success' });
}

function escapeCsv(s) {
  const str = String(s ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/* ---------- Restore Defaults ---------- */
async function onRestoreDefaults() {
  const { confirmSheet } = await import('../ui/confirm.js');
  const ok = await confirmSheet({
    title: 'Reset to Default',
    message: 'Delete all berths and create 10 default berths (A1-A10)?',
    confirmText: 'Reset',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    const userId = store.userProfile?.userId || 0;
    await deleteAllBerths(store.activeClientId);

    for (let i = 1; i <= 10; i++) {
      await createBerth(store.activeClientId, userId, {
        dockName:     'Main Dock',
        berthNumber:  'A' + i,
        length:       12,
        width:        4,
        depth:        3,
        hasElectric:  true,
        hasWater:     true,
        status:       'AVAILABLE'
      });
    }
    toast('Reset complete — 10 berths created', { kind: 'success' });
  } catch (err) {
    console.error('[restore defaults] failed', err);
    toast('Reset failed', { kind: 'error' });
  }
}

/* ---------- Delete All ---------- */
async function onDeleteAll() {
  const { confirmSheet } = await import('../ui/confirm.js');
  const ok = await confirmSheet({
    title: 'Delete All Berths',
    message: 'Delete ALL berths? This cannot be undone. All berths and their assignments will be removed.',
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    const count = await deleteAllBerths(store.activeClientId);
    toast(`Deleted ${count} berths`, { kind: 'success' });
  } catch (err) {
    console.error('[delete all] failed', err);
    toast('Failed to delete berths', { kind: 'error' });
  }
}

/* ============================================================
   BERTH MENU
   ============================================================ */
function openBerthMenu(berth) {
  showBerthMenu(berth, {
    onSetAvailable:   onSetStatus('AVAILABLE'),
    onSetOccupied:    onSetStatus('OCCUPIED'),
    onSetMaintenance: onSetStatus('MAINTENANCE'),
    onBookBerth:      () => toast('Booking coming soon'),
    onViewBooking:    () => toast('View booking coming soon'),
    onAssignBoat:     () => toast('Assign boat coming soon'),
    onReleaseBoat:    () => toast('Release boat coming soon'),
    onViewBerth:      onViewBerth,
    onEditBerth:      onEditBerth,
    onDeleteBerth:    onDeleteBerth
  });
}

function onSetStatus(newStatus) {
  return async (berth) => {
    try {
      const userId = store.userProfile?.userId || 0;
      await updateBerthStatus(store.activeClientId, berth.id, newStatus, userId);
      toast(`Berth ${berth.berthNumber} set to ${newStatus.toLowerCase()}`, { kind: 'success' });
    } catch (err) {
      console.error('[berth status]', err);
      toast('Failed to update status', { kind: 'error' });
    }
  };
}

function onViewBerth(berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  const status = (berth.status || 'AVAILABLE').toUpperCase();
  const boat = berth.assignedBoatName || 'None';

  sheet.innerHTML = `
    <div class="assign-handle"></div>
    <div class="assign-title">Berth ${escapeHtml(berth.berthNumber || '')}</div>
    <div class="assign-divider"></div>

    <div class="bkr-detail-body">
      <div class="bkr-detail-row"><span>Dock</span><b>${escapeHtml(berth.dockName || '—')}</b></div>
      <div class="bkr-detail-row"><span>Number</span><b>${escapeHtml(berth.berthNumber || '—')}</b></div>
      <div class="bkr-detail-row"><span>Length</span><b>${berth.length} m</b></div>
      <div class="bkr-detail-row"><span>Width</span><b>${berth.width} m</b></div>
      <div class="bkr-detail-row"><span>Depth</span><b>${berth.depth} m</b></div>
      <div class="bkr-detail-row"><span>Electric</span><b>${berth.hasElectric ? 'Yes' : 'No'}</b></div>
      <div class="bkr-detail-row"><span>Water</span><b>${berth.hasWater ? 'Yes' : 'No'}</b></div>
      <div class="bkr-detail-row"><span>Status</span><b>${escapeHtml(status)}</b></div>
      <div class="bkr-detail-row"><span>Boat</span><b>${escapeHtml(boat)}</b></div>
    </div>

    <div class="assign-divider"></div>
    <button class="assign-cancel" id="berthDetailClose">Close</button>
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
  sheet.querySelector('#berthDetailClose').addEventListener('click', close);
}

function onEditBerth(berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Edit Berth</div>

    <form id="editBerthForm" class="add-form" novalidate>
      <div class="add-scroll">
        <input class="add-input" id="eb-dockName"    type="text"   placeholder="Dock Name *"    value="${escapeAttr(berth.dockName || '')}">
        <input class="add-input" id="eb-berthNumber" type="text"   placeholder="Berth Number *" value="${escapeAttr(berth.berthNumber || '')}">
        <input class="add-input" id="eb-length"      type="number" step="0.1" placeholder="Length (m)" value="${berth.length > 0 ? berth.length : ''}">
        <input class="add-input" id="eb-width"       type="number" step="0.1" placeholder="Width (m)"  value="${berth.width  > 0 ? berth.width  : ''}">
        <input class="add-input" id="eb-depth"       type="number" step="0.1" placeholder="Depth (m)"  value="${berth.depth  > 0 ? berth.depth  : ''}">

        <label class="add-checkbox" style="margin-top:16px;">
          <input type="checkbox" id="eb-electric" ${berth.hasElectric ? 'checked' : ''}>
          <span>Has electricity</span>
        </label>

        <label class="add-checkbox">
          <input type="checkbox" id="eb-water" ${berth.hasWater ? 'checked' : ''}>
          <span>Has water</span>
        </label>

        <div class="add-section-title" style="margin-top:16px;">Status</div>
        <select class="add-input add-select" id="eb-status">
          <option value="AVAILABLE"   ${status === 'AVAILABLE'   ? 'selected' : ''}>AVAILABLE</option>
          <option value="OCCUPIED"    ${status === 'OCCUPIED'    ? 'selected' : ''}>OCCUPIED</option>
          <option value="MAINTENANCE" ${status === 'MAINTENANCE' ? 'selected' : ''}>MAINTENANCE</option>
        </select>
      </div>

      <button type="submit" class="add-save" id="eb-save">Update Berth</button>
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

  const form = sheet.querySelector('#editBerthForm');
  const save = sheet.querySelector('#eb-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.disabled = true;
    save.textContent = 'Updating…';

    try {
      const fields = {
        dockName:     sheet.querySelector('#eb-dockName').value.trim(),
        berthNumber:  sheet.querySelector('#eb-berthNumber').value.trim(),
        length:       parseFloat(sheet.querySelector('#eb-length').value) || 0,
        width:        parseFloat(sheet.querySelector('#eb-width').value)  || 0,
        depth:        parseFloat(sheet.querySelector('#eb-depth').value)  || 0,
        hasElectric:  sheet.querySelector('#eb-electric').checked,
        hasWater:     sheet.querySelector('#eb-water').checked,
        status:       sheet.querySelector('#eb-status').value
      };

      if (!fields.dockName || !fields.berthNumber) {
        throw new Error('Dock name and berth number are required.');
      }

      const userId = store.userProfile?.userId || 0;
      await updateBerth(berth.id, userId, fields);
      close();
      toast(`Berth ${fields.berthNumber} updated`, { kind: 'success' });

    } catch (err) {
      console.error('[berth edit]', err);
      save.disabled = false;
      save.textContent = 'Update Berth';
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to update berth.';
    }
  });
}

async function onDeleteBerth(berth) {
  const ok = await confirmSheet({
    title:   'Delete berth',
    message: `Delete berth ${berth.berthNumber}? This cannot be undone.`,
    confirmText: 'Delete',
    cancelText:  'Cancel'
  });
  if (!ok) return;

  try {
    await deleteBerth(berth.id);
    toast(`Berth ${berth.berthNumber} deleted`, { kind: 'success' });
  } catch (err) {
    console.error('[berth delete]', err);
    toast('Failed to delete berth', { kind: 'error' });
  }
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}