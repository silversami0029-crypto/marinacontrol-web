// js/components/BerthToolbarMenu.js
// Toolbar menu — mirrors bottomsheet_toolbar_berth_menu.xml

import { esc } from '../utils.js';

const ICONS = {
  dockWalk: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="13" cy="4" r="1.8"/>
      <path d="M13 7l-2 5 3 3v6"/>
      <path d="M11 12l-3 1"/>
      <path d="M14 15l3 2"/>
    </svg>`,
  calendar: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="2" x2="8" y2="7"/>
      <line x1="16" y1="2" x2="16" y2="7"/>
    </svg>`,
  importCsv: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>`,
  exportCsv: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>`,
  restore: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7"/>
      <polyline points="3 4 3 10 9 10"/>
    </svg>`,
  delete: `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>`
};

function row({ id, icon, label, danger = false, onClick }) {
  const el = document.createElement('button');
  el.className = 'berth-menu-row' + (danger ? ' berth-menu-row--danger' : '');
  el.id = id;
  el.type = 'button';
  el.innerHTML = `
    <span class="berth-menu-icon">${icon}</span>
    <span class="berth-menu-label">${esc(label)}</span>
  `;
  el.addEventListener('click', onClick);
  return el;
}

function divider() {
  const el = document.createElement('div');
  el.className = 'berth-menu-divider';
  return el;
}

/**
 * @param {Object} handlers
 * @param {Function} handlers.onDockWalk
 * @param {Function} handlers.onBookingRequests
 * @param {Function} handlers.onImportCsv
 * @param {Function} handlers.onExportCsv
 * @param {Function} handlers.onRestoreDefaults
 * @param {Function} handlers.onDeleteAll
 */
export function showBerthToolbarMenu(handlers = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet berth-menu-sheet';
  sheet.innerHTML = `
    <div class="berth-menu-handle"></div>
    <div class="berth-menu-title">Berth Actions</div>
  `;

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  sheet.appendChild(row({
    id: 'menuDockWalk',
    icon: ICONS.dockWalk,
    label: 'Dock Walk',
    onClick: () => { close(); handlers.onDockWalk?.(); }
  }));

  sheet.appendChild(row({
    id: 'menuBookingRequests',
    icon: ICONS.calendar,
    label: 'Booking Request',
    onClick: () => { close(); handlers.onBookingRequests?.(); }
  }));

  sheet.appendChild(divider());

  sheet.appendChild(row({
    id: 'menuImportCsv',
    icon: ICONS.importCsv,
    label: 'Import CSV',
    onClick: () => { close(); handlers.onImportCsv?.(); }
  }));

  sheet.appendChild(row({
    id: 'menuExportCsv',
    icon: ICONS.exportCsv,
    label: 'Export CSV',
    onClick: () => { close(); handlers.onExportCsv?.(); }
  }));

  sheet.appendChild(divider());

  sheet.appendChild(row({
    id: 'menuRestoreDefaults',
    icon: ICONS.restore,
    label: 'Reset to Default',
    onClick: () => { close(); handlers.onRestoreDefaults?.(); }
  }));

  sheet.appendChild(row({
    id: 'menuDeleteAll',
    icon: ICONS.delete,
    label: 'Delete All Berths',
    danger: true,
    onClick: () => { close(); handlers.onDeleteAll?.(); }
  }));

  document.getElementById('modalRoot').append(backdrop, sheet);
  backdrop.addEventListener('click', close);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });
}