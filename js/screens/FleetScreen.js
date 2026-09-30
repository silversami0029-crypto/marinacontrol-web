// js/screens/FleetScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let fleetFilter = 'all';   // 'all' | 'attention' | 'critical'
let tileStatus = {};

/* ---------- Icons ---------- */
const ICONS = {
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
      <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
      <line x1="3" y1="12" x2="8" y2="12"/><line x1="16" y1="12" x2="21" y2="12"/>
      <line x1="12" y1="3" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="21"/>
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
  documents: `
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
         stroke="currentColor" stroke-width="1.6"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="14 3 14 9 20 9"/>
      <line x1="8" y1="14" x2="16" y2="14"/>
      <line x1="8" y1="18" x2="13" y2="18"/>
    </svg>`,
  shield: `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2 20 5v6c0 5.2-3.4 9.3-8 11-4.6-1.7-8-5.8-8-11V5z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>`
};

/* ---------- Tiles ---------- */
const TILES = [
  { type: 'safety',      label: 'Safety',      icon: ICONS.safety },
  { type: 'equipment',   label: 'Equipment',   icon: ICONS.equipment },
  { type: 'maintenance', label: 'Maintenance', icon: ICONS.maintenance },
  { type: 'inventory',   label: 'Inventory',   icon: ICONS.inventory },
  { type: 'documents',   label: 'Documents',   icon: ICONS.documents },
  { type: 'checklists',  label: 'Checklists',  icon: ICONS.checklists }
];

/* ---------- Collections ---------- */
const COUNT_SOURCES = {
  safety:      { collection: 'safety_items' },
  equipment:   { collection: 'equipment' },
  maintenance: { collection: 'maintenance', filterIncomplete: true },
  inventory:   { collection: 'inventory' },
  documents:   { collection: 'documents' },
  checklists:  { collection: 'checklists' }
};

/* ============================================================
   MOUNT
   ============================================================ */
export function mountFleetScreen() {
  const screen = document.getElementById('screen');

  fleetFilter = 'all';
  tileStatus = {};

  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = 'MarinaControl';
  screen.innerHTML = `
    <div class="dash-wrap">

      <div class="account-header fleet-page-header">
        <div class="account-pill">Fleet</div>
      </div>

      <div class="fleet-compliance-card"
           id="fleetComplianceCard"
           role="button"
           tabindex="0">

        <div class="fleet-compliance-top">
          <span class="fleet-compliance-shield">
            ${ICONS.shield}
          </span>

          <span class="fleet-compliance-title">
            Compliance
          </span>

          <span class="fleet-compliance-score"
                id="fleetComplianceScore">
            —
          </span>
        </div>

        <div class="fleet-compliance-summary">
          <span class="fleet-compliance-warning">⚠</span>

          <span class="fleet-compliance-actions"
                id="fleetComplianceActions">
            0 actions
          </span>

          <span class="fleet-compliance-divider">•</span>

          <span class="fleet-compliance-due"
                id="fleetComplianceDueSoon">
            0 due soon
          </span>
        </div>

        <div class="fleet-compliance-link">
          View details&nbsp;›
        </div>
      </div>

      <div class="dash-health" id="fleetHealth">
        <div class="dash-health-title">Fleet Health</div>

        <div class="dash-health-body" id="fleetHealthBody">
          <div class="dash-health-good">
            <span class="dash-check" style="color:#3DD68C;">✅</span>
            <span class="dash-health-label" style="color:#3DD68C;">
              All Good
            </span>
          </div>
        </div>
      </div>

      <div class="dash-filters" id="fleetFilters">
        <button type="button"
                class="dash-filter is-active"
                data-filter="all">
          All
        </button>

        <button type="button"
                class="dash-filter"
                data-filter="attention">
          ⚠ Attention
        </button>

        <button type="button"
                class="dash-filter"
                data-filter="critical">
          ⛔ Critical
        </button>
      </div>

      <div class="dash-grid" id="fleetGrid"></div>

    </div>
  `;
 
 

 

screen.querySelector('#fleetComplianceCard')
  ?.addEventListener('click', () => {
    location.hash = '#/client-360';
  });

  screen.querySelector('#fleetHealth').addEventListener('click', event => {
    const target = event.target.closest('[data-health-filter]');
    if (!target) return;

    fleetFilter = target.dataset.healthFilter;
    syncChips();
    applyFilter();
  });

  screen.querySelectorAll('.dash-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      fleetFilter = btn.dataset.filter;
      syncChips();
      applyFilter();
    });
  });

  function syncChips() {
    screen.querySelectorAll('.dash-filter').forEach(b =>
      b.classList.toggle('is-active', b.dataset.filter === fleetFilter)
    );
  }

  const grid = screen.querySelector('#fleetGrid');
  grid.innerHTML = TILES.map(t => `
    <button class="dash-tile" data-type="${t.type}">
      <div class="dash-tile-icon">${t.icon}</div>
      <div class="dash-tile-text">
        <div class="dash-tile-title">${t.label}</div>
        <div class="dash-tile-count" data-count="${t.type}" hidden></div>
      </div>
    </button>
  `).join('');

  grid.querySelectorAll('.dash-tile').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      if (type === 'documents')        location.hash = '#/documents';
      else if (type === 'maintenance') location.hash = '#/maintenance';
      else if (type === 'safety')      location.hash = '#/safety';
      else if (type === 'equipment')   location.hash = '#/equipment';
      else if (type === 'inventory')   location.hash = '#/inventory';
      else if (type === 'checklists')  location.hash = '#/checklists';
      else toast(`${type} coming soon`);
    });
  });

  loadFleetCounts().catch(err =>
    console.error('[fleet] counts failed', err)
  );
}

/* ============================================================
   DATA
   ============================================================ */
async function loadFleetCounts() {
  const clientId = Number(store.activeClientId);
  if (!clientId) return;

  const counts = {};
  for (const type of Object.keys(COUNT_SOURCES)) counts[type] = 0;

  await Promise.all(
    Object.entries(COUNT_SOURCES).map(async ([type, src]) => {
      try {
        const q = query(
          collection(db, src.collection),
          where('clientId', '==', clientId)
        );
        const snap = await getDocs(q);
        let n = 0;
        snap.forEach(d => {
          const data = d.data();
          if (src.filterIncomplete) {
            const status = String(data.status || '').toUpperCase();
            if (
              data.completed ||
              status === 'COMPLETED' ||
              status === 'DEFERRED' ||
              status === 'CANCELLED'
            ) return;
          }
          n++;
        });
        counts[type] = n;
      } catch {
        counts[type] = 0;
      }
    })
  );

  const status = await computeFleetStatuses(clientId);
  tileStatus = status.perTile;

  paintCounts(counts);
  paintHealth(status);
  applyFilter();

  // Compliance — reuses the status numbers we already have
  paintCompliance({
    expiredSafety:    status.expiredSafety,
    expiredDocuments: status.expiredDocuments,
    openMaintenance:  status.openMaintenance,
    soonSafety:       status.soonSafety,
    soonDocuments:    status.soonDocuments
  });
}

async function computeFleetStatuses(clientId) {
  const perTile = {};
  let criticalCount = 0;
  let attentionCount = 0;

  let expiredSafety = 0, soonSafety = 0;
  let expiredDocuments = 0, soonDocuments = 0;
  let openMaintenance = 0;

  // SAFETY
  try {
    const snap = await getDocs(query(
      collection(db, 'safety_items'),
      where('clientId', '==', clientId)
    ));
    const now = Date.now();
    const cutoff = now + 30 * 24 * 60 * 60 * 1000;
    snap.forEach(d => {
      const x = d.data();
      if (x.status === 'DELETED') return;
      const e = Number(x.expiryDate || 0);
      if (e <= 0) return;
      if (e < now) expiredSafety++;
      else if (e <= cutoff) soonSafety++;
    });
    if (expiredSafety > 0) perTile.safety = 'critical';
    else if (soonSafety > 0) perTile.safety = 'attention';
    criticalCount  += expiredSafety;
    attentionCount += soonSafety;
  } catch (e) { console.warn('[fleet] safety status failed', e); }

  // MAINTENANCE
  try {
    const snap = await getDocs(query(
      collection(db, 'maintenance'),
      where('clientId', '==', clientId)
    ));
    const now = Date.now();
    const soon = 30 * 24 * 60 * 60 * 1000;
    let overdue = 0, upcoming = 0;
    snap.forEach(d => {
      const x = d.data();
      if (x.completed || x.status === 'COMPLETED') return;
      if (x.status === 'DEFERRED' || x.status === 'CANCELLED') return;
      openMaintenance++;
      if (!x.date) return;
      const due = new Date(x.date + 'T00:00:00').getTime();
      if (isNaN(due)) return;
      if (due < now) overdue++;
      else if (due - now <= soon) upcoming++;
    });
    if (overdue > 0)       perTile.maintenance = 'critical';
    else if (upcoming > 0) perTile.maintenance = 'attention';
    criticalCount  += overdue;
    attentionCount += upcoming;
  } catch (e) { console.warn('[fleet] maintenance status failed', e); }

  // DOCUMENTS
  try {
    const snap = await getDocs(query(
      collection(db, 'documents'),
      where('clientId', '==', clientId)
    ));
    const now = Date.now();
    const cutoff = now + 30 * 24 * 60 * 60 * 1000;
    snap.forEach(d => {
      const x = d.data();
      const e = Number(x.expiryDate || 0);
      if (e <= 0) return;
      if (e < now) expiredDocuments++;
      else if (e <= cutoff) soonDocuments++;
    });
    if (expiredDocuments > 0) perTile.documents = 'critical';
    else if (soonDocuments > 0) perTile.documents = 'attention';
    criticalCount  += expiredDocuments;
    attentionCount += soonDocuments;
  } catch (e) { console.warn('[fleet] documents status failed', e); }

  // INVENTORY
  try {
    const snap = await getDocs(query(
      collection(db, 'inventory'),
      where('clientId', '==', clientId)
    ));
    let outOfStock = 0, crit = 0, low = 0;
    snap.forEach(d => {
      const q = Number(d.data().quantity || 0);
      if (q <= 0) outOfStock++;
      else if (q <= 1) crit++;
      else if (q <= 3) low++;
    });
    if (outOfStock + crit > 0) perTile.inventory = 'critical';
    else if (low > 0)          perTile.inventory = 'attention';
    criticalCount  += outOfStock + crit;
    attentionCount += low;
  } catch (e) { console.warn('[fleet] inventory status failed', e); }

  // EQUIPMENT
  try {
    const snap = await getDocs(query(
      collection(db, 'equipment'),
      where('clientId', '==', clientId)
    ));
    let fault = 0, outOfService = 0, serviceDue = 0;
    snap.forEach(d => {
      const s = String(d.data().status || 'OPERATIONAL').trim().toUpperCase();
      if (s === 'FAULT') fault++;
      else if (s === 'OUT_OF_SERVICE') outOfService++;
      else if (s === 'SERVICE_DUE') serviceDue++;
    });
    if (fault + outOfService > 0) perTile.equipment = 'critical';
    else if (serviceDue > 0)      perTile.equipment = 'attention';
    criticalCount  += fault + outOfService;
    attentionCount += serviceDue;
  } catch (e) { console.warn('[fleet] equipment status failed', e); }

  return {
    perTile,
    criticalCount,
    attentionCount,
    expiredSafety,
    soonSafety,
    expiredDocuments,
    soonDocuments,
    openMaintenance
  };
}

function paintCounts(counts) {
  for (const [type, n] of Object.entries(counts)) {
    const el = document.querySelector(`[data-count="${type}"]`);
    if (!el) continue;
    if (n > 0) { el.textContent = String(n); el.hidden = false; }
    else       { el.hidden = true; }
  }
}

function paintHealth(status) {
  const body = document.getElementById('fleetHealthBody');
  if (!body) return;

  const hasCritical  = status.criticalCount > 0;
  const hasAttention = status.attentionCount > 0;

  if (!hasCritical && !hasAttention) {
    body.innerHTML = `
      <div class="dash-health-good">
        <span class="dash-check" style="color:#3DD68C;">✅</span>
        <span class="dash-health-label" style="color:#3DD68C;">All Good</span>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="dash-health-row">
      ${hasAttention ? `
        <div class="dash-health-col"
             data-health-filter="attention"
             role="button" tabindex="0"
             aria-label="Show attention items">
          <span class="dash-check" style="color:#F5A524;">⚠</span>
          <span class="dash-health-label" style="color:#F5A524;">Attention</span>
          <span class="dash-health-count" style="color:#F5A524;">${status.attentionCount}</span>
        </div>` : ''}
      ${hasCritical ? `
        <div class="dash-health-col"
             data-health-filter="critical"
             role="button" tabindex="0"
             aria-label="Show critical items">
          <span class="dash-check" style="color:#FF4444;">⛔</span>
          <span class="dash-health-label" style="color:#FF4444;">Critical</span>
          <span class="dash-health-count" style="color:#FF4444;">${status.criticalCount}</span>
        </div>` : ''}
    </div>`;
}

/* ============================================================
   COMPLIANCE
   ============================================================ */
function paintCompliance({
  expiredSafety, expiredDocuments, openMaintenance,
  soonSafety, soonDocuments
}) {
  // Actions = expired safety + expired docs + all open maintenance
  const actions = expiredSafety + expiredDocuments + openMaintenance;

  // Due soon = expiring safety + expiring docs (next 30 days)
  const dueSoon = soonSafety + soonDocuments;

  // Score (matches Android 5-area math, simplified for fleet scope):
  //   Safety:      0 pts if expired, 10 pts if expiring, else 20
  //   Documents:   0 pts if expired, 10 pts if expiring, else 20
  //   Maintenance: 20 - (open * 2), floor 0
  //   Berths:      20 (not yet computed on web — no berth-infra source)
  //   Electrical:  20 (not yet computed on web — no pedestal source)
  const safetyScore    = expiredSafety > 0 ? 0 : (soonSafety > 0 ? 10 : 20);
  const docsScore      = expiredDocuments > 0 ? 0 : (soonDocuments > 0 ? 10 : 20);
  const maintScore     = Math.max(0, 20 - Math.min(openMaintenance * 2, 20));
  const berthsScore    = 20;
  const electricalScore = 20;
  let score = safetyScore + docsScore + maintScore + berthsScore + electricalScore;
  if (score > 100) score = 100;
  if (score < 0)   score = 0;

  const scoreEl    = document.getElementById('fleetComplianceScore');
  const actionsEl  = document.getElementById('fleetComplianceActions');
  const dueEl      = document.getElementById('fleetComplianceDueSoon');

  if (scoreEl) {
    scoreEl.textContent = score + '%';
    scoreEl.style.color =
      score >= 90 ? '#3DD68C' :
      score >= 70 ? '#F5A524' :
                    '#FF4444';
  }

  if (actionsEl) {
    actionsEl.textContent = actions + (actions === 1 ? ' action' : ' actions');
  }

  if (dueEl) {
    dueEl.textContent = dueSoon + ' due soon';
  }
}

function applyFilter() {
  const grid = document.getElementById('fleetGrid');
  if (!grid) return;

  grid.querySelectorAll('.dash-tile').forEach(el => {
    const status = tileStatus[el.dataset.type] || null;

    el.classList.toggle('is-critical', status === 'critical');
    el.classList.toggle('is-attention', status === 'attention');

    let visible = true;
    if (fleetFilter === 'attention')      visible = status === 'attention';
    else if (fleetFilter === 'critical')  visible = status === 'critical';

    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  });
}