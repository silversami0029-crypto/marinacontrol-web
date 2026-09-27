// js/screens/BoatDashboardScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let dashboardFilter = 'all';   // 'all' | 'attention' | 'critical'
let hasAnyCritical = false;
let tileStatus = {};

/* ---------- Icons ---------- */
const ICONS = {
  back: `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>`,
  info: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="11" x2="12" y2="16"/>
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
    </svg>`,
  safety: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <circle cx="12" cy="12" r="4"/>
      <line x1="3" y1="12" x2="8" y2="12"/>
      <line x1="16" y1="12" x2="21" y2="12"/>
      <line x1="12" y1="3" x2="12" y2="8"/>
      <line x1="12" y1="16" x2="12" y2="21"/>
    </svg>`,
  equipment: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4M12 19v4M4.2 4.2l2.9 2.9M16.9 16.9l2.9 2.9M1 12h4M19 12h4M4.2 19.8l2.9-2.9M16.9 7.1l2.9-2.9"/>
    </svg>`,
  maintenance: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0 5.3 5.3l-9 9a2 2 0 0 1-2.8-2.8l9-9z"/>
      <path d="M14.7 6.3 17 4l3 3-2.3 2.3"/>
    </svg>`,
  inventory: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <path d="M3 8l2-4h14l2 4"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
    </svg>`,
  checklists: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="3" width="14" height="18" rx="2"/>
      <polyline points="9 8 11 10 15 6"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
      <line x1="9" y1="18" x2="15" y2="18"/>
    </svg>`,
  tasks: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 7 6 10 12 4"/>
      <polyline points="3 15 6 18 12 12"/>
      <line x1="15" y1="7" x2="21" y2="7"/>
      <line x1="15" y1="17" x2="21" y2="17"/>
    </svg>`,
  documents: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="14 3 14 9 20 9"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
      <line x1="8" y1="18" x2="13" y2="18"/>
    </svg>`,
  crew: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="8" r="3.5"/>
      <path d="M3 21a6 6 0 0 1 12 0"/>
      <circle cx="17" cy="10" r="2.5"/>
      <path d="M14 19.5a4 4 0 0 1 7 1.5"/>
    </svg>`
};

/* ---------- Tiles ---------- */
const TILES = [
  { type: 'safety',      label: 'Safety',      icon: ICONS.safety },
  { type: 'equipment',   label: 'Equipment',   icon: ICONS.equipment },
  { type: 'maintenance', label: 'Maintenance', icon: ICONS.maintenance },
  { type: 'inventory',   label: 'Inventory',   icon: ICONS.inventory },
  { type: 'checklists',  label: 'Checklists',  icon: ICONS.checklists },
  { type: 'tasks',       label: 'Tasks',       icon: ICONS.tasks },
  { type: 'documents',   label: 'Documents',   icon: ICONS.documents },
  { type: 'crew',        label: 'Crew',        icon: ICONS.crew }
];

/* ---------- Collection mapping ---------- */
const COUNT_SOURCES = {
  maintenance: { collection: 'maintenance', filterIncomplete: true },
  crew:        { collection: 'crew' },
  documents:   { collection: 'documents' },
  safety:      { collection: 'safety_items', filterActive: true },
  equipment:   { collection: 'equipment' },
  inventory:   { collection: 'inventory' },
  checklists:  { collection: 'checklist' },
  tasks:       { collection: 'tasks' }
};

/* ============================================================
   MOUNT
   ============================================================ */
export function mountBoatDashboardScreen() {
  const screen = document.getElementById('screen');
  const boatId = getBoatIdFromHash();
  const boat   = store.boatsFull.find(b => b.id === boatId);

  if (!boat) {
    screen.innerHTML = `
      <div class="boats-empty">
        <h2>Boat not found</h2>
        <p>Returning to boats list…</p>
      </div>
    `;
    setTimeout(() => { location.hash = '#/boats'; }, 800);
    return;
  }

  dashboardFilter = 'all';
  hasAnyCritical = false;
  tileStatus = {};

  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = boat.name;

  screen.innerHTML = `
    <div class="dash-wrap">
      <div class="dash-header">
        <button class="dash-back" id="dashBack" aria-label="Back">
          ${ICONS.back}
        </button>
        <div class="dash-title">${escapeHtml(boat.name)}</div>
        <button class="dash-info" id="dashInfo" aria-label="Help">
          ${ICONS.info}
        </button>
      </div>

           <div class="dash-health" id="dashHealth">
        <div class="dash-health-title">Boat Health</div>
        <div class="dash-health-body" id="dashHealthBody">
          <div class="dash-health-good">
            <span class="dash-check" style="color:#3DD68C;">✅</span>
            <span class="dash-health-label" style="color:#3DD68C;">All Good</span>
          </div>
        </div>
      </div>

      <div class="dash-filters" id="dashFilters">
        <button type="button" class="dash-filter is-active" data-filter="all">All</button>
        <button type="button" class="dash-filter" data-filter="attention">⚠ Attention</button>
        <button type="button" class="dash-filter" data-filter="critical">⛔ Critical</button>
      </div>

      <div class="dash-grid" id="dashGrid"></div>
    </div>
  `;

  screen.querySelector('#dashBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  screen.querySelector('#dashInfo').addEventListener('click', () => {
    toast('Dashboard help coming soon');
  });

  screen.querySelector('#dashHealth').addEventListener('click', () => {
    const filters = ['all'];

    if (Object.values(tileStatus).includes('attention')) {
      filters.push('attention');
    }

    if (Object.values(tileStatus).includes('critical')) {
      filters.push('critical');
    }

    const currentIndex = filters.indexOf(dashboardFilter);
    dashboardFilter = filters[(currentIndex + 1) % filters.length];

    syncFilterChips();
    applyDashboardFilter();
  });

  screen.querySelectorAll('.dash-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      dashboardFilter = btn.dataset.filter;
      syncFilterChips();
      applyDashboardFilter();
    });
  });

  function syncFilterChips() {
    screen.querySelectorAll('.dash-filter').forEach(b =>
      b.classList.toggle('is-active', b.dataset.filter === dashboardFilter)
    );
  }

  const grid = screen.querySelector('#dashGrid');
  grid.innerHTML = TILES.map(t => `
    <button class="dash-tile" data-type="${t.type}">
      <div class="dash-tile-icon">${t.icon}</div>
      <div class="dash-tile-text">
        <div class="dash-tile-title" data-label="${t.type}">${t.label}</div>
        <div class="dash-tile-count" data-count="${t.type}" hidden></div>
      </div>
    </button>
  `).join('');

  grid.querySelectorAll('.dash-tile').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      const label = TILES.find(t => t.type === type)?.label || type;

      if (type === 'maintenance') { location.hash = '#/maintenance'; return; }
      if (type === 'crew')        { location.hash = '#/crew';        return; }
      if (type === 'documents')   { location.hash = '#/documents';   return; }
      if (type === 'safety')      { location.hash = '#/safety';      return; }
      if (type === 'equipment')   { location.hash = '#/equipment';   return; }
      if (type === 'inventory')   { location.hash = '#/inventory';   return; }
      toast(`${label} coming soon`);
    });
  });

  loadCounts(boatId).catch(err => {
    console.error('[boat dashboard] counts failed', err);
  });
}

/* ============================================================
   COUNT LOADING
   ============================================================ */
async function loadCounts(boatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) return;

  const counts = {};
  for (const type of Object.keys(COUNT_SOURCES)) counts[type] = 0;

  await Promise.all(
    Object.entries(COUNT_SOURCES).map(async ([type, src]) => {
      try {
        const q = query(
          collection(db, src.collection),
          where('clientId', '==', clientId),
          where('boatId', '==', Number(boatId))
        );
        const snap = await getDocs(q);
        let n = 0;
        snap.forEach(d => {
          const data = d.data();
          if (src.filterIncomplete && (data.completed || data.status === 'COMPLETED')) return;
          if (src.filterActive && data.status === 'DELETED') return;
          n++;
        });
        counts[type] = n;
      } catch {
        counts[type] = 0;
      }
    })
  );

  const status = await computeStatuses(boatId, clientId);
  tileStatus = status.perTile;
  hasAnyCritical = status.hasAnyCritical;

  paintCounts(counts);
  paintHealth(status);
  applyDashboardFilter();
}

async function computeStatuses(boatId, clientId) {
  const perTile = {};
  let criticalCount = 0;
  let attentionCount = 0;

  try {
    const snap = await getDocs(query(
      collection(db, 'maintenance'),
      where('clientId', '==', clientId),
      where('boatId', '==', Number(boatId))
    ));
    const now = Date.now();
    const soon = 7 * 24 * 60 * 60 * 1000;
    let overdue = 0, upcoming = 0;
    snap.forEach(d => {
      const x = d.data();
      if (x.completed || x.status === 'COMPLETED') return;
      if (x.status === 'DEFERRED' || x.status === 'CANCELLED') return;
      if (!x.date) return;
      const due = new Date(x.date + 'T00:00:00').getTime();
      if (isNaN(due)) return;
      if (due < now) overdue++;
      else if (due - now <= soon) upcoming++;
    });
    if (overdue > 0)       perTile.maintenance = 'critical';
    else if (upcoming > 0) perTile.maintenance = 'attention';
    criticalCount += overdue;
    attentionCount += upcoming;
  } catch {}

  try {
    const snap = await getDocs(query(
      collection(db, 'safety_items'),
      where('clientId', '==', clientId),
      where('boatId', '==', Number(boatId))
    ));
    const now = Date.now();
    const cutoff = now + 30 * 24 * 60 * 60 * 1000;
    let expired = 0, soon = 0;
    snap.forEach(d => {
      const x = d.data();
      if (x.status === 'DELETED') return;
      const e = Number(x.expiryDate || 0);
      if (e <= 0) return;
      if (e < now) expired++;
      else if (e <= cutoff) soon++;
    });
    if (expired > 0) perTile.safety = 'critical';
    else if (soon > 0) perTile.safety = 'attention';
    criticalCount += expired;
    attentionCount += soon;
  } catch {}

  try {
    const snap = await getDocs(query(
      collection(db, 'documents'),
      where('clientId', '==', clientId),
      where('boatId', '==', Number(boatId))
    ));
    const now = Date.now();
    const cutoff = now + 30 * 24 * 60 * 60 * 1000;
    let expired = 0, soon = 0;
    snap.forEach(d => {
      const x = d.data();
      const e = Number(x.expiryDate || 0);
      if (e <= 0) return;
      if (e < now) expired++;
      else if (e <= cutoff) soon++;
    });
    if (expired > 0) perTile.documents = 'critical';
    else if (soon > 0) perTile.documents = 'attention';
    criticalCount += expired;
    attentionCount += soon;
  } catch (err) {
    console.warn('[dashboard] documents status failed', err);
  }

  try {
    const snap = await getDocs(query(
      collection(db, 'inventory'),
      where('clientId', '==', clientId),
      where('boatId', '==', Number(boatId))
    ));
    let outOfStock = 0, critical = 0, low = 0;
    snap.forEach(d => {
      const q = Number(d.data().quantity || 0);
      if (q <= 0) outOfStock++;
      else if (q <= 1) critical++;
      else if (q <= 3) low++;
    });
    if (outOfStock + critical > 0) perTile.inventory = 'critical';
    else if (low > 0)              perTile.inventory = 'attention';
    criticalCount  += outOfStock + critical;
    attentionCount += low;
  } catch (err) {
    console.warn('[dashboard] inventory status failed', err);
  }

  try {
    const snap = await getDocs(query(
      collection(db, 'equipment'),
      where('clientId', '==', clientId),
      where('boatId', '==', Number(boatId))
    ));

    let fault = 0;
    let outOfService = 0;
    let serviceDue = 0;

    snap.forEach(d => {
      const status = String(
        d.data().status || 'OPERATIONAL'
      ).trim().toUpperCase();

      if (status === 'FAULT') {
        fault++;
      } else if (status === 'OUT_OF_SERVICE') {
        outOfService++;
      } else if (status === 'SERVICE_DUE') {
        serviceDue++;
      }
    });

    if (fault + outOfService > 0) {
      perTile.equipment = 'critical';
    } else if (serviceDue > 0) {
      perTile.equipment = 'attention';
    }

    criticalCount += fault + outOfService;
    attentionCount += serviceDue;
  } catch (err) {
    console.warn('[dashboard] equipment status failed', err);
  }

  return {
    perTile,
    hasAnyCritical: criticalCount > 0,
    criticalCount,
    attentionCount
  };
}

function paintCounts(counts) {
  for (const [type, n] of Object.entries(counts)) {
    const el = document.querySelector(`[data-count="${type}"]`);
    if (!el) continue;
    if (n > 0) {
      el.textContent = String(n);
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }
}

function paintHealth(status) {
  store._boatDashboardAttention = status.attentionCount + status.criticalCount;

  const body = document.getElementById('dashHealthBody');
  if (!body) return;

  const hasCritical  = status.criticalCount > 0;
  const hasAttention = status.attentionCount > 0;

  if (!hasCritical && !hasAttention) {
    body.innerHTML = `
      <div class="dash-health-good">
        <span class="dash-check" style="color:#3DD68C;">✅</span>
        <span class="dash-health-label" style="color:#3DD68C;">All Good</span>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="dash-health-row">
      ${hasAttention ? `
        <div class="dash-health-col">
          <span class="dash-check" style="color:#F5A524;">⚠</span>
          <span class="dash-health-label" style="color:#F5A524;">Attention</span>
          <span class="dash-health-count" style="color:#F5A524;">${status.attentionCount}</span>
        </div>
      ` : ''}
      ${hasCritical ? `
        <div class="dash-health-col">
          <span class="dash-check" style="color:#FF4444;">⛔</span>
          <span class="dash-health-label" style="color:#FF4444;">Critical</span>
          <span class="dash-health-count" style="color:#FF4444;">${status.criticalCount}</span>
        </div>
      ` : ''}
    </div>
  `;
}

function applyDashboardFilter() {
  const grid = document.getElementById('dashGrid');
  if (!grid) return;

  grid.querySelectorAll('.dash-tile').forEach(el => {
    const type = el.dataset.type;
    const status = tileStatus[type] || null;

    el.classList.toggle('is-critical', status === 'critical');
    el.classList.toggle('is-attention', status === 'attention');

    let visible = true;

    if (dashboardFilter === 'attention') {
      visible = status === 'attention';
    } else if (dashboardFilter === 'critical') {
      visible = status === 'critical';
    }

    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  });
}

/* ---------- Helpers ---------- */
function getBoatIdFromHash() {
  const hash = location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return 0;
  const params = new URLSearchParams(hash.substring(qIndex + 1));
  return Number(params.get('boatId') || 0);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}