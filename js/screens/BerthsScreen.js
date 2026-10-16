import { showBerthingRates, showBerthingCharges, showUtilityInvoiceChoices } from './BerthingBillingSheet.js';
import { money, savedCurrency } from '../util/BillingCurrency.js';
import { marinaCurrency, checkBillingClient } from '../util/BillingData.js';
import { mountBerthPierMap } from '../components/BerthPierMap.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { t, getLocale, languagePicker } from '../i18n.js';
// js/screens/BerthsScreen.js
// Berths grid ” mirrors fragment_berths.xml

import { renderBerthCard } from '../components/BerthCard.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { wireBookingDatePicker } from '../ui/BookingDatePicker.js';
import { showBerthToolbarMenu } from '../components/BerthToolbarMenu.js';
import { showBerthMenu } from '../components/BerthMenuSheet.js';
import { confirmSheet } from '../ui/confirm.js';
import { showBerthHelp } from '../components/BerthHelpDialog.js';
import { showAssignBoatSheet } from '../components/AssignBoatSheet.js';
import { showAddReadingDialog } from '../components/UtilitiesSheet.js';
import {
  findActiveBookingForBerth,
  listenForActiveBookings,
  showBookingDetailsSheet
} from './BookingDetailsSheet.js';
import { utilityHistory } from '../analytics/utilityConsumption.js';
import {
  listenForBerths,
  createBerth, deleteAllBerths, importBerthsFromRows,
  updateBerthStatus, updateBerth, deleteBerth,
  assignBoatToBerth, releaseBoatFromBerth,
  listenForUtilityReadings, createUtilityReading,
  getActiveTariff, saveTariff, prepareUtilityInvoice,
  voidUtilityReading, correctUtilityReading
} from '../db.js';

let pierMap = null;
let unsubscribe = null;
let bookingUnsubscribe = null;
let searchQuery = '';
let viewUtilUnsub = null;
let berthDateView = { mode: 'TODAY', start: null, end: null, label: 'Viewing: Today' };

export function mountBerthsScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty">
         <h2>${t("No client assigned")}</h2>
         <p>${t("Your user profile doesn't include a clientId.")}</p>
       </div>`;
    return;
  }

  pierMap = null;
  searchQuery = '';
  berthDateView = { mode: 'TODAY', start: null, end: null, label: 'Viewing: Today' };
  store.berthBookings = [];

  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="berth-header">
      <div class="berth-header-row">
        <div class="berth-pill">${t("Marina Berths")}</div>
        <button class="berth-info" id="berthHelp" aria-label="${t("Help")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="berth-header-spacer"></div>
        <button class="berth-icon-btn" id="berthSearchToggle" aria-label="${t("Search")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
        <button class="berth-icon-btn" id="berthMenuBtn" aria-label="${t("Berth menu")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <circle cx="12" cy="5"  r="1.6"/>
            <circle cx="12" cy="12" r="1.6"/>
            <circle cx="12" cy="19" r="1.6"/>
          </svg>
        </button>
      </div>

      <div class="berth-summary" id="berthSummary">${t("Loading...")}</div>
      <button type="button" class="berth-date-filter" id="berthDateFilter">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="7"/><line x1="16" y1="2" x2="16" y2="7"/>
        </svg>
        <span id="berthDateFilterLabel">${t("Viewing: Today")}</span>
      </button>
    </div>

    <div class="berth-search" id="berthSearch" hidden>
      <input id="berthSearchInput" type="text" placeholder="${t("Search berth or boat...")}"
             autocomplete="off">
      <button type="button" class="search-cancel" id="berthSearchCancel">${t("Cancel")}</button>
    </div>

    <div id="berthPierMap"></div>
    <div class="berth-grid" id="berthGrid">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  document.getElementById('berthHelp').addEventListener('click', showBerthHelp);
  document.getElementById('berthMenuBtn').addEventListener('click', openToolbarMenu);
  document.getElementById('berthDateFilter').addEventListener('click', showBerthDateFilterSheet);

  pierMap = mountBerthPierMap(document.getElementById('berthPierMap'), { clientId: store.activeClientId, t, onOpen: openBerthMenu });
  setupSearch();

  if (unsubscribe) unsubscribe();
  if (bookingUnsubscribe) bookingUnsubscribe();

  bookingUnsubscribe = listenForActiveBookings(store.activeClientId, (bookings, err) => {
    if (err) {
      console.error('[berth bookings] listener failed', err);
      return;
    }
    store.berthBookings = bookings;
    renderBerthGrid();
    updateSummary();
  });

  unsubscribe = listenForBerths(store.activeClientId, (berths, err) => {
    if (err) {
      document.getElementById('berthGrid').innerHTML =
        `<div class="boats-empty">
           <h2>${t("Couldn't load berths")}</h2>
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
    (b.assignedBoatName || '').toLowerCase().includes(q) ||
    (b.activeBooking?.vesselName || '').toLowerCase().includes(q)
  );
}

function showBerthDateFilterSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet berth-date-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${t('Berth Date View')}</div>
    ${dateViewItem('dateViewToday', 'Today', 'Live berth status')}
    ${dateViewItem('dateViewSingle', 'Select a date', 'View bookings and availability for one day')}
    ${dateViewItem('dateViewRange', 'Custom stay dates', 'Check availability from arrival to departure')}
    <button type="button" class="assign-cancel berth-date-cancel">${t('Cancel')}</button>
  `;
  document.getElementById('modalRoot').append(backdrop, sheet);

  const close = () => closeDateSheet(backdrop, sheet);
  backdrop.addEventListener('click', close);
  sheet.querySelector('.berth-date-cancel').addEventListener('click', close);
  sheet.querySelector('#dateViewToday').addEventListener('click', () => {
    close();
    berthDateView = { mode: 'TODAY', start: null, end: null, label: 'Viewing: Today' };
    updateDateFilterLabel();
    renderBerthGrid();
    updateSummary();
  });
  sheet.querySelector('#dateViewSingle').addEventListener('click', () => {
    close();
    setTimeout(() => showDateInputSheet(false), 230);
  });
  sheet.querySelector('#dateViewRange').addEventListener('click', () => {
    close();
    setTimeout(() => showDateInputSheet(true), 230);
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });
}

function dateViewItem(id, title, subtitle) {
  return `
    <button type="button" class="sheet-item berth-date-item" id="${id}">
      <span class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="7"/><line x1="16" y1="2" x2="16" y2="7"/></svg>
      </span>
      <span class="sheet-item-text"><span class="sheet-item-title">${t(title)}</span><span class="sheet-item-subtitle">${t(subtitle)}</span></span>
      <span class="sheet-chevron">›</span>
    </button>`;
}

function showDateInputSheet(isRange) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet berth-date-sheet';
  const today = toDateInputValue(Date.now());

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${t(isRange ? 'Custom stay dates' : 'Select a date')}</div>
    <div class="berth-date-fields">
      <label><span>${t(isRange ? 'Arrival' : 'Date')}</span><input type="date" id="berthDateStart" value="${today}"></label>
      ${isRange ? `<label><span>${t('Departure')}</span><input type="date" id="berthDateEnd" value="${toDateInputValue(nextLocalDay(Date.now()))}"></label>` : ''}
      <div class="berth-date-error" id="berthDateError"></div>
    </div>
    <button type="button" class="add-save" id="applyBerthDate">${t('Apply')}</button>
    <button type="button" class="assign-cancel berth-date-cancel">${t('Cancel')}</button>
  `;
  document.getElementById('modalRoot').append(backdrop, sheet);

  const calendars = [];
  const startInput = sheet.querySelector('#berthDateStart');
  const endInput = sheet.querySelector('#berthDateEnd');
  calendars.push(wireBookingDatePicker(startInput, {
    label: t(isRange ? 'Arrival' : 'Date'),
    locale: getLocale()
  }));
  if (endInput) {
    calendars.push(wireBookingDatePicker(endInput, {
      label: t('Departure'),
      locale: getLocale()
    }));
  }

  const close = () => {
    calendars.forEach(calendar => calendar.close());
    closeDateSheet(backdrop, sheet);
  };
  backdrop.addEventListener('click', close);
  sheet.querySelector('.berth-date-cancel').addEventListener('click', close);
  sheet.querySelector('#applyBerthDate').addEventListener('click', () => {
    const startValue = sheet.querySelector('#berthDateStart').value;
    const endValue = isRange ? sheet.querySelector('#berthDateEnd').value : startValue;
    const start = localDateStart(startValue);
    const selectedEnd = localDateStart(endValue);
    const error = sheet.querySelector('#berthDateError');

    if (!Number.isFinite(start) || !Number.isFinite(selectedEnd)) {
      error.textContent = t('Select valid dates');
      return;
    }

    if (isRange && selectedEnd <= start) {
      error.textContent = t('Departure must be after arrival');
      return;
    }

    const end = isRange ? selectedEnd : nextLocalDay(start);
    const label = isRange
      ? `Stay: ${formatShortDate(start)} – ${formatShortDate(selectedEnd)}`
      : `Viewing: ${formatLongDate(start)}`;

    berthDateView = { mode: isRange ? 'RANGE' : 'DATE', start, end, label };
    updateDateFilterLabel();
    renderBerthGrid();
    updateSummary();
    close();
  });

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });
}

function closeDateSheet(backdrop, sheet) {
  backdrop.classList.remove('is-open');
  sheet.classList.remove('is-open');
  setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
}

function localDateStart(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return NaN;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0).getTime();
}

function toDateInputValue(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function nextLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

function formatShortDate(timestamp) {
  return new Intl.DateTimeFormat(getLocale() || 'en-GB', { day: '2-digit', month: 'short' }).format(timestamp);
}

function formatLongDate(timestamp) {
  return new Intl.DateTimeFormat(getLocale() || 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(timestamp);
}

function updateDateFilterLabel() {
  const label = document.getElementById('berthDateFilterLabel');
  if (label) label.textContent = berthDateView.label;
}

/* ============================================================
   RENDER
   ============================================================ */
function renderBerthGrid() {
  const grid = document.getElementById('berthGrid');
  if (!grid) return;
  const berths = applySearch((store.berthsFull || []).map(withDateViewBooking));
  pierMap?.render(berths);

  if (!berths.length) {
    grid.innerHTML = `
      <div class="boats-empty" style="grid-column: 1 / -1;">
        <h2>${searchQuery ? tr('No matches') : 'No berths yet'}</h2>
        <p>${searchQuery ? `${escapeHtml(tr("ui.noMatches", {query:searchQuery}))}` : 'Add berths from your Android app or via CSV.'}</p>
      </div>`;
    return;
  }

  const sorted = [...berths].sort((a, b) => {
    const dc = (a.dockName || '').localeCompare(b.dockName || '');
    if (dc !== 0) return dc;
    return (a.berthNumber || '').localeCompare(b.berthNumber || '', undefined, { numeric: true });
  });

  grid.innerHTML = sorted.map(renderBerthCard).join('');

  grid.querySelectorAll('.berth-card').forEach(el => {
    const berthId = Number(el.dataset.berthId);
    const berth = withDateViewBooking(store.berthsFull.find(b => b.id === berthId));

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

  if (berthDateView.mode !== 'TODAY') {
    const projected = berths.map(withDateViewBooking);
    const booked = projected.filter(b => b?.periodBookingCount > 0).length;
    const maintenance = projected.filter(b => b?.status === 'MAINTENANCE').length;
    const unavailable = new Set(projected
      .filter(b => b?.periodBookingCount > 0 || b?.status === 'MAINTENANCE')
      .map(b => Number(b.id)));
    const available = Math.max(0, total - unavailable.size);

    el.innerHTML = `
      <div>${t('Period availability')}</div>
      <div>${t('Booked:')} <b>${booked}</b>    ${t('Available:')} <b>${available}</b></div>
      <div>${t('Maintenance:')} <b>${maintenance}</b>    ${t('Total:')} <b>${total}</b></div>
    `;
    return;
  }

  const occupied = berths.filter(b => b.status === 'OCCUPIED').length;
  const maintenance = berths.filter(b => b.status === 'MAINTENANCE').length;
  const available = berths.filter(b => b.status === 'AVAILABLE').length;
  const booked = (store.berthBookings || [])
    .filter(b => String(b.status || '').toUpperCase() === 'CONFIRMED')
    .reduce((ids, b) => ids.add(Number(b.berthId)), new Set()).size;
  const alerts = 0;

  const pct = total > 0 ? Math.round((occupied * 100) / total) : 0;

  el.innerHTML = `
    <div>${t("Occupied:")} <b>${occupied}</b> (${pct}%)    Total: <b>${total}</b></div>
    <div>${t("Booked:")} <b>${booked}</b>    ${t("Available:")} <b>${available}</b></div>
    <div>${t("Maintenance:")} <b>${maintenance}</b>    ${t("Alerts:")} <b>${alerts}</b></div>
  `;
}

function withActiveBooking(berth) {
  if (!berth) return null;
  const bookings = (store.berthBookings || [])
    .filter(booking => Number(booking.berthId) === Number(berth.id))
    .sort((left, right) => {
      const leftCheckedIn = String(left.status || '').toUpperCase() === 'CHECKED_IN';
      const rightCheckedIn = String(right.status || '').toUpperCase() === 'CHECKED_IN';
      if (leftCheckedIn !== rightCheckedIn) return leftCheckedIn ? -1 : 1;
      return Number(left.arrivalDate || 0) - Number(right.arrivalDate || 0);
    });
  return { ...berth, activeBooking: bookings[0] || null };
}

function withDateViewBooking(berth) {
  if (!berth || berthDateView.mode === 'TODAY') return withActiveBooking(berth);

  const bookings = (store.berthBookings || [])
    .filter(booking => Number(booking.berthId) === Number(berth.id))
    .filter(booking => Number(booking.arrivalDate || 0) < berthDateView.end
      && Number(booking.departureDate || 0) > berthDateView.start)
    .sort((left, right) => Number(left.arrivalDate || 0) - Number(right.arrivalDate || 0));

  const first = bookings[0] || null;
  const activeBooking = first ? {
    ...first,
    vesselName: bookings.length > 1
      ? `${first.vesselName || 'Vessel'} +${bookings.length - 1}`
      : (first.vesselName || 'Vessel')
  } : null;

  return {
    ...berth,
    liveStatus: berth.status,
    status: berth.status === 'MAINTENANCE' ? 'MAINTENANCE' : (activeBooking ? 'OCCUPIED' : 'AVAILABLE'),
    assignedBoatName: activeBooking ? `📅  ${activeBooking.vesselName}` : null,
    activeBooking,
    selectedPeriodBooking: first,
    periodBookingCount: bookings.length,
    dateProjection: true
  };
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
    onDockWalk:        () => toast(tr('Dock Walk is available in the Android app')),
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
        toast(tr('No valid rows found'), { kind: 'error' });
        return;
      }
      await runBerthImport(rows);
    } catch (err) {
      console.error('[berth csv] failed', err);
      toast(tr('Failed to read file'), { kind: 'error' });
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
    <div class="confirm-title">${tr("Importing berths¦")}</div>
    <div class="confirm-message" id="berthImportProgress">${tr("Starting¦")}</div>
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
        progressEl.textContent = `${processed} of ${total} Â· ${done} added, ${skipped} skipped`;
        barEl.style.width = pct + '%';
      }
    );

    progressEl.textContent = tr('Done');
    barEl.style.width = '100%';
    await new Promise(r => setTimeout(r, 300));
    backdrop.remove();
    sheet.remove();

    toast(tr(`Imported ${result.success} Â· skipped ${result.skipped} Â· failed ${result.failed}`),
          { kind: result.success > 0 ? 'success' : 'info' });
  } catch (err) {
    console.error('[berth import] failed', err);
    backdrop.remove();
    sheet.remove();
    toast(tr('Import failed'), { kind: 'error' });
  }
}

/* ---------- Export CSV ---------- */
function onExportCsv() {
  const berths = store.berthsFull || [];
  if (!berths.length) {
    toast(tr('No berths to export'), { kind: 'error' });
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

  toast(tr(`Exported ${berths.length} berths`), { kind: 'success' });
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
  const ok = await confirmSheet({
    title: 'Reset to Default',
    message: 'Delete all berths and create 10 default berths (A1-A10)?',
    confirmText: tr('Reset'),
    cancelText: tr('Cancel')
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
    toast(tr('Reset complete ” 10 berths created'), { kind: 'success' });
  } catch (err) {
    console.error('[restore defaults] failed', err);
    toast(tr('Reset failed'), { kind: 'error' });
  }
}

/* ---------- Delete All ---------- */
async function onDeleteAll() {
  const ok = await confirmSheet({
    title: 'Delete All Berths',
    message: 'Delete ALL berths? This cannot be undone. All berths and their assignments will be removed.',
    confirmText: tr('Delete'),
    cancelText: tr('Cancel')
  });
  if (!ok) return;

  try {
    const count = await deleteAllBerths(store.activeClientId);
    toast(tr(`Deleted ${count} berths`), { kind: 'success' });
  } catch (err) {
    console.error('[delete all] failed', err);
    toast(tr('Failed to delete berths'), { kind: 'error' });
  }
}

/* ============================================================
   BERTH MENU
   ============================================================ */
async function openBerthMenu(berth) {
  let activeBooking = berth.dateProjection ? berth.selectedPeriodBooking : null;

  if (!berth.dateProjection) {
    try {
      activeBooking = await findActiveBookingForBerth(
        store.activeClientId,
        berth.id
      );
    } catch (err) {
      console.error('[berth booking] lookup failed', err);
      toast(tr('Failed to load booking'), { kind: 'error' });
    }
  }

  const berthWithBooking = {
    ...berth,
    status: berth.liveStatus || berth.status,
    activeBooking
  };

  showBerthMenu(berthWithBooking, {
    onSetAvailable:   onSetStatus('AVAILABLE'),
    onSetOccupied:    onSetStatus('OCCUPIED'),
    onSetMaintenance: onSetStatus('MAINTENANCE'),
    onViewBooking:    onViewBooking,
    onAssignBoat:     onAssignBoat,
    onReleaseBoat:    onReleaseBoat,
    onViewBerth:      onViewBerth,
    onUtilities:      onViewBerth,
    onEditBerth:      onEditBerth,
    onDeleteBerth:    onDeleteBerth
  });
}

function onViewBooking(berth) {
  if (!berth.activeBooking) {
    toast(tr('No active booking found'), { kind: 'error' });
    return;
  }

  showBookingDetailsSheet({
    booking: berth.activeBooking,
    berth,
    onChanged: status => {
      const action = status === 'CHECKED_OUT' ? 'checked out' : 'checked in';
      toast(tr(`${berth.activeBooking.vesselName || 'Vessel'} ${action}`), { kind: 'success' });
    }
  });
}

function onSetStatus(newStatus) {
  return async (berth) => {
    try {
      const userId = store.userProfile?.userId || 0;
      await updateBerthStatus(store.activeClientId, berth.id, newStatus, userId);
      toast(tr(`Berth ${berth.berthNumber} set to ${newStatus.toLowerCase()}`), { kind: 'success' });
    } catch (err) {
      console.error('[berth status]', err);
      toast(tr('Failed to update status'), { kind: 'error' });
    }
  };
}

/* ============================================================
   VIEW BERTH + UTILITIES
   ============================================================ */
function onViewBerth(berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet berth-details-sheet';

  const status = (berth.status || 'AVAILABLE').toUpperCase();
  const boat = berth.assignedBoatName || 'None';
  const utilsId = 'viewUtil_' + berth.id;

  sheet.innerHTML = `
    <button type="button" id="berthDetailCloseTop" aria-label="${t('Close')}" style="position:absolute;right:18px;top:16px;border:0;background:transparent;color:inherit;font-size:28px;line-height:1;cursor:pointer;">&times;</button>
    <div class="assign-title">${t("Berth Details")}</div>
    <div class="assign-divider"></div>

    <div class="bkr-detail-body">
      <div class="bkr-detail-row"><span>${t("Dock")}</span><b>${escapeHtml(berth.dockName || '”')}</b></div>
      <div class="bkr-detail-row"><span>${t("Berth")}</span><b>${escapeHtml(berth.berthNumber || '”')}</b></div>
      <div class="bkr-detail-row"><span>${t("Size")}</span><b>${berth.length}m x ${berth.width}m</b></div>
      <div class="bkr-detail-row"><span>${t("Depth")}</span><b>${berth.depth} m</b></div>
      <div class="bkr-detail-row"><span>${t("Electric")}</span><b>${berth.hasElectric ? tr('Yes') : tr('No')}</b></div>
      ${berth.hasElectric ? `<div class="bkr-detail-row"><span>${t("Shore power")}</span><b>${escapeHtml(formatShorePower(berth))}</b></div>` : ''}
      <div class="bkr-detail-row"><span>${t("Water")}</span><b>${berth.hasWater ? tr('Yes') : tr('No')}</b></div>
      <div class="bkr-detail-row"><span>${t("Status")}</span><b>${escapeHtml(status)}</b></div>
      <div class="bkr-detail-row"><span>${t("Boat")}</span><b>${escapeHtml(boat)}</b></div>
    </div>

    <div class="assign-divider"></div>
    <div class="view-util-section">
      <div class="view-util-heading">${t("Berthing")}</div>
    </div>
    <div class="view-berth-actions">
      <button type="button" class="view-berth-btn" id="viewBerthingRates" style="grid-column:1 / -1;">${t("Berthing Rates")}</button>
    </div>
    <button type="button" class="view-berth-generate" id="viewBerthingCharges">${t("Berthing Charges / Invoice")}</button>

    <div class="assign-divider"></div>
    <div class="view-util-section">
      <div class="view-util-heading">${t("Utilities")}</div>
      <div id="${utilsId}" class="view-util-body">${tr("Loading¦")}</div>
    </div>

    <div class="assign-divider"></div>
    <div class="view-berth-actions">
      <button class="view-berth-btn" id="viewAddReading">${t("+ Reading")}</button>
      <button class="view-berth-btn" id="viewReadingHistory">${t("Reading History")}</button>
      <button class="view-berth-btn" id="viewTariffs">${t("Utility Rates")}</button>
    </div>
    <button class="view-berth-generate" id="viewGenerate">${t("Generate Invoice")}</button>
    <button class="assign-cancel" id="berthDetailClose">${t("CLOSE")}</button>
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
    if (viewUtilUnsub) { try { viewUtilUnsub(); } catch (e) {} viewUtilUnsub = null; }
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('#berthDetailCloseTop').addEventListener('click', close);
  sheet.querySelector('#berthDetailClose').addEventListener('click', close);

  sheet.querySelector('#viewAddReading').addEventListener('click', () => {
    openAddReadingFromView(berth);
  });

  sheet.querySelector('#viewReadingHistory').addEventListener('click', () => {
    openReadingHistory(berth);
  });

  sheet.querySelector('#viewBerthingRates').addEventListener('click', () => {
    close();
    showBerthingRates(berth);
  });

  sheet.querySelector('#viewBerthingCharges').addEventListener('click', () => {
    close();
    showBerthingCharges(berth);
  });

  sheet.querySelector('#viewTariffs').addEventListener('click', () => {
    close();
    openTariffsSheet(berth);
  });

  sheet.querySelector('#viewGenerate').addEventListener('click', async () => {
    try {
      const draft = await prepareUtilityInvoice(store.activeClientId, berth);
      close();
      const { showAddInvoiceSheet } = await import('./AddInvoiceSheet.js');
      if (draft.groups) showUtilityInvoiceChoices(draft.groups);
      else await showAddInvoiceSheet(draft);
    } catch (err) {
      console.error('[utility invoice]', err);
      toast(err.message || 'Unable to generate utility invoice', { kind: 'error' });
    }
  });

  renderViewUtilities(berth, utilsId);
}

async function renderViewUtilities(berth, containerId) {
  if (viewUtilUnsub) { try { viewUtilUnsub(); } catch (e) {} viewUtilUnsub = null; }

  let elecTariff = null;
  let waterTariff = null;
  let wastewaterTariff = null;

  try {
    elecTariff = await getActiveTariff(store.activeClientId, 'ELECTRICITY');
    waterTariff = await getActiveTariff(store.activeClientId, 'WATER');
    wastewaterTariff = await getActiveTariff(store.activeClientId, 'WASTEWATER');
  } catch (err) {
    console.warn('[utilities] tariffs unavailable', err);
  }

  viewUtilUnsub = listenForUtilityReadings(
    store.activeClientId,
    berth.id,
    (readings, err) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (err) {
        container.innerHTML = `<div class="view-util-empty">${t("Failed to load")}</div>`;
        return;
      }

      const history = utilityHistory(store.activeClientId, readings);
      const elec = latestFor(history, 'ELECTRICITY');
      const water = latestFor(history, 'WATER');
      const wastewater = latestFor(history, 'WASTEWATER');

      container.innerHTML = `
        ${renderViewUtilBlock('Electricity', elec, elecTariff, 'kWh')}
        ${renderViewUtilBlock('Water', water, waterTariff, 'L')}
        ${renderViewUtilBlock('Wastewater', wastewater, wastewaterTariff, 'L')}
      `;
    }
  );
}

function latestFor(history, type) {
  const entries = history.entries.filter(r => r.type === type && !r.voided);
  return { latest: entries[0] || null, mixed: new Set(entries.filter(r => r.mode !== 'INSTANTANEOUS').map(r => r.mode)).size > 1 };
}

function renderViewUtilBlock(label, { latest, mixed }, tariff, unit) {
  if (!latest) {
    return `
      <div class="view-util-block">
        <div class="view-util-label">${tr(label)}</div>
        <div class="view-util-empty">${t("No usage data available")}</div>
      </div>
    `;
  }

  const consumption = latest.consumption;
  const pricingMode = tariff?.pricingMode || 'METERED';
  const tariffUnit = String(tariff?.unit || '').trim().toUpperCase();
  const price = (tariff?.pricePerUnit || 0) / (unit === 'L' && ['M3', 'M³'].includes(tariffUnit) ? 1000 : 1);
  const isIncluded = pricingMode === 'INCLUDED';
  const charge = (consumption != null && !isIncluded) ? consumption * price : 0;

  const tariffLine = isIncluded
    ? 'Rate: Included'
    : (tariff ? `Rate: ${savedCurrency(tariff.currency)} ${price.toFixed(4)}/${unit}` : 'Rate: Not set');

  return `
    <div class="view-util-block">
      <div class="view-util-label">${tr(label)}</div>
      <div class="view-util-line">${t('Latest')}: ${latest.value} ${escapeHtml(latest.unit || unit)} <span class="util-mode-badge">${t(latest.mode)}</span></div>
      ${consumption != null ? `<div class="view-util-line">${t('Calculated consumption')}: ${consumption.toFixed(2)} ${unit}</div>` : `<div class="view-util-line view-util-empty">${latest.mode === 'INSTANTANEOUS' ? t('Instantaneous readings are not consumption') : t('A previous cumulative reading is required')}</div>`}
      ${mixed ? `<div class="view-util-line util-warning">${t('Mixed reading modes are calculated separately')}</div>` : ''}
      <div class="view-util-line">${tariffLine}</div>
      ${consumption != null && tariff && !isIncluded ? `<div class="view-util-line">Charge: ${money(charge, tariff.currency, uiLocale())}</div>` : ''}
    </div>
  `;
}

function openReadingHistory(berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet berth-details-sheet';
  sheet.innerHTML = `
    <button type="button" data-close aria-label="${t('Close')}" style="position:absolute;right:18px;top:16px;border:0;background:transparent;color:inherit;font-size:28px;line-height:1;">&times;</button>
    <div class="sheet-title" style="text-align:center;">${t('Reading History')} · ${escapeHtml(berth.berthNumber || '')}</div>
    <div style="display:flex;gap:8px;padding:12px 18px;flex-wrap:wrap;">
      <button type="button" class="view-berth-btn" data-filter="ALL" style="height:42px;min-width:72px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${t('All')}</button>
      <button type="button" class="view-berth-btn" data-filter="ELECTRICITY" style="height:42px;min-width:112px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${t('Electricity')}</button>
      <button type="button" class="view-berth-btn" data-filter="WATER" style="height:42px;min-width:88px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${t('Water')}</button>
      <button type="button" class="view-berth-btn" data-filter="WASTEWATER" style="height:42px;min-width:112px;padding:0 16px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${t('Wastewater')}</button>
    </div>
    <div class="add-scroll" data-history style="padding:0 18px 24px;overflow:auto;"><div class="view-util-empty">${t('Loading…')}</div></div>`;
  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => { backdrop.classList.add('is-open'); sheet.classList.add('is-open'); });
  let filter = 'ALL', unsub = null, cached = [];
  const close = () => {
    if (unsub) unsub();
    backdrop.classList.remove('is-open'); sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };
  const draw = () => {
    const result = utilityHistory(store.activeClientId, cached);
    const entries = result.entries.filter(r => filter === 'ALL' || r.type === filter);
    const modes = new Set(entries.filter(r => !r.voided && r.mode !== 'INSTANTANEOUS').map(r => `${r.type}:${r.mode}`));
    const mixedTypes = ['ELECTRICITY', 'WATER', 'WASTEWATER'].filter(type =>
      [...modes].some(v => v === `${type}:CUMULATIVE`) && [...modes].some(v => v === `${type}:INTERVAL`));
    sheet.querySelector('[data-history]').innerHTML = `
      ${mixedTypes.length ? `<div class="util-warning" style="padding:12px;margin-bottom:10px;border:1px solid currentColor;border-radius:12px;">${t('Mixed reading modes are calculated separately')}</div>` : ''}
      ${entries.length ? entries.map(reading => renderHistoryEntry(reading)).join('') : `<div class="view-util-empty">${t('No readings recorded')}</div>`}`;
    sheet.querySelectorAll('[data-void]').forEach(button => button.onclick = () => voidHistoryReading(entries.find(r => String(r._docId) === button.dataset.void)));
    sheet.querySelectorAll('[data-correct]').forEach(button => button.onclick = () => correctHistoryReading(berth, entries.find(r => String(r._docId) === button.dataset.correct)));
  };
  const renderHistoryEntry = reading => {
    const when = reading.at ? new Intl.DateTimeFormat(uiLocale(), {dateStyle:'medium', timeStyle:'short'}).format(reading.at) : '—';
    const calculated = reading.consumption == null ? (reading.mode === 'INSTANTANEOUS' ? t('Informational only') : t('Baseline / not calculated')) : `${reading.consumption.toFixed(2)} ${escapeHtml(reading.unit)}`;
    return `<div class="view-util-block" style="margin-bottom:10px;${reading.voided ? 'opacity:.55;' : ''}">
      <div class="view-util-label">${t(reading.type === 'WASTEWATER' ? 'Wastewater' : reading.type === 'WATER' ? 'Water' : 'Electricity')} <span class="util-mode-badge">${t(reading.mode)}</span>${reading.voided ? ` <span class="util-mode-badge">${t('VOID')}</span>` : ''}</div>
      <div class="view-util-line">${escapeHtml(when)} · ${reading.value} ${escapeHtml(reading.unit)}</div>
      <div class="view-util-line">${t('Calculated consumption')}: ${calculated}</div>
      ${reading.notes ? `<div class="view-util-line">${escapeHtml(reading.notes)}</div>` : ''}
      ${reading.voided && reading.voidReason ? `<div class="view-util-line">${t('Reason')}: ${escapeHtml(reading.voidReason)}</div>` : ''}
      ${!reading.voided ? `<div style="display:flex;gap:10px;margin-top:12px;"><button type="button" class="view-berth-btn" data-correct="${escapeAttr(reading._docId)}" style="height:42px;min-width:96px;padding:0 18px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${t('Correct')}</button><button type="button" class="view-berth-btn" data-void="${escapeAttr(reading._docId)}" style="height:42px;min-width:76px;padding:0 18px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;">${t('Void')}</button></div>` : ''}
    </div>`;
  };
  const voidHistoryReading = async reading => {
    if (!reading) return;
    const reason = await showVoidReadingSheet(reading);
    if (reason == null) return;
    try {
      await voidUtilityReading(store.activeClientId, reading, store.userProfile?.userId || 0, reason);
      toast(t('Reading voided'), {kind:'success'});
    } catch (err) { toast(err.message || t('Unable to void reading'), {kind:'error'}); }
  };
  const correctHistoryReading = (targetBerth, reading) => {
    if (!reading) return;
    showAddReadingDialog(targetBerth, async fields => {
      await correctUtilityReading(store.activeClientId, reading, store.userProfile?.userId || 0, fields);
      toast(t('Correction saved'), {kind:'success'});
    }, { initial: reading, title: t('Correct Reading'), saveLabel: t('SAVE CORRECTION'), closeOnSave: true });
  };
  backdrop.addEventListener('click', close);
  sheet.querySelector('[data-close]').addEventListener('click', close);
  sheet.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; draw(); });
  unsub = listenForUtilityReadings(store.activeClientId, berth.id, (readings, err) => {
    if (err) { sheet.querySelector('[data-history]').innerHTML = `<div class="view-util-empty">${t('Failed to load')}</div>`; return; }
    cached = readings; draw();
  });
}

function showVoidReadingSheet(reading) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `
      <button type="button" data-close aria-label="${t('Close')}" style="position:absolute;right:18px;top:16px;border:0;background:transparent;color:inherit;font-size:28px;line-height:1;cursor:pointer;">&times;</button>
      <div class="sheet-title" style="text-align:center;padding:4px 44px 0;">${t('Void Reading')}</div>
      <form class="add-form" data-form novalidate>
        <div class="add-scroll">
          <div class="view-util-block" style="margin-bottom:16px;">
            <div class="view-util-label">${t(reading.type === 'WASTEWATER' ? 'Wastewater' : reading.type === 'WATER' ? 'Water' : 'Electricity')} · ${t(reading.mode)}</div>
            <div class="view-util-line">${reading.value} ${escapeHtml(reading.unit || '')}</div>
          </div>
          <label class="add-section-title" for="voidReason">${t('Reason for voiding this reading')}</label>
          <textarea class="add-input" id="voidReason" rows="3" maxlength="250" placeholder="${t('Enter a reason')}" style="min-height:92px;resize:vertical;"></textarea>
          <div class="add-error" data-error hidden>${t('Please enter a reason')}</div>
        </div>
        <div class="util-dialog-actions">
          <button type="button" class="util-cancel-btn" data-cancel>${t('CANCEL')}</button>
          <button type="submit" class="util-save-btn" data-confirm>${t('VOID READING')}</button>
        </div>
      </form>`;
    document.getElementById('modalRoot').append(backdrop, sheet);
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
      sheet.querySelector('#voidReason').focus();
    });
    let finished = false;
    const close = value => {
      if (finished) return;
      finished = true;
      backdrop.classList.remove('is-open');
      sheet.classList.remove('is-open');
      setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
      resolve(value);
    };
    backdrop.addEventListener('click', () => close(null));
    sheet.querySelector('[data-close]').addEventListener('click', () => close(null));
    sheet.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    sheet.querySelector('[data-form]').addEventListener('submit', event => {
      event.preventDefault();
      const input = sheet.querySelector('#voidReason');
      const reason = input.value.trim();
      if (!reason) {
        sheet.querySelector('[data-error]').hidden = false;
        input.focus();
        return;
      }
      close(reason);
    });
  });
}

function openAddReadingFromView(berth) {
  showAddReadingDialog(berth, async (fields) => {
    const userId = store.userProfile?.userId || 0;
    await createUtilityReading(store.activeClientId, userId, fields);
    toast(tr('Reading saved'), { kind: 'success' });
  });
}

/* ============================================================
   EDIT BERTH
   ============================================================ */
function onEditBerth(berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const status = (berth.status || 'AVAILABLE').toUpperCase();

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${t("Edit Berth")}</div>

    <form id="editBerthForm" class="add-form" novalidate>
      <div class="add-scroll">
        <input class="add-input" id="eb-dockName"    type="text"   placeholder="${t("Dock Name *")}"    value="${escapeAttr(berth.dockName || '')}">
        <input class="add-input" id="eb-berthNumber" type="text"   placeholder="${t("Berth Number *")}" value="${escapeAttr(berth.berthNumber || '')}">
        <input class="add-input" id="eb-length"      type="number" step="0.1" placeholder="${t("Length (m)")}" value="${berth.length > 0 ? berth.length : ''}">
        <input class="add-input" id="eb-width"       type="number" step="0.1" placeholder="${t("Width (m)")}"  value="${berth.width  > 0 ? berth.width  : ''}">
        <input class="add-input" id="eb-depth"       type="number" step="0.1" placeholder="${t("Depth (m)")}"  value="${berth.depth  > 0 ? berth.depth  : ''}">

        <label class="add-checkbox" style="margin-top:16px;">
          <input type="checkbox" id="eb-electric" ${berth.hasElectric ? 'checked' : ''}>
          <span>${t("Has electricity")}</span>
        </label>

        <div id="eb-shorePower" class="berth-shore-power-fields" ${berth.hasElectric ? '' : 'hidden'}>
          <div class="add-section-title">${t("Shore power specification")}</div>
          <div class="berth-shore-power-grid">
            <label><span>${t("Amperage")}</span><select class="add-input add-select" id="eb-shorePowerAmps">
              ${shorePowerOptions([16, 32, 63, 125], berth.shorePowerAmps, 'A')}
            </select></label>
            <label><span>${t("Voltage")}</span><select class="add-input add-select" id="eb-shorePowerVoltage">
              ${shorePowerOptions([230, 400], berth.shorePowerVoltage, 'V')}
            </select></label>
            <label><span>${t("Phase")}</span><select class="add-input add-select" id="eb-shorePowerPhase">
              <option value="">${t("Not specified")}</option>
              <option value="SINGLE_PHASE" ${normalisePhase(berth.shorePowerPhase) === 'SINGLE_PHASE' ? 'selected' : ''}>${t("Single-phase")}</option>
              <option value="THREE_PHASE" ${normalisePhase(berth.shorePowerPhase) === 'THREE_PHASE' ? 'selected' : ''}>${t("Three-phase")}</option>
            </select></label>
            <label><span>${t("Connections")}</span><input class="add-input" id="eb-shorePowerConnections" type="number" min="1" step="1" value="${berth.shorePowerConnections ?? ''}" placeholder="${t("Not specified")}"></label>
          </div>
        </div>

        <label class="add-checkbox">
          <input type="checkbox" id="eb-water" ${berth.hasWater ? 'checked' : ''}>
          <span>${t("Has water")}</span>
        </label>

        <div class="add-section-title" style="margin-top:16px;">${t("Status")}</div>
        <select class="add-input add-select" id="eb-status">
          <option value="AVAILABLE"   ${status === 'AVAILABLE'   ? 'selected' : ''}>${t("AVAILABLE")}</option>
          <option value="OCCUPIED"    ${status === 'OCCUPIED'    ? 'selected' : ''}>${t("OCCUPIED")}</option>
          <option value="MAINTENANCE" ${status === 'MAINTENANCE' ? 'selected' : ''}>${t("MAINTENANCE")}</option>
        </select>
      </div>

      <button type="submit" class="add-save" id="eb-save">${t("Update Berth")}</button>
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
  const electric = sheet.querySelector('#eb-electric');
  const shorePower = sheet.querySelector('#eb-shorePower');
  electric.addEventListener('change', () => { shorePower.hidden = !electric.checked; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.disabled = true;
    save.textContent = tr('Updating¦');

    try {
      const fields = {
        dockName:     sheet.querySelector('#eb-dockName').value.trim(),
        berthNumber:  sheet.querySelector('#eb-berthNumber').value.trim(),
        length:       parseFloat(sheet.querySelector('#eb-length').value) || 0,
        width:        parseFloat(sheet.querySelector('#eb-width').value)  || 0,
        depth:        parseFloat(sheet.querySelector('#eb-depth').value)  || 0,
        hasElectric:  sheet.querySelector('#eb-electric').checked,
        hasWater:     sheet.querySelector('#eb-water').checked,
        shorePowerAmps: optionalPositiveInteger(sheet.querySelector('#eb-shorePowerAmps').value),
        shorePowerVoltage: optionalPositiveInteger(sheet.querySelector('#eb-shorePowerVoltage').value),
        shorePowerPhase: sheet.querySelector('#eb-shorePowerPhase').value || null,
        shorePowerConnections: optionalPositiveInteger(sheet.querySelector('#eb-shorePowerConnections').value),
        status:       sheet.querySelector('#eb-status').value
      };

      if (!fields.dockName || !fields.berthNumber) {
        throw new Error(tr('Dock name and berth number are required.'));
      }

      const userId = store.userProfile?.userId || 0;
      await updateBerth(berth.id, userId, fields);
      close();
      toast(tr(`Berth ${fields.berthNumber} updated`), { kind: 'success' });

    } catch (err) {
      console.error('[berth edit]', err);
      save.disabled = false;
      save.textContent = tr('Update Berth');
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

function shorePowerOptions(values, selected, unit) {
  const options = selected != null && !values.includes(Number(selected)) ? [Number(selected), ...values] : values;
  return `<option value="">${t('Not specified')}</option>` + options.map(value =>
    `<option value="${value}" ${Number(selected) === value ? 'selected' : ''}>${value}${unit}</option>`
  ).join('');
}

function optionalPositiveInteger(value) {
  if (value === '' || value == null) return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(tr('Shore power values must be positive whole numbers'));
  return number;
}

function normalisePhase(value) {
  return String(value || '').trim().toUpperCase().replace(/[- ]/g, '_');
}

function formatShorePower(source) {
  const values = [];
  if (source?.shorePowerAmps != null) values.push(`${source.shorePowerAmps}A`);
  if (source?.shorePowerVoltage != null) values.push(`${source.shorePowerVoltage}V`);
  if (source?.shorePowerPhase) values.push(normalisePhase(source.shorePowerPhase) === 'THREE_PHASE' ? t('Three-phase') : t('Single-phase'));
  if (source?.shorePowerConnections != null) values.push(`${source.shorePowerConnections} ${t(source.shorePowerConnections === 1 ? 'connection' : 'connections')}`);
  return values.length ? values.join(' · ') : t('Not specified');
}

async function onDeleteBerth(berth) {
  const ok = await confirmSheet({
    title:   'Delete berth',
    message: tr(`Delete berth ${berth.berthNumber}? This cannot be undone.`),
    confirmText: tr('Delete'),
    cancelText: tr('Cancel')
  });
  if (!ok) return;

  try {
    await deleteBerth(berth.id);
    toast(tr(`Berth ${berth.berthNumber} deleted`), { kind: 'success' });
  } catch (err) {
    console.error('[berth delete]', err);
    toast(tr('Failed to delete berth'), { kind: 'error' });
  }
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ============================================================
   ASSIGN / RELEASE BOAT
   ============================================================ */
async function onAssignBoat(berth) {
  const { getDocs, query, collection, where } = await import('../firebase.js');
  const { db } = await import('../firebase.js');

  try {
    const boatsSnap = await getDocs(
      query(collection(db, 'boats'), where('clientId', '==', store.activeClientId))
    );

    const allBoats = boatsSnap.docs.map(d => {
      const data = d.data();
      return {
        id:   Number(data.id ?? d.id),
        name: data.name || ''
      };
    });

    const assignedBoatIds = new Set(
      (store.berthsFull || [])
        .filter(b => b.boatId != null)
        .map(b => Number(b.boatId))
    );

    const unassigned = allBoats.filter(b => !assignedBoatIds.has(b.id));

    showAssignBoatSheet({
      berth,
      boats: unassigned,
      onAssign: async (boat) => {
        try {
          const userId = store.userProfile?.userId || 0;
          await assignBoatToBerth(berth.id, boat, userId);
          toast(tr(`${boat.name} assigned to berth ${berth.berthNumber}`), { kind: 'success' });
        } catch (err) {
          console.error('[assign boat]', err);
          toast(tr('Failed to assign boat'), { kind: 'error' });
        }
      }
    });

  } catch (err) {
    console.error('[assign boat] fetch failed', err);
    toast(tr('Failed to load boats'), { kind: 'error' });
  }
}

async function onReleaseBoat(berth) {
  const boatName = berth.assignedBoatName || 'boat';
  const ok = await confirmSheet({
    title:   'Release boat',
    message: tr(`Release ${boatName} from berth ${berth.berthNumber}?`),
    confirmText: tr('Release'),
    cancelText: tr('Cancel')
  });
  if (!ok) return;

  try {
    const userId = store.userProfile?.userId || 0;
    await releaseBoatFromBerth(berth.id, userId);
    toast(tr(`${boatName} released from berth ${berth.berthNumber}`), { kind: 'success' });
  } catch (err) {
    console.error('[release boat]', err);
    toast(tr('Failed to release boat'), { kind: 'error' });
  }
}

/* ============================================================
   TARIFFS
   ============================================================ */
async function openTariffsSheet(berth) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet billing-sheet';

  const clientId = Number(store.activeClientId);
  let currency;
  try { currency = await marinaCurrency(clientId); }
  catch (error) { toast(error.message, { kind: 'error' }); return; }
  const now = Date.now();
  let elecTariff = null;
  let waterTariff = null;
  let wastewaterTariff = null;

  try {
    elecTariff = await getActiveTariff(clientId, 'ELECTRICITY');
    waterTariff = await getActiveTariff(clientId, 'WATER');
    wastewaterTariff = await getActiveTariff(clientId, 'WASTEWATER');
  } catch (err) {
    console.error('[tariffs] load failed', err);
    toast(err.message || 'Unable to load utility rates', { kind: 'error' });
    return;
  }

  const elecPrice = elecTariff?.pricePerUnit || 0;
  const waterIncluded = waterTariff?.pricingMode === 'INCLUDED';
  const waterPrice = (waterTariff?.pricePerUnit || 0) / (['M3', 'M³'].includes(String(waterTariff?.unit || '').toUpperCase()) ? 1000 : 1);
  const wastewaterMode = wastewaterTariff?.pricingMode || '';
  const wastewaterPrice = (wastewaterTariff?.pricePerUnit || 0) / (['M3', 'M³'].includes(String(wastewaterTariff?.unit || '').toUpperCase()) ? 1000 : 1);

  checkBillingClient(clientId);
  const today = new Date().toISOString().slice(0, 10);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${t("Utility Rates")} · ${currency}</div>

    <form id="tariffsForm" class="add-form" novalidate>
      <div class="add-scroll">

        <div class="add-section-title">${t("Electricity")}</div>
        <input class="add-input" id="tf-elecPrice" type="number" step="0.01"
               placeholder="${t("Price per kWh")} (${currency})" value="${elecTariff && savedCurrency(elecTariff.currency) === currency ? elecPrice : ''}">
        <input class="add-input" id="tf-elecDate" type="date" value="${today}">
        <div class="add-section-sub">${t("Effective from")}</div>
        <div class="add-section-sub">${elecTariff ? (elecTariff.pricingMode === 'INCLUDED' ? t('Current rate: Included') : `${t('Current rate')}: ${savedCurrency(elecTariff.currency)} ${elecPrice.toFixed(4)}/kWh`) : t('Current rate: Not set')}</div>

        <div class="add-section-title" style="margin-top:20px;">${t("Water")}</div>
        <select class="add-input add-select" id="tf-waterMode">
          <option value="METERED"  ${!waterIncluded ? 'selected' : ''}>${t("Metered")}</option>
          <option value="INCLUDED" ${waterIncluded  ? 'selected' : ''}>${t("Included")}</option>
        </select>
        <input class="add-input" id="tf-waterPrice" type="number" step="0.0001"
               placeholder="${t("Price per L")} (${currency})" value="${waterTariff && savedCurrency(waterTariff.currency) === currency ? waterPrice : ''}"
               ${waterIncluded ? 'disabled' : ''}>
        <input class="add-input" id="tf-waterDate" type="date" value="${today}">
        <div class="add-section-sub">${t("Effective from")}</div>
        <div class="add-section-sub">${waterTariff ? (waterTariff.pricingMode === 'INCLUDED' ? t('Current rate: Included') : `${t('Current rate')}: ${savedCurrency(waterTariff.currency)} ${waterPrice.toFixed(4)}/L`) : t('Current rate: Not set')}</div>

        <div class="add-section-title" style="margin-top:20px;">${t("Wastewater")}</div>
        <select class="add-input add-select" id="tf-wastewaterMode">
          ${!wastewaterTariff ? `<option value="" selected>${t("Not set")}</option>` : ''}
          <option value="METERED" ${wastewaterMode === 'METERED' ? 'selected' : ''}>${t("Metered")}</option>
          <option value="INCLUDED" ${wastewaterMode === 'INCLUDED' ? 'selected' : ''}>${t("Included")}</option>
        </select>
        <input class="add-input" id="tf-wastewaterPrice" type="number" min="0" step="0.0001"
               placeholder="${t("Price per L")} (${currency})" value="${wastewaterTariff && savedCurrency(wastewaterTariff.currency) === currency ? wastewaterPrice : ''}"
               ${wastewaterMode !== 'METERED' ? 'disabled' : ''}>
        <input class="add-input" id="tf-wastewaterDate" type="date" value="${today}">
        <div class="add-section-sub">${t("Effective from")}</div>
        <div class="add-section-sub">${wastewaterTariff ? (wastewaterTariff.pricingMode === 'INCLUDED' ? t('Current rate: Included') : `${t('Current rate')}: ${savedCurrency(wastewaterTariff.currency)} ${wastewaterPrice.toFixed(4)}/L`) : t('Current rate: Not set')}</div>

      </div>

      <button type="submit" class="add-save" id="tf-save">${t("Save Rates")} (${currency})</button>
    </form>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const calendars = [
    ['tf-elecDate', 'Electricity effective from'],
    ['tf-waterDate', 'Water effective from'],
    ['tf-wastewaterDate', 'Wastewater effective from']
  ].map(([id, label]) => wireBookingDatePicker(sheet.querySelector('#' + id), {
    label: tr(label), locale: uiLocale()
  }));

  const close = () => {
    calendars.forEach(calendar => calendar.close());
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);

  const modeEl = sheet.querySelector('#tf-waterMode');
  const waterPriceEl = sheet.querySelector('#tf-waterPrice');

  modeEl.addEventListener('change', () => {
    const included = modeEl.value === 'INCLUDED';
    waterPriceEl.disabled = included;
    if (included) waterPriceEl.value = '0.00';
  });

  const wastewaterModeEl = sheet.querySelector('#tf-wastewaterMode');
  const wastewaterPriceEl = sheet.querySelector('#tf-wastewaterPrice');
  wastewaterModeEl.addEventListener('change', () => {
    wastewaterPriceEl.disabled = wastewaterModeEl.value !== 'METERED';
    if (wastewaterModeEl.value === 'INCLUDED') wastewaterPriceEl.value = '0';
  });

  const form = sheet.querySelector('#tariffsForm');
  const save = sheet.querySelector('#tf-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    save.disabled = true;
    save.textContent = tr('Saving¦');

    try {
      checkBillingClient(clientId);
      const elecVal = parseFloat(sheet.querySelector('#tf-elecPrice').value);
      if (!Number.isFinite(elecVal) || elecVal < 0) throw new Error(tr('Enter electricity price'));

      const waterMode = modeEl.value;
      let waterVal = 0;
      if (waterMode === 'METERED') {
        waterVal = parseFloat(waterPriceEl.value);
        if (!Number.isFinite(waterVal) || waterVal < 0) throw new Error(tr('Enter water price'));
      }

      const wastewaterPricingMode = wastewaterModeEl.value;
      const wastewaterVal = wastewaterPricingMode === 'METERED' ? parseFloat(wastewaterPriceEl.value) : 0;
      if (wastewaterPricingMode === 'METERED' && (!Number.isFinite(wastewaterVal) || wastewaterVal < 0))
        throw new Error(tr('Enter wastewater price'));
      const wastewaterDate = new Date(sheet.querySelector('#tf-wastewaterDate').value).getTime() || Date.now();

      const elecDate = new Date(sheet.querySelector('#tf-elecDate').value).getTime() || Date.now();
      const waterDate = new Date(sheet.querySelector('#tf-waterDate').value).getTime() || Date.now();

      const userId = store.userProfile?.userId || 0;

      await saveTariff(clientId, userId, {
        currency,
        utilityType: 'ELECTRICITY',
        unit: 'kWh',
        pricingMode: 'METERED',
        pricePerUnit: elecVal,
        effectiveFrom: elecDate
      });

      await saveTariff(clientId, userId, {
        currency,
        utilityType: 'WATER',
        unit: 'L',
        pricingMode: waterMode,
        pricePerUnit: waterVal,
        effectiveFrom: waterDate
      });

      if (wastewaterPricingMode) {
        await saveTariff(clientId, userId, {
        currency,
          utilityType: 'WASTEWATER', unit: 'L', pricingMode: wastewaterPricingMode,
          pricePerUnit: wastewaterVal, effectiveFrom: wastewaterDate
        });
      }

      // Bust the tariff cache so View Berth reloads fresh
      if (store._tariffCache) delete store._tariffCache;

      close();
      toast(tr('Rates saved'), { kind: 'success' });

    } catch (err) {
      console.error('[tariffs] save failed', err);
      save.disabled = false;
      save.textContent = tr('Save Rates');
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to save rates.';
    }
  });
}
