// js/components/TopBar.js
import { store } from '../store.js';
import { formatSyncTime } from '../utils.js';

const TITLES = {
  '/boats':     'Dubai Marina',
  '/dashboard': 'Dashboard',
  '/berths':    'Berths',
  '/fleet':     'Fleet',
  '/account':   'Account',
};

export function renderTopBar(route) {
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = TITLES[route] || 'Dubai Marina';

  const syncEl = document.getElementById('topbarSync');
  if (!syncEl) return;

  syncEl.textContent = store.syncTime
    ? `Online · Synced ${formatSyncTime(store.syncTime)}`
    : 'Online';
}