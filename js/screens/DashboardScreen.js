// js/screens/DashboardScreen.js
// Boat Dashboard — mirrors fragment_boat_dashboard.xml + BoatDashboardFragment
// Phase 1: header + boat health card + 8-tile grid (stubs for counts)

import { store } from '../store.js';
import { toast } from '../ui/toast.js';

/* ---------- Icons (Material Symbols style, inline SVG) ---------- */
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

/* ---------- Tile definitions (matches Android createDashboardItems) ---------- */
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

export function mountDashboardScreen() {
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

  // Update topbar title
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = boat.name;

  screen.innerHTML = `
    <div class="dash-wrap">

      <!-- Header bar -->
      <div class="dash-header">
        <button class="dash-back" id="dashBack" aria-label="Back">
          ${ICONS.back}
        </button>
        <div class="dash-title">${escapeHtml(boat.name)}</div>
        <button class="dash-info" id="dashInfo" aria-label="Help">
          ${ICONS.info}
        </button>
      </div>

      <!-- Boat Health card -->
      <div class="dash-health" id="dashHealth">
        <div class="dash-health-title">Boat Health</div>
        <div class="dash-health-body">
          <div class="dash-health-good">
            <span class="dash-check">✅</span>
            <span class="dash-health-label">All Good</span>
          </div>
        </div>
      </div>

      <!-- Tile grid -->
      <div class="dash-grid" id="dashGrid"></div>
    </div>
  `;

  // Wire back button
  screen.querySelector('#dashBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  // Wire info (stub)
  screen.querySelector('#dashInfo').addEventListener('click', () => {
    toast('Dashboard help coming soon');
  });

  // Health card tap (stub)
  screen.querySelector('#dashHealth').addEventListener('click', () => {
    toast('Health details coming soon');
  });

  // Render tiles
  const grid = screen.querySelector('#dashGrid');
  grid.innerHTML = TILES.map(t => `
    <button class="dash-tile" data-type="${t.type}">
      <div class="dash-tile-icon">${t.icon}</div>
      <div class="dash-tile-text">
        <div class="dash-tile-title">${t.label}</div>
      </div>
    </button>
  `).join('');

  // Wire tile taps (stubs)
  grid.querySelectorAll('.dash-tile').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.type;
      const label = TILES.find(t => t.type === type)?.label || type;
      toast(`${label} coming soon`);
    });
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