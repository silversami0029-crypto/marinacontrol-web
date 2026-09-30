// js/screens/ReportsScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showReportsHelp } from './ReportsHelp.js';
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

// jsPDF is loaded lazily when the user exports — see exportReport()

const TABS = ['Unpaid', 'Expiring', 'Occupancy', 'Revenue'];
let currentTab = 0;
let invoicesCache = [];
let documentsCache = [];
let berthsCache = [];
let boatsCache = {};
let revenueFilters = { category: 'ALL', dateRange: 'ALL' };

/* ============================================================ */

export async function mountReportsScreen() {
  
  const screen = document.getElementById('screen');
  screen.classList.add('rp-screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  currentTab = Number(params.get('tab') || 0);
  if (currentTab < 0 || currentTab > 3) currentTab = 0;

  screen.innerHTML = `
    <div class="rp-header" id="rpHeader">
      <div class="rp-header-row">
        <button class="rp-icon-btn" id="rpBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="rp-pill">Reports</div>
        <button class="rp-icon-btn" id="rpHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="rp-header-spacer"></div>
      </div>
    </div>

    <div class="rp-tabs" id="rpTabs">
      ${TABS.map((label, i) => `
        <button type="button" class="rp-tab${i === currentTab ? ' is-active' : ''}" data-rp-tab="${i}">${label}</button>
      `).join('')}
    </div>

    <div class="rp-body" id="rpBody">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;
  requestAnimationFrame(() => {
    const tabs = document.querySelector('.rp-tabs');
    const activeTab = document.querySelector('.rp-tab.is-active');
    if (tabs && activeTab) {
      // Only scroll the tab strip horizontally, never the page
      const left = activeTab.offsetLeft - (tabs.clientWidth / 2) + (activeTab.clientWidth / 2);
      tabs.scrollTo({ left, behavior: 'smooth' });
    }
  });

   /* back arrow*/

 document.getElementById('rpBack')?.addEventListener('click', () => history.back());

  document.getElementById('rpHelp').addEventListener('click', showReportsHelp);

  screen.querySelectorAll('[data-rp-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = Number(btn.dataset.rpTab);
      screen.querySelectorAll('[data-rp-tab]').forEach(b =>
        b.classList.toggle('is-active', Number(b.dataset.rpTab) === currentTab)
      );
      location.hash = `#/reports?tab=${currentTab}`;
      renderTab();
    });
  });

  await loadAll();
  renderTab();
}

async function loadAll() {
  const clientId = Number(store.activeClientId);
  if (!clientId) return;

  try {
    const [invSnap, docSnap, berthSnap, boatSnap] = await Promise.all([
      getDocs(query(collection(db, 'invoices'),   where('clientId', '==', clientId))),
      getDocs(query(collection(db, 'documents'),  where('clientId', '==', clientId))),
      getDocs(query(collection(db, 'berths'),     where('clientId', '==', clientId))),
      getDocs(query(collection(db, 'boats'),      where('clientId', '==', clientId)))
    ]);

    invoicesCache = invSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    documentsCache = docSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    berthsCache = berthSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    boatsCache = {};
    boatSnap.forEach(d => {
      const data = d.data();
      const id = Number(data.id || 0);
      if (id) boatsCache[id] = data.name || 'Unknown boat';
    });
  } catch (err) {
    console.error('[reports] load failed', err);
  }
}

function renderTab() {
  if (currentTab === 0) return renderUnpaid();
  if (currentTab === 1) return renderExpiring();
  if (currentTab === 2) return renderOccupancy();
  if (currentTab === 3) return renderRevenue();
}

/* ============================================================
   TAB 0 — UNPAID INVOICES
   ============================================================ */
function renderUnpaid() {
  const body = document.getElementById('rpBody');
  if (!body) return;

  const unpaid = invoicesCache.filter(inv =>
    String(inv.status || '').toUpperCase() !== 'PAID'
  );

  const total = unpaid.reduce((s, inv) => s + Number(inv.amount || 0), 0);
  const overdue = unpaid.filter(inv => String(inv.status || '').toUpperCase() === 'OVERDUE');
  const pending = unpaid.filter(inv => String(inv.status || '').toUpperCase() === 'PENDING');

  const overdueAmt = overdue.reduce((s, inv) => s + Number(inv.amount || 0), 0);
  const pendingAmt = pending.reduce((s, inv) => s + Number(inv.amount || 0), 0);

  // Group by boat
  const byBoat = {};
  for (const inv of unpaid) {
    const bn = inv.boatName || 'Unknown boat';
    if (!byBoat[bn]) byBoat[bn] = { count: 0, total: 0, overdue: 0 };
    byBoat[bn].count++;
    byBoat[bn].total += Number(inv.amount || 0);
    if (String(inv.status || '').toUpperCase() === 'OVERDUE') byBoat[bn].overdue++;
  }

  body.innerHTML = `
    <div class="rp-summary">
      <div class="rp-summary-row">
        <div class="rp-summary-label">Total Outstanding</div>
        <button class="rp-info-icon" id="rpHelpIcon" aria-label="Help">ⓘ</button>
      </div>
      <div class="rp-summary-value">${fmtMoney(total)}</div>
    </div>

    ${unpaid.length ? `
      <div class="rp-section-title">By Status</div>
      ${overdue.length ? `
        <div class="rp-status-row">
          <span class="rp-status-dot" style="background:#FF4444;"></span>
          <span class="rp-status-label">Overdue</span>
          <span class="rp-status-count">${overdue.length} ${overdue.length === 1 ? 'invoice' : 'invoices'}</span>
          <span class="rp-status-amount" style="color:#FF4444;">${fmtMoney(overdueAmt)}</span>
        </div>
      ` : ''}
      ${pending.length ? `
        <div class="rp-status-row">
          <span class="rp-status-dot" style="background:#FF9800;"></span>
          <span class="rp-status-label">Pending</span>
          <span class="rp-status-count">${pending.length} ${pending.length === 1 ? 'invoice' : 'invoices'}</span>
          <span class="rp-status-amount" style="color:#FF9800;">${fmtMoney(pendingAmt)}</span>
        </div>
      ` : ''}

      <div class="rp-section-title">By Boat</div>
      ${Object.entries(byBoat).map(([boat, s]) => `
        <div class="rp-boat-row">
          <div class="rp-boat-name">${escapeHtml(boat)}</div>
          <div class="rp-boat-summary">${s.count} ${s.count === 1 ? 'invoice' : 'invoices'} — ${fmtMoney(s.total)}${s.overdue ? ` (${s.overdue} overdue)` : ''}</div>
        </div>
      `).join('')}

      <div class="rp-section-title">Details</div>
      ${unpaid.map(inv => {
        const isOverdue = String(inv.status || '').toUpperCase() === 'OVERDUE';
        return `
          <div class="rp-detail-row">
            <div class="rp-detail-emoji">${isOverdue ? '🔴' : '🟡'}</div>
            <div class="rp-detail-info">
              <div class="rp-detail-title">${escapeHtml(inv.boatName || 'Unknown boat')}</div>
              <div class="rp-detail-desc">${escapeHtml(inv.description || '')} – Due: ${escapeHtml(fmtDate(inv.dueDate))}</div>
            </div>
            <div class="rp-detail-value">${fmtMoney(inv.amount)}</div>
          </div>
        `;
      }).join('')}
      ` : `<div class="rp-empty">No outstanding invoices</div>`}

    <button type="button" class="rp-export-btn" id="rpExport">📄 Export PDF</button>
  `;

  const helpIcon = body.querySelector('#rpHelpIcon');
  if (helpIcon) helpIcon.addEventListener('click', showReportsHelp);
  body.querySelector('#rpExport')?.addEventListener('click', () => exportReport(0));
}

/* ============================================================
   TAB 1 — EXPIRING DOCUMENTS
   ============================================================ */
function renderExpiring() {
  const body = document.getElementById('rpBody');
  if (!body) return;

  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000;

  const expiring = documentsCache.filter(d => {
    const e = toMs(d.expiryDate);
    return e > 0 && e <= cutoff;
  });

  const typeCounts = {};
  const byBoat = {};
  for (const d of expiring) {
    const type = d.type || 'Other';
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    const boatName = boatsCache[Number(d.boatId)] || 'Unknown boat';
    if (!byBoat[boatName]) byBoat[boatName] = [];
    byBoat[boatName].push(d);
  }

  body.innerHTML = `
    <div class="rp-summary">
      <div class="rp-summary-row">
        <div class="rp-summary-label">Total Expiring</div>
        <button class="rp-info-icon" id="rpHelpIcon" aria-label="Help">ⓘ</button>
      </div>
      <div class="rp-summary-value">${expiring.length}</div>
    </div>

    ${expiring.length ? `
      <div class="rp-section-title">By Type</div>
      ${Object.entries(typeCounts).map(([type, n]) => `
        <div class="rp-status-row">
          <span class="rp-status-label">${escapeHtml(type)}</span>
          <span class="rp-status-count">${n} expiring</span>
        </div>
      `).join('')}

      <div class="rp-section-title">By Boat</div>
      ${Object.entries(byBoat).map(([boat, docs]) => `
        <div class="rp-boat-row">
          <div class="rp-boat-name">${escapeHtml(boat)}</div>
          <div class="rp-boat-summary">
            ${docs.map(d => `• ${escapeHtml(d.name || '')} (${escapeHtml(d.type || '')})`).join('<br>')}
          </div>
        </div>
      `).join('')}

      <div class="rp-section-title">Details</div>
      ${expiring.map(d => {
        const e = toMs(d.expiryDate);
        const expired = e < now;
        return `
          <div class="rp-detail-row">
            <div class="rp-detail-emoji">${expired ? '🔴' : '🟡'}</div>
            <div class="rp-detail-info">
              <div class="rp-detail-title">${escapeHtml(boatsCache[Number(d.boatId)] || 'Unknown boat')}</div>
              <div class="rp-detail-desc">${escapeHtml(d.name || '')} (${escapeHtml(d.type || '')})</div>
            </div>
            <div class="rp-detail-value">Expires ${escapeHtml(fmtDate(e))}</div>
          </div>
        `;
      }).join('')}

    ` : ''}

    <button type="button" class="rp-export-btn" id="rpExport">
      📄 Export PDF
    </button>
  `;

  const helpIcon = body.querySelector('#rpHelpIcon');
  if (helpIcon) {
    helpIcon.addEventListener('click', showReportsHelp);
  }

  body.querySelector('#rpExport')?.addEventListener('click', () => {
    exportReport(1);
  });
}

/* ============================================================
   TAB 2 — OCCUPANCY
   ============================================================ */
function renderOccupancy() {
  const body = document.getElementById('rpBody');
  if (!body) return;

  const now = Date.now();
  let occupied = 0, available = 0, maintenance = 0;
  const durations = [];

  for (const berth of berthsCache) {
    const s = String(berth.status || '').toUpperCase();
    if (s === 'OCCUPIED') {
      occupied++;
      if (berth.assignedDate) {
        const end = berth.expectedEndDate ? Number(berth.expectedEndDate) : now;
        durations.push(Math.floor((end - Number(berth.assignedDate)) / (24 * 60 * 60 * 1000)));
      }
    } else if (s === 'MAINTENANCE') maintenance++;
    else available++;
  }

  const total = berthsCache.length;
  const rate = total > 0 ? (occupied * 100 / total) : 0;
  const avgStay = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const occupiedBerths = berthsCache.filter(b => String(b.status || '').toUpperCase() === 'OCCUPIED');

  body.innerHTML = `
    <div class="rp-summary">
      <div class="rp-summary-row">
        <div class="rp-summary-label">Occupancy Rate</div>
        <button class="rp-info-icon" id="rpHelpIcon" aria-label="Help">ⓘ</button>
      </div>
      <div class="rp-summary-value">${rate.toFixed(1)}%</div>
    </div>

    <div class="rp-section-title">By Status</div>
    <div class="rp-status-row">
      <span class="rp-status-label">Total Berths</span>
      <span class="rp-status-amount">${total}</span>
    </div>
    <div class="rp-status-row">
      <span class="rp-status-label">Occupied</span>
      <span class="rp-status-amount" style="color:#FF4444;">${occupied}</span>
    </div>
    <div class="rp-status-row">
      <span class="rp-status-label">Available</span>
      <span class="rp-status-amount" style="color:#3DD68C;">${available}</span>
    </div>
    <div class="rp-status-row">
      <span class="rp-status-label">Maintenance</span>
      <span class="rp-status-amount" style="color:#FF9800;">${maintenance}</span>
    </div>
    <div class="rp-status-row">
      <span class="rp-status-label">Avg Stay</span>
      <span class="rp-status-amount">${avgStay.toFixed(1)} days</span>
    </div>

    ${occupiedBerths.length ? `
      <div class="rp-section-title">Occupied Berths</div>
      ${occupiedBerths.map(b => {
        const boatName = b.boatId ? (boatsCache[Number(b.boatId)] || 'Unknown') : 'Unknown';
        const since = b.assignedDate ? ` since ${fmtDate(b.assignedDate)}` : '';
        return `
          <div class="rp-detail-row">
            <div class="rp-detail-emoji">🟢</div>
            <div class="rp-detail-info">
              <div class="rp-detail-title">${escapeHtml(b.berthNumber || '')}</div>
              <div class="rp-detail-desc">${escapeHtml(boatName)}${escapeHtml(since)}</div>
            </div>
            <div class="rp-detail-value">Occupied</div>
          </div>
        `;
      }).join('')}
       ` : ''}

    <button type="button" class="rp-export-btn" id="rpExport">
      📄 Export PDF
    </button>
  `;
}

/* ============================================================
   TAB 3 — REVENUE
   ============================================================ */
function renderRevenue() {
  const body = document.getElementById('rpBody');
  if (!body) return;

  const paid = invoicesCache.filter(inv =>
    String(inv.status || '').toUpperCase() === 'PAID'
  );

  // Category filter
  const afterCategory = revenueFilters.category === 'ALL'
    ? paid
    : paid.filter(inv => String(inv.category || 'GENERAL').toUpperCase() === revenueFilters.category);

  // Date filter
  const now = Date.now();
  const ranges = {
    ALL:         [0, now],
    THIS_MONTH:  [startOfMonth(now), now],
    LAST_MONTH:  [startOfMonth(addMonths(now, -1)), endOfMonth(addMonths(now, -1))],
    THIS_YEAR:   [startOfYear(now), now],
    LAST_30:     [now - 30 * 24 * 60 * 60 * 1000, now]
  };
  const [from, to] = ranges[revenueFilters.dateRange] || ranges.ALL;

  const filtered = afterCategory.filter(inv => {
    const d = Number(inv.dueDate || inv.issueDate || 0);
    return d >= from && d <= to;
  });

  const total = filtered.reduce((s, inv) => s + Number(inv.amount || 0), 0);
  const avg = filtered.length ? total / filtered.length : 0;

  const byBoat = {};
  for (const inv of filtered) {
    const bn = inv.boatName || 'Unknown boat';
    byBoat[bn] = (byBoat[bn] || 0) + Number(inv.amount || 0);
  }

  const sortedBoats = Object.entries(byBoat).sort((a, b) => b[1] - a[1]);

  body.innerHTML = `
    <div class="rp-filters">
      <select class="rp-filter-select" id="rpCatFilter">
        <option value="ALL"${revenueFilters.category === 'ALL' ? ' selected' : ''}>All Categories</option>
        <option value="BERTH"${revenueFilters.category === 'BERTH' ? ' selected' : ''}>Berth</option>
        <option value="MAINTENANCE"${revenueFilters.category === 'MAINTENANCE' ? ' selected' : ''}>Maintenance</option>
        <option value="EQUIPMENT"${revenueFilters.category === 'EQUIPMENT' ? ' selected' : ''}>Equipment</option>
        <option value="CREW"${revenueFilters.category === 'CREW' ? ' selected' : ''}>Crew</option>
        <option value="GENERAL"${revenueFilters.category === 'GENERAL' ? ' selected' : ''}>General</option>
      </select>
      <select class="rp-filter-select" id="rpDateFilter">
        <option value="ALL"${revenueFilters.dateRange === 'ALL' ? ' selected' : ''}>All Time</option>
        <option value="THIS_MONTH"${revenueFilters.dateRange === 'THIS_MONTH' ? ' selected' : ''}>This Month</option>
        <option value="LAST_MONTH"${revenueFilters.dateRange === 'LAST_MONTH' ? ' selected' : ''}>Last Month</option>
        <option value="THIS_YEAR"${revenueFilters.dateRange === 'THIS_YEAR' ? ' selected' : ''}>This Year</option>
        <option value="LAST_30"${revenueFilters.dateRange === 'LAST_30' ? ' selected' : ''}>Last 30 Days</option>
      </select>
    </div>

    <div class="rp-summary">
      <div class="rp-summary-row">
        <div class="rp-summary-label">Total Revenue</div>
        <button class="rp-info-icon" id="rpHelpIcon" aria-label="Help">ⓘ</button>
      </div>
      <div class="rp-summary-value">${fmtMoney(total)}</div>
    </div>

    ${filtered.length ? `
      <div class="rp-section-title">By Status</div>
      <div class="rp-status-row">
        <span class="rp-status-emoji">📊</span>
        <span class="rp-status-label">${filtered.length} ${filtered.length === 1 ? 'invoice' : 'invoices'} · Avg ${fmtMoney(avg)}</span>
      </div>

      <div class="rp-section-title">By Boat</div>
      ${sortedBoats.map(([boat, amt]) => `
        <div class="rp-boat-row">
          <div class="rp-boat-name">${escapeHtml(boat)}</div>
          <div class="rp-boat-summary">${fmtMoney(amt)}</div>
        </div>
      `).join('')}

      <div class="rp-section-title">Details</div>
      ${sortedBoats.map(([boat, amt]) => `
        <div class="rp-detail-row">
          <div class="rp-detail-emoji">💰</div>
          <div class="rp-detail-info">
            <div class="rp-detail-title">${escapeHtml(boat)}</div>
            <div class="rp-detail-desc">Total paid</div>
          </div>
          <div class="rp-detail-value">${fmtMoney(amt)}</div>
        </div>
      `).join('')}


    ` : `<div class="rp-empty">No revenue for this filter</div>`}

    <button type="button" class="rp-export-btn" id="rpExport">📄 Export PDF</button>
  `;

  const helpIcon = body.querySelector('#rpHelpIcon');
  if (helpIcon) helpIcon.addEventListener('click', showReportsHelp);
  body.querySelector('#rpExport')?.addEventListener('click', () => exportReport(3));

  body.querySelector('#rpCatFilter')?.addEventListener('change', (e) => {

    revenueFilters.category = e.target.value;
    renderRevenue();
  });
  body.querySelector('#rpDateFilter')?.addEventListener('change', (e) => {
    revenueFilters.dateRange = e.target.value;
    renderRevenue();
  });
}

/* ============================================================
   Helpers
   ============================================================ */
function fmtMoney(n) {
  return '£' + Number(n || 0).toFixed(2);
}

function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function startOfMonth(ms) {
  const d = new Date(ms);
  d.setDate(1); d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function endOfMonth(ms) {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + 1, 0); d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function startOfYear(ms) {
  const d = new Date(ms);
  d.setMonth(0, 1); d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function addMonths(ms, n) {
  const d = new Date(ms);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function exportReport(tab) {
  if (!window.jspdf?.jsPDF) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load jsPDF'));
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const titles = ['Unpaid Invoices', 'Expiring Documents', 'Occupancy', 'Revenue'];
  const title = titles[tab] || 'Report';
  const generated = new Date().toLocaleString('en-GB');

  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.text(`Generated: ${generated}`, 14, 28);

  let y = 42;
  doc.setFontSize(11);

  const rows = getDetailRows(tab);
  rows.forEach(row => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`• ${row.left}`, 14, y);
    y += 5;
    doc.setFontSize(9);
    doc.text(row.mid || '', 20, y);
    if (row.right) doc.text(String(row.right), 150, y);
    y += 8;
    doc.setFontSize(11);
  });

  doc.save(`report-${tab}-${Date.now()}.pdf`);
  toast('Report exported', { kind: 'success' });
}

function getDetailRows(tab) {
  const rows = [];

  if (tab === 0) {
    const unpaid = invoicesCache.filter(inv => String(inv.status || '').toUpperCase() !== 'PAID');
    unpaid.forEach(inv => {
      rows.push({
        left: inv.boatName || 'Unknown boat',
        mid: `${inv.description || ''} – Due: ${fmtDate(inv.dueDate)}`,
        right: fmtMoney(inv.amount)
      });
    });
  } else if (tab === 1) {
    const now = Date.now();
    const cutoff = now + 30 * 24 * 60 * 60 * 1000;
    const expiring = documentsCache.filter(d => {
      const e = toMs(d.expiryDate);
      return e > 0 && e <= cutoff;
    });
    expiring.forEach(d => {
      rows.push({
        left: boatsCache[Number(d.boatId)] || 'Unknown boat',
        mid: `${d.name || ''} (${d.type || ''})`,
        right: `Expires ${fmtDate(toMs(d.expiryDate))}`
      });
    });
  } else if (tab === 2) {
    const occupied = berthsCache.filter(b => String(b.status || '').toUpperCase() === 'OCCUPIED');
    occupied.forEach(b => {
      rows.push({
        left: b.berthNumber || '',
        mid: b.boatId ? (boatsCache[Number(b.boatId)] || 'Unknown') : 'Unknown',
        right: 'Occupied'
      });
    });
  } else if (tab === 3) {
    const paid = invoicesCache.filter(inv => String(inv.status || '').toUpperCase() === 'PAID');
    const byBoat = {};
    for (const inv of paid) {
      const bn = inv.boatName || 'Unknown boat';
      byBoat[bn] = (byBoat[bn] || 0) + Number(inv.amount || 0);
    }
    Object.entries(byBoat).forEach(([boat, amt]) => {
      rows.push({ left: boat, mid: 'Total paid', right: fmtMoney(amt) });
    });
  }

  return rows;
}