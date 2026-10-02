import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/Client360Screen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showAssignCustomerSheet } from '../components/AssignCustomerSheet.js';
import { assignCustomerToBoat } from '../db.js';
import { showClient360Help } from './Client360Help.js';
import { db } from '../firebase.js';

let currentCustomer = null;
let currentSearchQuery = '';
let currentBoats = [];
let currentBerth = null;
let currentMaintenance = [];
let currentSafety = [];
let currentDocuments = [];
let currentEquipment = [];
let currentInventory = [];
let currentTasks = [];
let currentInvoices = [];

const HEADER_HTML = `
  <div class="c360-header" id="c360Header">
    <div class="c360-header-row">
      <button class="c360-icon-btn" id="c360Back" aria-label="${tr("Back")}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="c360-pill">${tr("360° Client View")}</div>
      <button class="c360-icon-btn" id="c360Help" aria-label="${tr("Help")}">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <line x1="12" y1="11" x2="12" y2="16"/>
          <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
        </svg>
      </button>
      <div class="c360-header-spacer"></div>
      <button class="c360-icon-btn" id="c360SearchToggle" aria-label="${tr("Search")}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
      </button>
    </div>
  </div>

  <div class="boats-search-bar" id="c360SearchBar" hidden>
    <input id="c360SearchInput" type="text" placeholder="${tr("Search activity...")}" autocomplete="off">
    <button type="button" class="search-cancel" id="c360SearchCancel">${tr("Cancel")}</button>
  </div>
`;

export async function mountClient360Screen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let customerId = Number(params.get('customerId') || 0);

  currentSearchQuery = '';

  const clientId = Number(store.activeClientId);
  if (!clientId) {
    screen.innerHTML = `<div class="boats-empty"><h2>${tr("No client assigned")}</h2></div>`;
    return;
  }

  /* ------------------------------------------------------------
     No customerId in URL → resolve from active boat
     ------------------------------------------------------------ */
  if (!customerId) {
    screen.innerHTML = HEADER_HTML + `
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    `;
  wireHeader({
  onSearch: null,
  onBack: () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      location.hash = '#/customer-directory';
    }
  }
});

    let activeBoat = null;
    try {
      if (store.activeBoatId) {
        const snap = await getDocs(query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('id', '==', Number(store.activeBoatId))
        ));
        if (!snap.empty) activeBoat = snap.docs[0].data();
      }

      if (!activeBoat) {
        const snap = await getDocs(query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('isActive', '==', true)
        ));
        if (!snap.empty) activeBoat = snap.docs[0].data();
      }

      if (!activeBoat) {
        screen.innerHTML = `
          <div class="c360-empty">
            <div class="c360-empty-inner">
              <h2>${tr("No active boat")}</h2>
              <p>${tr("Set a boat as active to view its customer.")}</p>
              <button type="button" class="c360-empty-btn" id="c360OpenBoats">${tr("Open Boats")}</button>
            </div>
          </div>
        `;
        document.getElementById('c360OpenBoats').addEventListener('click', () => {
          location.hash = '#/boats';
        });
        return;
      }

      customerId = Number(activeBoat.customerId || 0);
    } catch (err) {
      console.error('[360] active boat lookup failed', err);
      screen.innerHTML = `<div class="boats-empty"><h2>${tr("Couldn't resolve active boat")}</h2></div>`;
      return;
    }

    /* Active boat has no customer → assign flow */
    if (!customerId) {
      const fullBoatSnap = await getDocs(query(
        collection(db, 'boats'),
        where('clientId', '==', clientId),
        where('id', '==', Number(activeBoat.id || 0))
      ));
      const fullBoat = fullBoatSnap.empty
        ? { ...activeBoat, id: Number(activeBoat.id || 0), name: activeBoat.name || '' }
        : { _docId: fullBoatSnap.docs[0].id, ...fullBoatSnap.docs[0].data() };

      screen.innerHTML = `
        <div class="c360-empty">
          <div class="c360-empty-inner">
            <h2>${tr("No customer linked")}</h2>
            <p>${tr("The active boat has no customer assigned.")}</p>
            <button type="button" class="c360-empty-btn" id="c360AssignCustomer">${tr("Assign Customer")}</button>
          </div>
        </div>
      `;

      document.getElementById('c360AssignCustomer').addEventListener('click', async () => {
        const custSnap = await getDocs(query(
          collection(db, 'customers'),
          where('clientId', '==', clientId)
        ));
        const customers = custSnap.docs
          .map(d => ({ _docId: d.id, ...d.data(), id: Number(d.data().id || 0) }))
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        showAssignCustomerSheet({
          boat: fullBoat,
          customers,
          onAssign: async (pickedCustomerId) => {
            try {
              const userId = store.userProfile?.userId || 0;
              await assignCustomerToBoat(String(fullBoat.id), pickedCustomerId, userId);
              toast(tr('Customer assigned'), { kind: 'success' });
              location.hash = `#/client-360?customerId=${pickedCustomerId}`;
              setTimeout(() => mountClient360Screen(), 50);
            } catch (err) {
              console.error('[360 assign] failed', err);
              toast(tr('Failed to assign customer'), { kind: 'error' });
            }
          }
        });
      });
      return;
    }
  }

  /* ------------------------------------------------------------
     Full render with customerId
     ------------------------------------------------------------ */
  screen.innerHTML = HEADER_HTML + `
    <div class="c360-body" id="c360Body">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  wireHeader({
    onSearch: (query) => {
      currentSearchQuery = query;
      render();
    },
    onBack: () => history.back()
  });

  try {
    await loadAll(clientId, customerId);
    render();
  } catch (err) {
    console.error('[360] load failed', err);
    document.getElementById('c360Body').innerHTML = `
      <div class="boats-empty">
        <h2>${tr("Couldn't load client view")}</h2>
        <p>${escapeHtml(err.message || 'Unknown error')}</p>
      </div>
    `;
  }
}

/* ============================================================
   WIRE HEADER (shared for both branches)
   ============================================================ */
function wireHeader({ onSearch, onBack }) {
  document.getElementById('c360Back').addEventListener('click', onBack);

  document.getElementById('c360Help').addEventListener('click', showClient360Help);

  const searchToggle = document.getElementById('c360SearchToggle');
  const searchBar = document.getElementById('c360SearchBar');
  const searchInput = document.getElementById('c360SearchInput');
  const searchCancel = document.getElementById('c360SearchCancel');
  const header = document.getElementById('c360Header');

  if (searchToggle && searchBar && searchInput && searchCancel && header) {
    searchToggle.addEventListener('click', () => {
      header.hidden = true;
      searchBar.hidden = false;
      searchInput.focus();
    });

    searchCancel.addEventListener('click', () => {
      searchBar.hidden = true;
      header.hidden = false;
      searchInput.value = '';
      if (onSearch) onSearch('');
    });

    searchInput.addEventListener('input', (e) => {
      if (onSearch) onSearch(e.target.value.trim().toLowerCase());
    });
  }
}

/* ============================================================
   LOAD
   ============================================================ */
async function loadAll(clientId, customerId) {
  const custSnap = await getDocs(
    query(
      collection(db, 'customers'),
      where('clientId', '==', clientId),
      where('id', '==', customerId)
    )
  );
  currentCustomer = custSnap.empty
    ? null
    : { _docId: custSnap.docs[0].id, ...custSnap.docs[0].data() };

  if (!currentCustomer) return;

  const boatsSnap = await getDocs(
    query(
      collection(db, 'boats'),
      where('clientId', '==', clientId),
      where('customerId', '==', customerId)
    )
  );
  currentBoats = boatsSnap.docs.map(d => ({
    _docId: d.id,
    ...d.data(),
    id: Number(d.data().id || 0)
  }));

  currentBerth = null;
  for (const boat of currentBoats) {
    const berthSnap = await getDocs(
      query(
        collection(db, 'berths'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    if (!berthSnap.empty) {
      currentBerth = {
        _docId: berthSnap.docs[0].id,
        ...berthSnap.docs[0].data(),
        boatId: boat.id
      };
      break;
    }
  }
  currentSafety = [];
  for (const boat of currentBoats) {
    const safetySnap = await getDocs(
      query(
        collection(db, 'safety_items'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    safetySnap.forEach(d => {
      const data = d.data();
      if (data.status === 'DELETED') return;
      currentSafety.push({
        _docId: d.id,
        boatId: boat.id,
        boatName: boat.name || '',
        id: Number(data.id || 0),
        title: data.title || '',
        category: data.category || '',
        importance: data.importance || 'MEDIUM',
        expiryDate: Number(data.expiryDate || 0)
      });
    });
  }

  currentDocuments = [];
  for (const boat of currentBoats) {
    const docsSnap = await getDocs(
      query(
        collection(db, 'documents'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    docsSnap.forEach(d => {
      const data = d.data();
      currentDocuments.push({
        _docId: d.id,
        boatId: boat.id,
        boatName: boat.name || '',
        id: Number(data.id || 0),
        name: data.name || '',
        type: data.type || '',
        expiryDate: Number(data.expiryDate || 0)
      });
    });
  }

  currentEquipment = [];
  for (const boat of currentBoats) {
    const eqSnap = await getDocs(
      query(
        collection(db, 'equipment'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    eqSnap.forEach(d => {
      const data = d.data();
      currentEquipment.push({
        _docId: d.id,
        boatId: boat.id,
        boatName: boat.name || '',
        id: Number(data.id || 0),
        manufacturer: data.manufacturer || '',
        model: data.model || '',
        type: data.type || '',
        status: data.status || 'OPERATIONAL'
      });
    });
  }

  currentInventory = [];
  for (const boat of currentBoats) {
    const invSnap = await getDocs(
      query(
        collection(db, 'inventory'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    invSnap.forEach(d => {
      const data = d.data();
      currentInventory.push({
        _docId: d.id,
        boatId: boat.id,
        boatName: boat.name || '',
        id: Number(data.id || 0),
        name: data.name || '',
        category: data.category || '',
        quantity: Number(data.quantity || 0),
        reorderLevel: Number(data.reorderLevel || 0),
        unit: data.unit || ''
      });
    });
  }

  currentTasks = [];
  for (const boat of currentBoats) {
    const taskSnap = await getDocs(
      query(
        collection(db, 'tasks'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    taskSnap.forEach(d => {
      const data = d.data();
      if (data.status === 'DELETED') return;
      currentTasks.push({
        _docId: d.id,
        boatId: boat.id,
        boatName: boat.name || '',
        id: Number(data.id || 0),
        title: data.title || '',
        priority: (data.priority || 'MEDIUM').toUpperCase(),
        status: (data.status || 'OPEN').toUpperCase(),
        category: data.category || '',
        dueDate: data.dueDate || '',
        assignedTo: data.assignedTo || ''
      });
    });
  }

  currentInvoices = [];
  const invSnap = await getDocs(
    query(
      collection(db, 'invoices'),
      where('clientId', '==', clientId),
      where('customerId', '==', customerId)
    )
  );
  invSnap.forEach(d => {
    const data = d.data();
    currentInvoices.push({
      _docId: d.id,
      boatId: Number(data.boatId || 0),
      boatName: data.boatName || '',
      id: Number(data.id || 0),
      customerId: Number(data.customerId || 0),
      clientName: data.clientName || '',
      invoiceNumber: data.invoiceNumber || '',
      description: data.description || '',
      category: data.category || 'GENERAL',
      issueDate: Number(data.issueDate || 0),
      dueDate: Number(data.dueDate || 0),
      amount: Number(data.amount || 0),
      status: (data.status || 'PENDING').toUpperCase()
    });
  });

  currentMaintenance = [];
  for (const boat of currentBoats) {
    const maintSnap = await getDocs(
      query(
        collection(db, 'maintenance'),
        where('clientId', '==', clientId),
        where('boatId', '==', boat.id)
      )
    );
    maintSnap.forEach(d => {
      const data = d.data();
      currentMaintenance.push({
        _docId: d.id,
        boatId: boat.id,
        boatName: boat.name || '',
        id: Number(data.id || 0),
        type: data.type || '',
        date: data.date || '',
        status: data.status || 'ACTIVE',
        completed: !!data.completed,
        notes: data.notes || '',
        source: data.source || '',
        assignedTo: data.assignedTo || ''
      });
    });
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  const body = document.getElementById('c360Body');
  if (!body) return;

  const c = currentCustomer;
  if (!c) {
    body.innerHTML = `
      <div class="boats-empty">
        <h2>${tr("Customer not found")}</h2>
      </div>
    `;
    return;
  }

  const alerts = buildAlerts();

  body.innerHTML = `
    ${alerts.length ? renderAlerts(alerts) : ''}
    ${renderClientCard(c)}
    ${renderBoatsCard()}
    ${renderBerthCard()}
    ${renderFinancialCard()}
    ${renderActivityCard()}
    ${renderEquipmentCard()}
    ${renderSafetyCard()}
    ${renderDocumentsCard()}
    ${renderInventoryCard()}
    ${renderQuickActions()}
    ${renderTasksCard()}
  `;

  body.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;

      if (action === 'maintenance') {
        location.hash = '#/maintenance';
        return;
      }

         if (action === 'berth') {
        location.hash = '#/berths';
        return;
      }

      if (action === 'invoice') {
        location.hash = `#/invoices?customerId=${currentCustomer?.id || 0}`;
        return;
      }

      toast(tr(`${el.dataset.label || action} coming next`));
    });
  });

}

/* ============================================================
   ALERTS
   ============================================================ */
function buildAlerts() {
  const now = Date.now();
  const alerts = [];

  // --- Maintenance ---
  for (const m of currentMaintenance) {
    if (m.completed || m.status === 'COMPLETED') continue;

    if (m.status === 'ESCALATED') {
      alerts.push({ kind: 'critical', text: `${m.type} escalated`, boat: m.boatName });
      continue;
    }

    if (!m.date) continue;
    const due = new Date(m.date + 'T00:00:00').getTime();
    if (isNaN(due)) continue;

    if (due < now) {
      const days = Math.floor((now - due) / (24 * 60 * 60 * 1000));
      alerts.push({
        kind: 'critical',
        text: `${m.type} overdue by ${days} ${days === 1 ? 'day' : 'days'}`,
        boat: m.boatName
      });
    } else if (due - now <= 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor((due - now) / (24 * 60 * 60 * 1000));
      alerts.push({
        kind: 'warning',
        text: `${m.type} due in ${days} ${days === 1 ? 'day' : 'days'}`,
        boat: m.boatName
      });
    }
  }

  // --- Invoices (overdue only) ---
  for (const inv of currentInvoices) {
    if (inv.status !== 'OVERDUE') continue;
    const days = inv.dueDate
      ? Math.floor((now - inv.dueDate) / (24 * 60 * 60 * 1000))
      : 0;
    alerts.push({
      kind: 'critical',
      text: `Invoice ${inv.invoiceNumber} overdue${days > 0 ? ` by ${days} ${days === 1 ? 'day' : 'days'}` : ''}`,
      boat: inv.boatName
    });
  }

  // --- Safety items ---
  for (const s of currentSafety) {
    if (!s.expiryDate) continue;
    if (s.expiryDate < now) {
      alerts.push({ kind: 'critical', text: `${s.title} expired`, boat: s.boatName });
    } else if (s.expiryDate - now <= 30 * 24 * 60 * 60 * 1000) {
      const days = Math.floor((s.expiryDate - now) / (24 * 60 * 60 * 1000));
      alerts.push({
        kind: 'warning',
        text: `${s.title} expires in ${days} ${days === 1 ? 'day' : 'days'}`,
        boat: s.boatName
      });
    }
  }

  // --- Documents ---
  for (const d of currentDocuments) {
    if (!d.expiryDate) continue;
    if (d.expiryDate < now) {
      alerts.push({ kind: 'critical', text: `${d.name} expired`, boat: d.boatName });
    } else if (d.expiryDate - now <= 30 * 24 * 60 * 60 * 1000) {
      const days = Math.floor((d.expiryDate - now) / (24 * 60 * 60 * 1000));
      alerts.push({
        kind: 'warning',
        text: `${d.name} expires in ${days} ${days === 1 ? 'day' : 'days'}`,
        boat: d.boatName
      });
    }
  }

  // --- Inventory (low stock, critical, out of stock) ---
  for (const e of currentInventory) {
    const st = computeInvStatus(e.quantity);
    if (st.key === 'IN_STOCK') continue;

    const qtyLabel = `Qty ${e.quantity}${e.unit ? ' ' + e.unit : ''}`;

    if (st.key === 'OUT_OF_STOCK') {
      alerts.push({
        kind: 'critical',
        text: `${e.name} out of stock (${qtyLabel})`,
        boat: e.boatName
      });
    } else if (st.key === 'CRITICAL') {
      alerts.push({
        kind: 'critical',
        text: `${e.name} critically low (${qtyLabel})`,
        boat: e.boatName
      });
    } else if (st.key === 'LOW_STOCK') {
      alerts.push({
        kind: 'warning',
        text: `${e.name} low stock (${qtyLabel})`,
        boat: e.boatName
      });
    }
  }

  // --- Tasks (overdue / critical) ---
  for (const t of currentTasks) {
    if (t.status !== 'OPEN') continue;
    const prio = String(t.priority || '').toUpperCase();
    if (prio === 'OVERDUE' || prio === 'CRITICAL') {
      alerts.push({
        kind: 'critical',
        text: `${t.title} — ${prio === 'OVERDUE' ? tr('overdue') : 'critical priority'}`,
        boat: t.boatName
      });
      continue;
    }
    if (!t.dueDate) continue;
    const due = new Date(t.dueDate + 'T00:00:00').getTime();
    if (isNaN(due)) continue;
    const now = Date.now();
    const soon = 3 * 24 * 60 * 60 * 1000;
    if (due < now) {
      const days = Math.floor((now - due) / (24 * 60 * 60 * 1000));
      alerts.push({ kind: 'critical', text: `${t.title} overdue by ${days} ${days === 1 ? 'day' : 'days'}`, boat: t.boatName });
    } else if (due - now <= soon) {
      const days = Math.floor((due - now) / (24 * 60 * 60 * 1000));
      alerts.push({ kind: 'warning', text: `${t.title} due in ${days} ${days === 1 ? 'day' : 'days'}`, boat: t.boatName });
    }
  }

  alerts.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'critical' ? -1 : 1));
  return alerts;
}

/* ============================================================
   CLIENT
   ============================================================ */
function renderClientCard(c) {
  const since = c.createdDate
    ? new Date(Number(c.createdDate)).toLocaleDateString(uiLocale(), {
        month: 'short', year: 'numeric'
      })
    : '';

  return `
    <div class="c360-card">
      <div class="c360-client-head">
        <div class="c360-client-name">${escapeHtml(c.name || tr('Unnamed'))}</div>
        ${c.isPreferred ? '<span class="c360-star">★</span>' : ''}
      </div>
      ${c.email ? `<div class="c360-line">${escapeHtml(c.email)}</div>` : ''}
      ${c.phone ? `<div class="c360-line">${escapeHtml(c.phone)}</div>` : ''}
      ${since ? `<div class="c360-line c360-line-dim">Customer since ${escapeHtml(since)}</div>` : ''}
    </div>
  `;
}

/* ============================================================
   BOATS
   ============================================================ */
function renderBoatsCard() {
  if (!currentBoats.length) {
    return `
      <div class="c360-card">
        <div class="c360-card-title">${tr("Boats")}</div>
        <div class="c360-line c360-line-dim">${tr("No boats assigned")}</div>
      </div>
    `;
  }

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("Boats")}</div>
      ${currentBoats.map(b => `
        <div class="c360-boat-row">
          <div class="c360-boat-head">
            <span class="c360-boat-name">${escapeHtml(b.name || tr('Unnamed'))}</span>
            ${b.isActive ? `<span class="c360-active-badge">${tr("ACTIVE")}</span>` : ''}
          </div>
          <div class="c360-line">HIN: ${escapeHtml(b.hin || '—')}</div>
          <div class="c360-line c360-status-${statusClass(b.status)}">
            ${tr("Status:" )} ${escapeHtml(b.status || 'Unknown')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function statusClass(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('service') && !v.includes('off')) return 'ok';
  if (v.includes('maintenance')) return 'warn';
  if (v.includes('off') || v.includes('inactive')) return 'err';
  return 'dim';
}

/* ============================================================
   BERTH
   ============================================================ */
function renderBerthCard() {
  if (!currentBerth) {
    return `
      <div class="c360-card">
        <div class="c360-card-title">${tr("📍 Berth & Booking")}</div>
        <div class="c360-line c360-line-dim">${tr("No berth assigned")}</div>
      </div>
    `;
  }

  const b = currentBerth;
  const arrived = b.assignedDate
    ? new Date(Number(b.assignedDate)).toLocaleDateString(uiLocale(), {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : null;
  const departure = b.expectedEndDate
    ? new Date(Number(b.expectedEndDate)).toLocaleDateString(uiLocale(), {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : null;

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("📍 Berth & Booking")}</div>
      <div class="c360-line">Berth: ${escapeHtml((b.dockName || '') + ' ' + (b.berthNumber || ''))}</div>
      ${arrived ? `<div class="c360-line">Arrived: ${escapeHtml(arrived)}</div>` : ''}
      ${departure ? `<div class="c360-line">Departure: ${escapeHtml(departure)}</div>` : ''}
    </div>
  `;
}

/* ============================================================
   FINANCIAL (disabled)
   ============================================================ */
function renderFinancialCard() {
  const invoices = currentInvoices || [];
  if (!invoices.length) {
    return `
      <div class="c360-card c360-card-disabled" data-coming-next="No invoices">
        <div class="c360-card-title">${tr("£ Financial Snapshot")}</div>
        <div class="c360-line c360-line-dim">${tr("No invoices recorded")}</div>
      </div>
    `;
  }

  let total = 0, paid = 0, outstanding = 0, overdue = 0;
  for (const inv of invoices) {
    total += inv.amount;
    if (inv.status === 'PAID') paid += inv.amount;
    else {
      outstanding += inv.amount;
      if (inv.status === 'OVERDUE') overdue += inv.amount;
    }
  }

  const fmt = (n) => '£' + Number(n || 0).toFixed(2);

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("£ Financial Snapshot")}</div>
      <div class="c360-fin-grid">
        <div class="c360-fin-col">
          <div class="c360-fin-label">${tr("Total")}</div>
          <div class="c360-fin-value">${fmt(total)}</div>
        </div>
        <div class="c360-fin-col">
          <div class="c360-fin-label">${tr("Outstanding")}</div>
          <div class="c360-fin-value" style="color:#FF4444;">${fmt(outstanding)}</div>
        </div>
        <div class="c360-fin-col">
          <div class="c360-fin-label">${tr("Paid")}</div>
          <div class="c360-fin-value" style="color:#4CAF50;">${fmt(paid)}</div>
        </div>
      </div>
      ${overdue > 0 ? `<div class="c360-alert-more" style="color:#FF4444;">Overdue: ${fmt(overdue)}</div>` : ''}
    </div>
  `;
}

/* ============================================================
   ACTIVITY (with search filter)
   ============================================================ */
function renderActivityCard() {
  const now = Date.now();

  // Build a unified timeline from all sources
  const events = [];

  // Maintenance
  for (const m of currentMaintenance) {
    if (!m.date) continue;
    const t = new Date(m.date + 'T00:00:00').getTime();
    if (isNaN(t)) continue;
    const completed = m.completed || m.status === 'COMPLETED';
    events.push({
      timestamp: t,
      kind: completed ? 'ok' : 'warn',
      title: completed ? tr(`Maintenance completed: ${m.type}`) : tr(`Maintenance outstanding: ${m.type}`),
      detail: completed ? '' : 'Action required',
      boat: m.boatName
    });
  }

  // Documents
  for (const d of currentDocuments) {
    if (!d.expiryDate) continue;
    const expired = d.expiryDate < now;
    events.push({
      timestamp: d.expiryDate,
      kind: expired ? 'err' : 'info',
      title: tr(`Document: ${d.name}`),
      detail: expired ? 'Expired' : tr(`Expires ${formatShortDate(new Date(d.expiryDate).toISOString().slice(0,10))}`),
      boat: d.boatName
    });
  }

  // Safety
  for (const s of currentSafety) {
    if (!s.expiryDate) continue;
    const expired = s.expiryDate < now;
    events.push({
      timestamp: s.expiryDate,
      kind: expired ? 'err' : 'info',
      title: tr(`Safety: ${s.title}`),
      detail: expired ? 'Expired' : tr(`Expires ${formatShortDate(new Date(s.expiryDate).toISOString().slice(0,10))}`),
      boat: s.boatName
    });
  }

  // Berth assignment (current only)
  if (currentBerth && currentBerth.assignedDate) {
    events.push({
      timestamp: Number(currentBerth.assignedDate),
      kind: 'info',
      title: tr(`Assigned to berth ${currentBerth.dockName || ''} ${currentBerth.berthNumber || ''}`).trim(),
      detail: '',
      boat: ''
    });
  }

  // Apply search filter
  const q = currentSearchQuery;
  const filtered = q
    ? events.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.detail || '').toLowerCase().includes(q) ||
        (e.boat || '').toLowerCase().includes(q))
    : events;

  if (!filtered.length) {
    const msg = q ? tr(`No activity matches "${q}"`) : 'No activity recorded';
    return `
      <div class="c360-card">
        <div class="c360-card-title">${tr("📋 Recent Activity")}</div>
        <div class="c360-line c360-line-dim">${escapeHtml(msg)}</div>
      </div>
    `;
  }

  const sorted = [...filtered]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("📋 Recent Activity")}</div>
      ${sorted.map(e => `
        <div class="c360-activity-row">
          <div class="c360-activity-dot c360-dot-${e.kind}"></div>
          <div class="c360-activity-info">
            <div class="c360-activity-title">${escapeHtml(e.title)}</div>
            <div class="c360-activity-meta">
              ${e.detail ? escapeHtml(e.detail) : ''}${e.detail && e.boat ? ' · ' : ''}${e.boat ? escapeHtml(e.boat) : ''}${!e.detail && !e.boat ? formatShortDate(new Date(e.timestamp).toISOString().slice(0,10)) : ''}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}
/*function renderActivityCard() {
  const q = currentSearchQuery;
  const filtered = q
    ? currentMaintenance.filter(m =>
        (m.type || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q) ||
        (m.status || '').toLowerCase().includes(q) ||
        (m.assignedTo || '').toLowerCase().includes(q) ||
        (m.boatName || '').toLowerCase().includes(q)
      )
    : currentMaintenance;

  if (!filtered.length) {
    const msg = q ? tr(`No activity matches "${q}"`) : 'No maintenance recorded';
    return `
      <div class="c360-card">
        <div class="c360-card-title">${tr("📋 Recent Activity")}</div>
        <div class="c360-line c360-line-dim">${escapeHtml(msg)}</div>
      </div>
    `;
  }

  const sorted = [...filtered]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 6);

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("📋 Recent Activity")}</div>
      ${sorted.map(m => {
        const cls = m.completed || m.status === 'COMPLETED'
          ? 'ok'
          : m.status === 'DEFERRED'
            ? 'info'
            : m.status === 'ESCALATED'
              ? 'err'
              : 'warn';
        const label = m.completed || m.status === 'COMPLETED'
          ? 'Completed'
          : m.status === 'DEFERRED'
            ? 'Deferred'
            : m.status === 'ESCALATED'
              ? 'Escalated'
              : m.date ? tr(`Due ${formatShortDate(m.date)}`) : 'Active';

        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(m.type || 'Maintenance')}</div>
              <div class="c360-activity-meta">${escapeHtml(m.boatName)} · ${escapeHtml(tr(label))}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}*/

function formatShortDate(s) {
  try {
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(uiLocale(), {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return s;
  }
}

/* ============================================================
   COMING NEXT
   ============================================================ */
function renderComingNextCard(title, message) {
  return `
    <div class="c360-card c360-card-disabled" data-coming-next="${escapeAttr(message)}">
      <div class="c360-card-title">${escapeHtml(title)}</div>
      <div class="c360-line c360-line-dim">${escapeHtml(message)}</div>
    </div>
  `;
}

/* ============================================================
   QUICK ACTIONS
   ============================================================ */
function renderQuickActions() {
  return `
    <div class="c360-actions">
      <button type="button" class="c360-action" data-action="maintenance" data-label="Maintenance">${tr("🔧 Maintenance")}</button>
      <button type="button" class="c360-action" data-action="notes" data-label="Notes">${tr("📝 Notes")}</button>
      <button type="button" class="c360-action" data-action="invoice" data-label="Invoice">${tr("💷 Invoice")}</button>
      <button type="button" class="c360-action" data-action="berth" data-label="Berth">${tr("⚓ Berth")}</button>
    </div>
  `;
}

/* ============================================================
   HELPERS
   ============================================================ */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderSafetyCard() {
  if (!currentSafety || !currentSafety.length) {
    return `
      <div class="c360-card c360-card-disabled" data-coming-next="No safety items">
        <div class="c360-card-title">${tr("🛟 Safety")}</div>
        <div class="c360-line c360-line-dim">${tr("No safety items recorded")}</div>
      </div>
    `;
  }

  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000;
  const sorted = [...currentSafety].sort((a, b) => {
    const rank = s => {
      if (!s.expiryDate) return 3;
      if (s.expiryDate < now) return 0;
      if (s.expiryDate <= cutoff) return 1;
      return 2;
    };
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.expiryDate || Infinity) - (b.expiryDate || Infinity);
  });

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("🛟 Safety")}</div>
      ${sorted.slice(0, 5).map(s => {
        const cls = !s.expiryDate ? 'info'
          : s.expiryDate < now ? 'err'
          : s.expiryDate <= cutoff ? 'warn'
          : 'ok';
        const label = !s.expiryDate ? 'No expiry'
          : s.expiryDate < now ? 'Expired'
          : s.expiryDate <= cutoff ? 'Expiring soon'
          : 'Valid';
        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(s.title || 'Safety item')}</div>
              <div class="c360-activity-meta">${escapeHtml(s.category)} · ${escapeHtml(s.boatName)} · ${label}</div>
            </div>
          </div>
        `;
      }).join('')}
      ${currentSafety.length > 5 ? `<div class="c360-alert-more">+${currentSafety.length - 5} more</div>` : ''}
    </div>
  `;
}



function renderDocumentsCard() {
  if (!currentDocuments || !currentDocuments.length) {
    return `
      <div class="c360-card c360-card-disabled" data-coming-next="No documents">
        <div class="c360-card-title">${tr("📄 Documents")}</div>
        <div class="c360-line c360-line-dim">${tr("No documents recorded")}</div>
      </div>
    `;
  }

  const now = Date.now();
  const cutoff = now + 30 * 24 * 60 * 60 * 1000;
  const sorted = [...currentDocuments].sort((a, b) => {
    const rank = d => {
      if (!d.expiryDate) return 3;
      if (d.expiryDate < now) return 0;
      if (d.expiryDate <= cutoff) return 1;
      return 2;
    };
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return (a.expiryDate || Infinity) - (b.expiryDate || Infinity);
  });

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("📄 Documents")}</div>
      ${sorted.slice(0, 5).map(d => {
        const cls = !d.expiryDate ? 'info'
          : d.expiryDate < now ? 'err'
          : d.expiryDate <= cutoff ? 'warn'
          : 'ok';
        const label = !d.expiryDate ? 'No expiry'
          : d.expiryDate < now ? 'Expired'
          : d.expiryDate <= cutoff ? 'Expiring soon'
          : 'Valid';
        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(d.name || 'Document')}</div>
              <div class="c360-activity-meta">${escapeHtml(tr(d.type))} · ${escapeHtml(d.boatName)} · ${label}</div>
            </div>
          </div>
        `;
      }).join('')}
      ${currentDocuments.length > 5 ? `<div class="c360-alert-more">+${currentDocuments.length - 5} more</div>` : ''}
    </div>
  `;
}


function renderAlerts(alerts) {
  const hasCritical = alerts.some(a => a.kind === 'critical');
  const title = hasCritical ? '🔴 Critical Alerts' : '🟡 Attention Alerts';

  return `
    <div class="c360-card c360-alerts ${hasCritical ? 'is-critical' : 'is-warning'}">
      <div class="c360-alert-title">${title}</div>
      <div class="c360-alert-list">
        ${alerts.slice(0, 6).map(a => `
          <div class="c360-alert-line">
            <span class="c360-alert-dot"></span>
            <span>${escapeHtml(a.text)}${a.boat ? ` · ${escapeHtml(a.boat)}` : ''}</span>
          </div>
        `).join('')}
        ${alerts.length > 6 ? `<div class="c360-alert-more">+${alerts.length - 6} more</div>` : ''}
      </div>
    </div>
  `;
}

function renderEquipmentCard() {
  if (!currentEquipment || !currentEquipment.length) {
    return `
      <div class="c360-card c360-card-disabled" data-coming-next="No equipment">
        <div class="c360-card-title">${tr("⚙️ Equipment")}</div>
        <div class="c360-line c360-line-dim">${tr("No equipment recorded")}</div>
      </div>
    `;
  }
  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("⚙️ Equipment")}</div>
      ${currentEquipment.slice(0, 5).map(e => {
        const v = String(e.status || '').toUpperCase();
        const cls = v.includes('FAULT') || v.includes('BROKEN') || v.includes('OUT') ? 'err'
          : v.includes('SERVICE') || v.includes('MAINT') ? 'warn'
          : 'ok';
        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(e.manufacturer || 'Equipment')} ${e.model ? escapeHtml(e.model) : ''}</div>
              <div class="c360-activity-meta">${escapeHtml(tr(e.type))} · ${escapeHtml(e.boatName)}</div>
            </div>
          </div>
        `;
      }).join('')}
      ${currentEquipment.length > 5 ? `<div class="c360-alert-more">+${currentEquipment.length - 5} more</div>` : ''}
    </div>
  `;
}
const TASK_PRIORITY_COLORS = {
  OVERDUE:  '#EF4444',
  CRITICAL: '#DC2626',
  MEDIUM:   '#F59E0B',
  LOW:      '#10B981'
};

function taskPriorityClass(priority) {
  const p = String(priority || '').toUpperCase();
  if (p === 'OVERDUE' || p === 'CRITICAL') return 'err';
  if (p === 'MEDIUM') return 'warn';
  return 'ok';
}

function renderTasksCard() {
  const open = currentTasks.filter(t => t.status === 'OPEN');
  if (!open.length) {
    return `
      <div class="c360-card c360-card-disabled" data-coming-next="No open tasks">
        <div class="c360-card-title">${tr("✅ Tasks")}</div>
        <div class="c360-line c360-line-dim">${tr("No open tasks")}</div>
      </div>
    `;
  }

  const now = Date.now();
  const ranked = [...open].sort((a, b) => {
    const order = { OVERDUE: 0, CRITICAL: 1, MEDIUM: 2, LOW: 3 };
    const ra = order[String(a.priority || '').toUpperCase()] ?? 4;
    const rb = order[String(b.priority || '').toUpperCase()] ?? 4;
    if (ra !== rb) return ra - rb;
    return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  });

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("✅ Tasks")}<span style="color:var(--color-text-secondary);font-weight:400;font-size:13px;">(${open.length} open)</span></div>
      ${ranked.slice(0, 5).map(t => {
        const cls = taskPriorityClass(t.priority);
        const due = t.dueDate ? formatShortDate(t.dueDate) : '';
        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(t.title)}</div>
              <div class="c360-activity-meta">${escapeHtml(t.priority)}${t.category ? ' · ' + escapeHtml(t.category) : ''}${t.boatName ? ' · ' + escapeHtml(t.boatName) : ''}${due ? ' · Due ' + escapeHtml(due) : ''}</div>
            </div>
          </div>
        `;
      }).join('')}
      ${ranked.length > 5 ? `<div class="c360-alert-more">+${ranked.length - 5} more</div>` : ''}
    </div>
  `;
}


// Android InventoryAdapter parity: qty<=0 OUT_OF_STOCK, qty<=1 CRITICAL,
// qty<=3 LOW_STOCK, else IN_STOCK
function computeInvStatus(quantity) {
  const q = Number(quantity || 0);
  if (q <= 0) return { key: 'OUT_OF_STOCK', cls: 'err', label: 'Out of Stock' };
  if (q <= 1) return { key: 'CRITICAL',     cls: 'err', label: 'Critical' };
  if (q <= 3) return { key: 'LOW_STOCK',    cls: 'warn', label: 'Low Stock' };
  return { key: 'IN_STOCK', cls: 'ok', label: 'In Stock' };
}

function renderInventoryCard() {
  if (!currentInventory || !currentInventory.length) {
    return `
      <div class="c360-card c360-card-disabled" data-coming-next="No inventory">
        <div class="c360-card-title">${tr("📦 Inventory")}</div>
        <div class="c360-line c360-line-dim">${tr("No inventory recorded")}</div>
      </div>
    `;
  }

  // Show the most urgent items first (out of stock, then critical, then low),
  // then anything else, capped at 5 like the Equipment card.
  const ranked = [...currentInventory].sort((a, b) => {
    const order = { OUT_OF_STOCK: 0, CRITICAL: 1, LOW_STOCK: 2, IN_STOCK: 3 };
    const ra = order[computeInvStatus(a.quantity).key] ?? 4;
    const rb = order[computeInvStatus(b.quantity).key] ?? 4;
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });

  return `
    <div class="c360-card">
      <div class="c360-card-title">${tr("📦 Inventory")}</div>
      ${ranked.slice(0, 5).map(e => {
        const st = computeInvStatus(e.quantity);
        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${st.cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(e.name || 'Item')}</div>
              <div class="c360-activity-meta">${escapeHtml(tr(e.category || '—'))} · ${escapeHtml(e.boatName)} · Qty ${e.quantity}${e.unit ? ' ' + escapeHtml(e.unit) : ''} (${st.label})</div>
            </div>
          </div>
        `;
      }).join('')}
      ${ranked.length > 5 ? `<div class="c360-alert-more">+${ranked.length - 5} more</div>` : ''}
    </div>
  `;
}