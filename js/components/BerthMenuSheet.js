// js/components/BerthMenuSheet.js
// Berth menu — mirrors bottomsheet_berth_menu.xml

import { esc } from '../utils.js';

const ICONS = {
  available: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="8 12 11 15 16 9"/>
    </svg>`,
  boat: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 17h18M5 17V9l7-5 7 5v8M9 17v-5h6v5"/>
    </svg>`,
  maintenance: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0 5.3 5.3l-9 9a2 2 0 0 1-2.8-2.8l9-9z"/>
      <path d="M14.7 6.3 17 4l3 3-2.3 2.3"/>
    </svg>`,
  calendar: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
      <line x1="8" y1="2" x2="8" y2="7"/>
      <line x1="16" y1="2" x2="16" y2="7"/>
    </svg>`,
  viewBooking: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,
  assign: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="8" r="4"/>
      <path d="M2 21a7 7 0 0 1 14 0"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="16" y1="11" x2="22" y2="11"/>
    </svg>`,
  release: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>`,
  info: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="11" x2="12" y2="16"/>
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
    </svg>`,
  edit: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 20h4l10-10-4-4L4 16v4z"/>
      <line x1="14" y1="6" x2="18" y2="10"/>
    </svg>`,
  delete: `
    <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
         stroke="#E5484D" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>`,
  chevron: `
    <svg class="sheet-chevron" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 6 15 12 9 18"/>
    </svg>`
};

function item({ id, icon, title, subtitle, danger = false, onClick }) {
  const el = document.createElement('div');
  el.className = 'sheet-item' + (danger ? ' sheet-item--danger' : '');
  el.id = id;
  el.innerHTML = `
    <div class="sheet-item-icon">${icon}</div>
    <div class="sheet-item-text">
      <div class="sheet-item-title">${esc(title)}</div>
      <div class="sheet-item-subtitle">${esc(subtitle)}</div>
    </div>
    ${ICONS.chevron}
  `;
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

/**
 * @param {import('../models/Berth.js').Berth} berth
 * @param {Object} handlers
 */
export function showBerthMenu(berth, handlers = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Berth ${esc(berth.berthNumber || '')}</div>
  `;

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  const status = (berth.status || 'AVAILABLE').toUpperCase();

  // --- Status actions (hide the current status) ---
  if (status !== 'AVAILABLE') {
    sheet.appendChild(item({
      id: 'btnSetAvailable',
      icon: ICONS.available,
      title: 'Set available',
      subtitle: 'Mark berth ready for allocation',
      onClick: () => { close(); handlers.onSetAvailable?.(berth); }
    }));
  }

  if (status !== 'OCCUPIED') {
    sheet.appendChild(item({
      id: 'btnSetOccupied',
      icon: ICONS.boat,
      title: 'Set occupied',
      subtitle: 'Mark berth currently occupied',
      onClick: () => { close(); handlers.onSetOccupied?.(berth); }
    }));
  }

  if (status !== 'MAINTENANCE') {
    sheet.appendChild(item({
      id: 'btnSetMaintenance',
      icon: ICONS.maintenance,
      title: 'Set maintenance',
      subtitle: 'Take berth out of service',
      onClick: () => { close(); handlers.onSetMaintenance?.(berth); }
    }));
  }

  // --- Booking (spacer 16dp) ---
  sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-16' }));

  sheet.appendChild(item({
    id: 'btnBookBerth',
    icon: ICONS.calendar,
    title: 'Book / reserve berth',
    subtitle: 'Create a berth reservation',
    onClick: () => { close(); handlers.onBookBerth?.(berth); }
  }));

  // View booking — only if there's an active booking (stub: never for now)
  if (berth.activeBooking) {
    sheet.appendChild(item({
      id: 'btnViewBooking',
      icon: ICONS.viewBooking,
      title: 'View booking',
      subtitle: 'View current reservation details',
      onClick: () => { close(); handlers.onViewBooking?.(berth); }
    }));
  }

  // --- Vessel (spacer 16dp) ---
  sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-16' }));

  if (berth.boatId == null) {
    sheet.appendChild(item({
      id: 'btnAssignBoat',
      icon: ICONS.assign,
      title: 'Assign boat',
      subtitle: 'Assign a vessel to this berth',
      onClick: () => { close(); handlers.onAssignBoat?.(berth); }
    }));
  } else {
    sheet.appendChild(item({
      id: 'btnReleaseBoat',
      icon: ICONS.release,
      title: 'Release boat',
      subtitle: 'Remove vessel from this berth',
      onClick: () => { close(); handlers.onReleaseBoat?.(berth); }
    }));
  }

  // --- Berth info (spacer 16dp) ---
  sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-16' }));

  sheet.appendChild(item({
    id: 'btnViewBerth',
    icon: ICONS.info,
    title: 'View berth',
    subtitle: 'View berth details and utilities',
    onClick: () => { close(); handlers.onViewBerth?.(berth); }
  }));

  sheet.appendChild(item({
    id: 'btnEditBerth',
    icon: ICONS.edit,
    title: 'Edit berth',
    subtitle: 'Update berth details',
    onClick: () => { close(); handlers.onEditBerth?.(berth); }
  }));

  // --- Delete (spacer 16dp) ---
  sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-16' }));

  sheet.appendChild(item({
    id: 'btnDeleteBerth',
    icon: ICONS.delete,
    title: 'Delete berth',
    subtitle: 'Permanently remove this berth',
    danger: true,
    onClick: () => { close(); handlers.onDeleteBerth?.(berth); }
  }));

  document.getElementById('modalRoot').append(backdrop, sheet);
  backdrop.addEventListener('click', close);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });
}