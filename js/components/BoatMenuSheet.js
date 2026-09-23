// js/components/BoatMenuSheet.js
// Bottom sheet mirroring bottomsheet_boat_menu.xml + showMenu() in BoatFragment

import { esc } from '../utils.js';

// --- Icons (Material style inline SVG) ---
const ICONS = {
  dashboard: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>`,

  notes: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <line x1="4" y1="7"  x2="20" y2="7"/>
    <line x1="4" y1="12" x2="20" y2="12"/>
    <line x1="4" y1="17" x2="14" y2="17"/>
  </svg>`,

  person: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 21a8 8 0 0 1 16 0"/>
  </svg>`,

  edit: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 20h4l10-10-4-4L4 16v4z"/>
    <line x1="14" y1="6" x2="18" y2="10"/>
  </svg>`,

  photo: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2"/>
    <circle cx="8.5" cy="9.5" r="1.5"/>
    <path d="M21 15l-5-5L5 21"/>
  </svg>`,

  mic: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M5 11a7 7 0 0 0 14 0"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
  </svg>`,

  star: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="#F5C542" stroke="none">
    <path d="M12 2l2.9 6.9L22 10l-5.5 5.1L18 22l-6-3.3L6 22l1.5-6.9L2 10l7.1-1.1z"/>
  </svg>`,

  delete: `<svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
    stroke="#E5484D" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
    <line x1="10" y1="11" x2="10" y2="17"/>
    <line x1="14" y1="11" x2="14" y2="17"/>
  </svg>`,

  chevron: `<svg class="sheet-chevron" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 6 15 12 9 18"/>
  </svg>`
};

function item({ id, icon, title, subtitle, onClick }) {
  const el = document.createElement('div');
  el.className = 'sheet-item';
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

export function showBoatMenu(boat, handlers = {}) {
  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  // Sheet
  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  // Handle + title
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">Boat</div>
  `;

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  // Items
  sheet.appendChild(item({
    id: 'btnOpenDashboard',
    icon: ICONS.dashboard,
    title: 'Open dashboard',
    subtitle: 'View vessel dashboard and operations',
    onClick: () => { close(); handlers.onDashboard?.(boat); }
  }));

 /* sheet.appendChild(item({
    id: 'btnBoatNotes',
    icon: ICONS.notes,
    title: 'Boat notes',
    subtitle: 'View notes',
    onClick: () => { close(); handlers.onNotes?.(boat); }
  }));*/

  sheet.appendChild(item({
    id: 'btnAssignCustomer',
    icon: ICONS.person,
    title: 'Assign customer',
    subtitle: 'Link this vessel to a customer',
    onClick: () => { close(); handlers.onAssignCustomer?.(boat); }
  }));

  // spacer
  sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-16' }));

  sheet.appendChild(item({
    id: 'btnEditBoat',
    icon: ICONS.edit,
    title: 'Edit boat',
    subtitle: 'Update vessel details',
    onClick: () => { close(); handlers.onEdit?.(boat); }
  }));

  /*sheet.appendChild(item({
    id: 'btnBoatPhoto',
    icon: ICONS.photo,
    title: boat.hasPhoto() ? 'Photo options' : 'Add Photo',
    subtitle: 'Add & Manage vessel photo',
    onClick: () => { close(); handlers.onPhoto?.(boat); }
  }));

  sheet.appendChild(item({
    id: 'btnBoatVoice',
    icon: ICONS.mic,
    title: boat.hasVoiceNote() ? 'Voice options' : 'Add Voice Note',
    subtitle: 'Add or manage voice note',
    onClick: () => { close(); handlers.onVoice?.(boat); }
  }));*/

  // Set active only if not already active
  if (!boat.isActive) {
    sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-16' }));
    sheet.appendChild(item({
      id: 'btnSetActive',
      icon: ICONS.star,
      title: 'Set active',
      subtitle: 'Make this the active vessel',
      onClick: () => { close(); handlers.onSetActive?.(boat); }
    }));
  }

  // spacer before delete
  sheet.appendChild(Object.assign(document.createElement('div'), { className: 'sheet-gap-8' }));

  sheet.appendChild(item({
    id: 'btnDeleteBoat',
    icon: ICONS.delete,
    title: 'Delete boat',
    subtitle: 'Remove this vessel',
    onClick: () => { close(); handlers.onDelete?.(boat); }
  }));

  // Mount
  document.getElementById('modalRoot').append(backdrop, sheet);
  backdrop.addEventListener('click', close);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });
}