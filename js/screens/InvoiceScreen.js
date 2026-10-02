import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/InvoiceScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showInvoiceDetail } from './InvoiceDetailSheet.js';
import { showInvoicePaymentSheet } from './InvoicePaymentSheet.js';
import {
  collection, query, where, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const STATUSES = ['All', 'PAID', 'PENDING', 'OVERDUE'];

const STATUS_COLORS = {
  PAID: '#4CAF50',
  PENDING: '#FF9800',
  OVERDUE: '#F44336'
};

const CATEGORY_LABELS = {
  BERTH: 'Berth',
  MAINTENANCE: 'Maintenance',
  EQUIPMENT: 'Equipment',
  CREW: 'Crew',
  UTILITIES: 'Utilities',
  GENERAL: 'General'
};

let unsubscribe = null;
let currentItems = [];
let selectedStatus = 'All';
let selectedYear = -1;
let selectedMonth = -1;
let isSearchOpen = false;

export function mountInvoiceScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlCustomerId = Number(params.get('customerId') || 0);

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  selectedStatus = 'All';
  selectedYear = -1;
  selectedMonth = -1;
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="eq-header" id="ivHeader">
      <div class="eq-header-row">
        <button class="eq-icon-btn" id="ivBack" aria-label="${tr("Back")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="eq-pill">${tr("Invoices")}</div>
    
        <div class="eq-header-spacer"></div>
        <button class="eq-icon-btn" id="ivSearchToggle" aria-label="${tr("Search")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="ivSearchBar" hidden>
      <input id="ivSearchInput" type="text" placeholder="${tr("Search invoices...")}" autocomplete="off">
      <button type="button" class="search-cancel" id="ivSearchCancel">${tr("Cancel")}</button>
    </div>

    <div class="iv-summary" id="ivSummary">
      <div class="iv-summary-col">
        <div class="iv-summary-label">${tr("Total")}</div>
        <div class="iv-summary-value" id="ivTotal">£0.00</div>
      </div>
      <div class="iv-summary-divider"></div>
      <div class="iv-summary-col">
        <div class="iv-summary-label">${tr("Outstanding")}</div>
        <div class="iv-summary-value iv-outstanding" id="ivOutstanding">£0.00</div>
      </div>
      <div class="iv-summary-divider"></div>
      <div class="iv-summary-col">
        <div class="iv-summary-label">${tr("Paid")}</div>
        <div class="iv-summary-value iv-paid" id="ivPaid">£0.00</div>
      </div>
    </div>

    <div class="iv-filters" id="ivFilters">
      <button type="button" class="iv-month-btn" id="ivMonthBtn">${tr("Select month")}</button>
      <select class="iv-status-select" id="ivStatusSelect">
        ${STATUSES.map(s => `<option value="${s}">${escapeHtml(tr(s === 'All' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()))}</option>`).join('')}
      </select>
    </div>

    <div class="eq-list" id="ivList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="ivFabAdd" aria-label="${tr("Add invoice")}">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;



  /* back arrow*/

 document.getElementById('ivBack')?.addEventListener('click', () => history.back());



  document.getElementById('ivSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('ivHeader').hidden = true;
    document.getElementById('ivSearchBar').hidden = false;
    document.getElementById('ivSearchInput').focus();
  });

  document.getElementById('ivSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('ivSearchBar').hidden = true;
    document.getElementById('ivHeader').hidden = false;
    document.getElementById('ivSearchInput').value = '';
    renderList();
  });

  document.getElementById('ivSearchInput').addEventListener('input', renderList);

  document.getElementById('ivStatusSelect').addEventListener('change', (e) => {
    selectedStatus = e.target.value;
    renderList();
  });

  document.getElementById('ivMonthBtn').addEventListener('click', showMonthPicker);

  document.getElementById('ivFabAdd').addEventListener('click', async () => {
    const m = await import('./AddInvoiceSheet.js');
    m.showAddInvoiceSheet({ customerId: urlCustomerId || 0 });
  });

  subscribeToInvoices(urlCustomerId);
}

async function showMonthPicker() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${tr("Select Month")}</div>

    <div class="iv-month-picker" id="ivMonthPicker">
      ${years.map(y => `
        <div class="iv-month-year-label">${y}</div>
        <div class="iv-month-grid">
          ${months.map((m, i) => `
            <button type="button" class="iv-month-cell${selectedYear === y && selectedMonth === i ? ' is-active' : ''}"
                    data-year="${y}" data-month="${i}">${tr(m)}</button>
          `).join('')}
        </div>
      `).join('')}
    </div>

    <div class="ao-actions" style="margin-top:16px;">
      <button type="button" class="csv-btn csv-btn--cancel" id="ivMonthClear">${tr("Clear")}</button>
      <button type="button" class="csv-btn csv-btn--cancel" id="ivMonthClose">${tr("Close")}</button>
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

  sheet.querySelectorAll('.iv-month-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedYear = Number(cell.dataset.year);
      selectedMonth = Number(cell.dataset.month);
      const label = `${tr(months[selectedMonth])} ${selectedYear}`;
      document.getElementById('ivMonthBtn').textContent = label;
      document.getElementById('ivMonthBtn').classList.add('is-active');
      close();
      renderList();
    });
  });

  sheet.querySelector('#ivMonthClear').addEventListener('click', () => {
    selectedYear = -1;
    selectedMonth = -1;
    document.getElementById('ivMonthBtn').textContent = tr('Select month');
    document.getElementById('ivMonthBtn').classList.remove('is-active');
    close();
    renderList();
  });

  sheet.querySelector('#ivMonthClose').addEventListener('click', close);
}

function subscribeToInvoices(urlCustomerId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('ivList').innerHTML =
      `<div class="boats-empty"><h2>${tr("No client assigned")}</h2></div>`;
    return;
  }

  const q = query(
    collection(db, 'invoices'),
    where('clientId', '==', clientId)
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentItems = snap.docs
      .map(d => {
        const data = d.data();
        return {
          _docId: d.id,
          id: Number(data.id || 0),
          clientId: Number(data.clientId || 0),
          customerId: Number(data.customerId || 0),
          boatId: Number(data.boatId || 0),
          boatName: data.boatName || '',
          clientName: data.clientName || '',
          invoiceNumber: data.invoiceNumber || '',
          description: data.description || '',
          category: data.category || 'GENERAL',
          issueDate: Number(data.issueDate || 0),
          dueDate: Number(data.dueDate || 0),
          amount: Number(data.amount || 0),
          status: (data.status || 'PENDING').toUpperCase()
        };
      })
      .filter(inv => !urlCustomerId || inv.customerId === urlCustomerId)
      .sort((a, b) => b.issueDate - a.issueDate);

    paintSummary();
    renderList();
  }, (err) => {
    console.error('[invoice] listen failed', err);
    document.getElementById('ivList').innerHTML =
      `<div class="boats-empty">
         <h2>${tr("Couldn't load invoices")}</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

function paintSummary() {
  let total = 0, paid = 0, outstanding = 0;
  for (const inv of currentItems) {
    total += inv.amount;
    if (inv.status === 'PAID') paid += inv.amount;
    else outstanding += inv.amount;
  }
  document.getElementById('ivTotal').textContent = formatMoney(total);
  document.getElementById('ivOutstanding').textContent = formatMoney(outstanding);
  document.getElementById('ivPaid').textContent = formatMoney(paid);
}

function formatMoney(n) {
  return '£' + Number(n || 0).toFixed(2);
}

function getVisible() {
  const q = (document.getElementById('ivSearchInput')?.value || '').trim().toLowerCase();

  let list = currentItems;

  if (selectedStatus !== 'All') {
    list = list.filter(inv => inv.status === selectedStatus);
  }

  if (selectedYear > -1 && selectedMonth > -1) {
    list = list.filter(inv => {
      const d = new Date(inv.issueDate);
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }

  if (q) {
    list = list.filter(inv =>
      (inv.invoiceNumber || '').toLowerCase().includes(q) ||
      (inv.clientName || '').toLowerCase().includes(q) ||
      (inv.boatName || '').toLowerCase().includes(q) ||
      (inv.description || '').toLowerCase().includes(q)
    );
  }

  return list;
}

function computeInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(Number(ts));
  return d.toLocaleDateString(uiLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderList() {
  const listEl = document.getElementById('ivList');
  if (!listEl) return;

  const items = getVisible();

  if (!items.length) {
    const q = (document.getElementById('ivSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>${tr("No matches")}</h2><p>${escapeHtml(tr("ui.noMatches", {query:q}))}</p></div>`
      : `<div class="boats-empty"><h2>${tr("No invoices")}</h2><p>${tr("Tap + to add the first invoice.")}</p></div>`;
    return;
  }

  listEl.innerHTML = items.map(inv => {
    const statusColor = STATUS_COLORS[inv.status] || '#737D89';
    const isPayable = inv.status === 'PENDING' || inv.status === 'OVERDUE';

    return `
      <div class="iv-row" data-inv-id="${inv._docId}">
        <div class="iv-avatar">${escapeHtml(computeInitials(inv.clientName))}</div>

        <div class="iv-info">
          <div class="iv-line-1">
            <div class="iv-customer">${escapeHtml(inv.clientName || tr('Unnamed'))}</div>
            <div class="iv-status-badge" style="background:${statusColor};">${escapeHtml(tr(inv.status))}</div>
          </div>

          <div class="iv-line-2">
            <div class="iv-boat">${escapeHtml(inv.boatName || '—')}</div>
            <div class="iv-number">${escapeHtml(inv.invoiceNumber || '')}</div>
          </div>

          ${inv.description ? `<div class="iv-description">${escapeHtml(inv.description)}</div>` : ''}

          <div class="iv-line-3">
            <div class="iv-amount">${formatMoney(inv.amount)}</div>
            ${isPayable
              ? `<button type="button" class="iv-pay-btn" data-pay="${inv._docId}">${tr("Pay Now")}</button>`
              : `<div class="iv-due">${tr("Due" )} ${escapeHtml(formatDate(inv.dueDate))}</div>`}
          </div>
        </div>
        <div class="eq-row-divider"></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.iv-row').forEach(row => {
    const docId = row.dataset.invId;
    const inv = items.find(i => i._docId === docId);
    if (!inv) return;

    row.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-pay]')) return;
      showInvoiceDetail(inv);
    });
  });

  listEl.querySelectorAll('[data-pay]').forEach(btn => {
    const docId = btn.dataset.pay;
    const inv = items.find(i => i._docId === docId);
    if (!inv) return;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      showInvoicePaymentSheet(inv);
    });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}