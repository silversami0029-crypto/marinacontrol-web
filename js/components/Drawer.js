// js/components/Drawer.js
// Left-side navigation drawer — mirrors the Android slide-out menu

import { store } from '../store.js';
import { toast } from '../ui/toast.js';

const ICONS = {
  quick: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>`,
  operations: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
  finance: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="21" x2="21" y2="21"/>
      <path d="M5 21V10l7-7 7 7v11"/>
      <line x1="9" y1="21" x2="9" y2="14"/>
      <line x1="15" y1="21" x2="15" y2="14"/>
    </svg>`,
  customers: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
  staff: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21a8 8 0 0 1 16 0"/>
    </svg>`,
  reports: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="18" y1="20" x2="18" y2="6"/>
    </svg>`,
  settings: `
    <svg class="drawer-section-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
  chevron: `
    <svg class="drawer-chevron" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`
};

const SECTIONS = [
  {
    id: 'quick',
    title: 'QUICK ACTIONS',
    icon: ICONS.quick,
    items: [
      { id: 'assign-berth',   label: 'Assign Berth',    route: '#/berths' },
      { id: 'ai-mechanic',    label: 'AI Mechanic',     toast: 'AI Mechanic is coming to the web app' },
      { id: 'create-invoice', label: 'Create Invoice',  toast: 'Create Invoice is coming to the web app' },
      { id: 'add-task',       label: 'Add Task',        toast: 'Add Task is coming to the web app' },
      { id: 'log-inspection', label: 'Log Inspection',  toast: 'Log Inspection is coming to the web app' }
    ]
  },
  {
    id: 'operations',
    title: 'OPERATIONS',
    icon: ICONS.operations,
    items: [
      { id: 'fleet-overview',   label: 'Fleet Overview',     route: '#/fleet' },
      { id: 'berth-management', label: 'Berth Management',   route: '#/berths' },
      { id: 'maintenance',      label: 'Maintenance',        toast: 'Maintenance is coming to the web app' },
      { id: 'safety',           label: 'Safety Inspections', toast: 'Safety Inspections is coming to the web app' }
    ]
  },
  {
    id: 'finance',
    title: 'FINANCE',
    icon: ICONS.finance,
    items: [
      { id: 'invoices',     label: 'Invoices & Payments',  toast: 'Invoices & Payments is coming to the web app' },
      { id: 'revenue',      label: 'Revenue Summary',      toast: 'Revenue Summary is coming to the web app' },
      { id: 'outstanding',  label: 'Outstanding Payments', toast: 'Outstanding Payments is coming to the web app' }
    ]
  },
  {
    id: 'customers',
    title: 'CUSTOMERS',
    icon: ICONS.customers,
    items: [
      { id: 'add-customer',    label: 'Add Customer',       toast: 'Add Customer is coming to the web app' },
      { id: 'customer-dir',    label: 'Customer Directory', toast: 'Customer Directory is coming to the web app' },
      { id: 'live-360',        label: 'Live 360',           toast: 'Live 360 is coming to the web app' }
    ]
  },
  {
    id: 'staff',
    title: 'STAFF',
    icon: ICONS.staff,
    items: [
        { id: 'user-mgmt',        label: 'User Management',     route: '#/user-management' },
      { id: 'crew-mgmt',        label: 'Crew Management',     toast: 'Crew Management is coming to the web app' },
      { id: 'permissions',      label: 'Permissions & Roles', toast: 'Permissions & Roles is coming to the web app' },
      { id: 'shift-schedule',   label: 'Shift Schedule',      toast: 'Shift Schedule is coming to the web app' }
    ]
  },
  {
    id: 'reports',
    title: 'REPORTS',
    icon: ICONS.reports,
    items: [
      { id: 'daily-report', label: 'Daily Report',      toast: 'Daily Report is coming to the web app' },
      { id: 'occupancy',    label: 'Occupancy Trends',  toast: 'Occupancy Trends is coming to the web app' },
      { id: 'export-data',  label: 'Export Data',       toast: 'Export Data is coming to the web app' }
    ]
  },
  {
    id: 'settings',
    title: 'SETTINGS & SUPPORT',
    icon: ICONS.settings,
    items: [
      { id: 'account',      label: 'Account',              route: '#/account' },
      { id: 'subscription', label: 'Manage Subscription',  toast: 'Manage Subscription is coming to the web app' },
      { id: 'billing',      label: 'Billing History',      toast: 'Billing History is coming to the web app' },
      { id: 'notifications',label: 'Notifications',        toast: 'Notifications is coming to the web app' },
      { id: 'help',         label: 'Help Center',          toast: 'Help Center is coming to the web app' },
      { id: 'emergency',    label: 'Emergency Contacts',   toast: 'Emergency Contacts is coming to the web app' },
      { id: 'about',        label: 'About',                toast: 'About is coming to the web app' }
    ]
  }
];

let drawerOpen = false;
let lastSelectedId = null;

export function initDrawer() {
  const backdrop = document.getElementById('drawerBackdrop');
  const drawer   = document.getElementById('appDrawer');
  if (!drawer || !backdrop) return;

  const scroll = drawer.querySelector('.drawer-scroll');
  scroll.innerHTML = SECTIONS.map(renderSection).join('') + renderUserRow();

  drawer.querySelectorAll('.drawer-item').forEach(el => {
    el.addEventListener('click', () => {
      const route    = el.dataset.route;
      const toastMsg = el.dataset.toast;
      const itemId   = el.dataset.itemId;

      lastSelectedId = itemId;
      closeDrawer();                    // ← close first

      if (route) {
        location.hash = route;
      } else if (toastMsg) {
        toast(toastMsg);
      }
    });
  });

  // Section collapse toggles
  drawer.querySelectorAll('.drawer-section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.drawer-section').classList.toggle('is-collapsed');
    });
  });

  // Item clicks
  drawer.querySelectorAll('.drawer-item').forEach(el => {
    el.addEventListener('click', () => {
      const route    = el.dataset.route;
      const toastMsg = el.dataset.toast;
      const itemId   = el.dataset.itemId;

      // Remember selection
      lastSelectedId = itemId;
      applySelection();

      // Navigate or toast — but keep drawer open
      if (route) {
        location.hash = route;
      } else if (toastMsg) {
        toast(toastMsg);
      }
    });
  });

  // User row
  drawer.querySelector('.drawer-user')?.addEventListener('click', () => {
    closeDrawer();
    location.hash = '#/account';
  });

  backdrop.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen) closeDrawer();
  });

  const btn = document.getElementById('btnTopMenu');
  if (btn && btn.dataset.drawerWired !== '1') {
    btn.dataset.drawerWired = '1';
    btn.addEventListener('click', toggleDrawer);
  }

  // Sync highlight on route changes
  window.addEventListener('hashchange', applySelection);
}

function renderSection(section) {
  return `
    <div class="drawer-section is-collapsed" data-section="${section.id}">
      <button class="drawer-section-header">
        <span class="drawer-section-icon-wrap">${section.icon}</span>
        <span class="drawer-section-title">${section.title}</span>
        ${ICONS.chevron}
      </button>

      <div class="drawer-section-items">
        ${section.items.map(item => `
          <button class="drawer-item"
                  data-item-id="${item.id}"
                  ${item.route ? `data-route="${item.route}"` : ''}
                  ${item.toast ? `data-toast="${escapeAttr(item.toast)}"` : ''}>
            <span class="drawer-item-bullet">•</span>
            <span class="drawer-item-label">${escapeHtml(item.label)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderUserRow() {
  const profile = store.userProfile || {};
  const name    = profile.name  || 'User';
  const email   = profile.email || '';
  const role    = profile.role  || '';
  const initials = computeInitials(name);
  const subtitle = role || email || '';

  return `
    <div class="drawer-user">
      <div class="drawer-user-avatar">${escapeHtml(initials)}</div>
      <div class="drawer-user-info">
        <div class="drawer-user-name">${escapeHtml(name)}</div>
        ${subtitle ? `<div class="drawer-user-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      </div>
    </div>
  `;
}

function computeInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Update the pill highlight on the currently selected item.
 * Priority: last tapped item → falls back to matching the current route.
 */
export function applySelection() {
  const drawer = document.getElementById('appDrawer');
  if (!drawer) return;

  // Clear all highlights
  drawer.querySelectorAll('.drawer-item').forEach(el => {
    el.classList.remove('is-active');
  });

  let target = null;

  // 1. Last tapped item
  if (lastSelectedId) {
    target = drawer.querySelector(`.drawer-item[data-item-id="${lastSelectedId}"]`);
  }

  // 2. Fallback — match current route
  if (!target) {
    const hash  = (location.hash || '').replace(/^#/, '');
    const route = '/' + hash.split('?')[0].replace(/^\//, '');
    target = drawer.querySelector(`.drawer-item[data-route="#${route}"]`);
  }

  if (!target) return;

  target.classList.add('is-active');

  // Auto-expand its section
  const section = target.closest('.drawer-section');
  if (section) section.classList.remove('is-collapsed');
}

export function toggleDrawer() {
  if (drawerOpen) {
    closeDrawer();
  } else {
    applySelection();
    openDrawer();
  }
}

function openDrawer() {
  drawerOpen = true;
  document.getElementById('drawerBackdrop')?.classList.add('is-open');
  document.getElementById('appDrawer')?.classList.add('is-open');
}

function closeDrawer() {
  drawerOpen = false;
  document.getElementById('drawerBackdrop')?.classList.remove('is-open');
  document.getElementById('appDrawer')?.classList.remove('is-open');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}