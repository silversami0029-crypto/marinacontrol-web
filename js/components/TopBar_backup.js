// js/components/TopBar.js
import { store } from '../store.js';
import { formatSyncTime } from '../utils.js';
import { toggleDrawer } from './Drawer.js';

const TITLES = {
  '/boats':     'MarinaControl',
  '/dashboard': 'Dashboard',
  '/berths':    'Berths',
  '/fleet':     'Fleet',
  '/account':   'Account',
};

export function renderTopBar(route) {
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = TITLES[route] || 'MarinaControl';

  const syncEl = document.getElementById('topbarSync');
  if (!syncEl) return;

  syncEl.textContent = store.syncTime
    ? `Online · Synced ${formatSyncTime(store.syncTime)}`
    : 'Online';
}

/* ---------- Wire hamburger to open drawer ---------- */
function wireDrawerButton() {
  const btn = document.getElementById('btnTopMenu');
  if (!btn) return;
  if (btn.dataset.drawerWired === '1') return;
  btn.dataset.drawerWired = '1';
  btn.addEventListener('click', toggleDrawer);
}

// Wire now if DOM is ready, otherwise wait
if (document.readyState !== 'loading') {
  wireDrawerButton();
} else {
  document.addEventListener('DOMContentLoaded', wireDrawerButton);
}