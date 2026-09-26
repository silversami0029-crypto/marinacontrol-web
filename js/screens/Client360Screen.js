// js/screens/Client360Screen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { showAssignCustomerSheet } from '../components/AssignCustomerSheet.js';
import { assignCustomerToBoat } from '../db.js';
import { db } from '../firebase.js';

let currentCustomer = null;
let currentBoats = [];
let currentBerth = null;
let currentMaintenance = [];

export async function mountClient360Screen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  let customerId = Number(params.get('customerId') || 0);

  const clientId = Number(store.activeClientId);
  if (!clientId) {
    screen.innerHTML = `<div class="boats-empty"><h2>No client assigned</h2></div>`;
    return;
  }

  // No customerId → resolve from active boat
  if (!customerId) {
    screen.innerHTML = `
      <div class="c360-header">
        <div class="c360-header-row">
          <button class="c360-icon-btn" id="c360Back">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div class="c360-pill">360° Client View</div>
          <div class="c360-header-spacer"></div>
        </div>
      </div>
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    `;

    document.getElementById('c360Back').addEventListener('click', () => {
      location.hash = '#/customer-directory';
    });

    try {
      let activeBoat = null;

      if (store.activeBoatId) {
        const snap = await getDocs(
          query(
            collection(db, 'boats'),
            where('clientId', '==', clientId),
            where('id', '==', Number(store.activeBoatId))
          )
        );
        if (!snap.empty) activeBoat = snap.docs[0].data();
      }

      if (!activeBoat) {
        const snap = await getDocs(
          query(
            collection(db, 'boats'),
            where('clientId', '==', clientId),
            where('isActive', '==', true)
          )
        );
        if (!snap.empty) activeBoat = snap.docs[0].data();
      }

      if (!activeBoat) {
        screen.innerHTML = `
          <div class="boats-empty">
            <h2>No active boat</h2>
            <p>Set a boat as active to view its customer.</p>
          </div>
        `;
        return;
      }

      customerId = Number(activeBoat.customerId || 0);

         if (!customerId) {
        // Need the full boat doc for the assign sheet (id + name + customerId)
        const fullBoatSnap = await getDocs(
          query(
            collection(db, 'boats'),
            where('clientId', '==', clientId),
            where('id', '==', Number(activeBoat.id || 0))
          )
        );
        const fullBoat = fullBoatSnap.empty
          ? { ...activeBoat, id: Number(activeBoat.id || 0), name: activeBoat.name || '' }
          : { _docId: fullBoatSnap.docs[0].id, ...fullBoatSnap.docs[0].data() };

        screen.innerHTML = `
          <div class="c360-empty">
            <div class="c360-empty-inner">
              <h2>No customer linked</h2>
              <p>The active boat has no customer assigned.</p>
              <button type="button" class="c360-empty-btn" id="c360AssignCustomer">
                Assign Customer
              </button>
            </div>
          </div>
        `;

        document.getElementById('c360AssignCustomer').addEventListener('click', async () => {
          // Load customers for this client
          const custSnap = await getDocs(
            query(
              collection(db, 'customers'),
              where('clientId', '==', clientId)
            )
          );
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

                toast('Customer assigned', { kind: 'success' });

                // Reload the 360 with the new customer
                location.hash = `#/client-360?customerId=${pickedCustomerId}`;
                // Force re-mount since we're already on that path
                setTimeout(() => mountClient360Screen(), 50);
              } catch (err) {
                console.error('[360 assign] failed', err);
                toast('Failed to assign customer', { kind: 'error' });
              }
            }
          });
        });
        return;
      }
    } catch (err) {
      console.error('[360] active boat lookup failed', err);
      screen.innerHTML = `<div class="boats-empty"><h2>Couldn't resolve active boat</h2></div>`;
      return;
    }
  }

  screen.innerHTML = `
    <div class="c360-header">
      <div class="c360-header-row">
        <button class="c360-icon-btn" id="c360Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="c360-pill">360° Client View</div>
        <button class="c360-icon-btn" id="c360Help" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="c360-header-spacer"></div>
      </div>
    </div>

    <div class="c360-body" id="c360Body">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  document.getElementById('c360Back').addEventListener('click', () => {
    location.hash = '#/customer-directory';
  });

  document.getElementById('c360Help').addEventListener('click', () => {
    toast('360° Client View help coming soon');
  });

  try {
    await loadAll(clientId, customerId);
    render();
  } catch (err) {
    console.error('[360] load failed', err);
    document.getElementById('c360Body').innerHTML = `
      <div class="boats-empty">
        <h2>Couldn't load client view</h2>
        <p>${escapeHtml(err.message || 'Unknown error')}</p>
      </div>
    `;
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
  const alerts = buildAlerts();

  body.innerHTML = `
    ${alerts.length ? renderAlerts(alerts) : ''}
    ${renderClientCard(c)}
    ${renderBoatsCard()}
    ${renderBerthCard()}
    ${renderFinancialCard()}
    ${renderActivityCard()}
    ${renderComingNextCard('Equipment', 'Equipment view coming next')}
    ${renderComingNextCard('Safety',    'Safety items coming next')}
    ${renderComingNextCard('Documents', 'Documents coming next')}
    ${renderComingNextCard('Inventory', 'Inventory coming next')}
    ${renderQuickActions()}
  `;

  body.querySelectorAll('[data-coming-next]').forEach(el => {
    el.addEventListener('click', () => {
      toast(el.dataset.comingNext);
    });
  });

  body.querySelectorAll('[data-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.action;
      if (action === 'maintenance') {
        location.hash = '#/maintenance';
      } else {
        toast(`${el.dataset.label || action} coming next`);
      }
    });
  });
}

/* ============================================================
   ALERTS
   ============================================================ */
function buildAlerts() {
  const now = Date.now();
  const alerts = [];

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

  alerts.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'critical' ? -1 : 1));
  return alerts;
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

/* ============================================================
   CLIENT
   ============================================================ */
function renderClientCard(c) {
  const since = c.createdDate
    ? new Date(Number(c.createdDate)).toLocaleDateString('en-GB', {
        month: 'short', year: 'numeric'
      })
    : '';

  return `
    <div class="c360-card">
      <div class="c360-client-head">
        <div class="c360-client-name">${escapeHtml(c.name || 'Unnamed')}</div>
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
        <div class="c360-card-title">Boats</div>
        <div class="c360-line c360-line-dim">No boats assigned</div>
      </div>
    `;
  }

  return `
    <div class="c360-card">
      <div class="c360-card-title">Boats</div>
      ${currentBoats.map(b => `
        <div class="c360-boat-row">
          <div class="c360-boat-head">
            <span class="c360-boat-name">${escapeHtml(b.name || 'Unnamed')}</span>
            ${b.isActive ? '<span class="c360-active-badge">ACTIVE</span>' : ''}
          </div>
          <div class="c360-line">HIN: ${escapeHtml(b.hin || '—')}</div>
          <div class="c360-line c360-status-${statusClass(b.status)}">
            Status: ${escapeHtml(b.status || 'Unknown')}
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
        <div class="c360-card-title">📍 Berth & Booking</div>
        <div class="c360-line c360-line-dim">No berth assigned</div>
      </div>
    `;
  }

  const b = currentBerth;
  const arrived = b.assignedDate
    ? new Date(Number(b.assignedDate)).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : null;
  const departure = b.expectedEndDate
    ? new Date(Number(b.expectedEndDate)).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    : null;

  return `
    <div class="c360-card">
      <div class="c360-card-title">📍 Berth & Booking</div>
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
  return `
    <div class="c360-card c360-card-disabled" data-coming-next="Invoices coming next">
      <div class="c360-card-title">£ Financial Snapshot</div>
      <div class="c360-line c360-line-dim">Invoices coming next</div>
    </div>
  `;
}

/* ============================================================
   ACTIVITY
   ============================================================ */
function renderActivityCard() {
  if (!currentMaintenance.length) {
    return `
      <div class="c360-card">
        <div class="c360-card-title">📋 Recent Activity</div>
        <div class="c360-line c360-line-dim">No maintenance recorded</div>
      </div>
    `;
  }

  const sorted = [...currentMaintenance]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 6);

  return `
    <div class="c360-card">
      <div class="c360-card-title">📋 Recent Activity</div>
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
              : m.date ? `Due ${formatShortDate(m.date)}` : 'Active';

        return `
          <div class="c360-activity-row">
            <div class="c360-activity-dot c360-dot-${cls}"></div>
            <div class="c360-activity-info">
              <div class="c360-activity-title">${escapeHtml(m.type || 'Maintenance')}</div>
              <div class="c360-activity-meta">${escapeHtml(m.boatName)} · ${escapeHtml(label)}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function formatShortDate(s) {
  try {
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
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
      <button type="button" class="c360-action" data-action="maintenance" data-label="Maintenance">
        🔧 Maintenance
      </button>
      <button type="button" class="c360-action" data-action="notes" data-label="Notes">
        📝 Notes
      </button>
      <button type="button" class="c360-action" data-action="invoice" data-label="Invoice">
        💷 Invoice
      </button>
      <button type="button" class="c360-action" data-action="berth" data-label="Berth">
        ⚓ Berth
      </button>
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