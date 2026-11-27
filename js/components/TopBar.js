import { isDockMaster, roleLabel, isStaffWorkUser } from '../roles.js';
import { italianUI as itUI } from '../i18n.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { t } from '../i18n.js';
// js/components/TopBar.js
import { store } from '../store.js';
import { toggleDrawer, goHome } from './Drawer.js';
import {
  collection, onSnapshot, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let notificationUnsubscribe = null;
let notificationKey = '';

const TITLES = {
  '/boats':     'MarinaControl',
  '/dashboard': 'MarinaControl',
  '/berths':    'MarinaControl',
  '/fleet':     'MarinaControl',
  '/account':   'MarinaControl',
  '/notifications': 'MarinaControl',
};

export function renderTopBar(route) {
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = store.activeMarina?.name || TITLES[route] || itUI('MarinaControl');

  wireDrawerButton();
  wireHomeLinks();
  renderMarinaSelector();
  const syncEl = document.getElementById('topbarSync');
  if (!syncEl) return;

  renderNetworkStatus();
  watchNetworkStatus();

  const dockMaster = isDockMaster();
  const bell = document.getElementById('btnBell');
  if (bell) { bell.hidden = dockMaster; bell.style.display = dockMaster ? 'none' : ''; }
  if (dockMaster) { notificationUnsubscribe?.(); notificationUnsubscribe = null; notificationKey = ''; store.notifications = []; updateBadge(); }
  else { wireBell(); listenForNotifications(); }
}

// This is browser connectivity, never a claim that all records have synced.
let networkStatusWatching = false;
export function renderNetworkStatus() {
  const el = document.getElementById('topbarSync');
  if (!el) return;
  const offline = navigator.onLine === false;
  el.textContent = t(offline ? 'Offline' : 'Online');
  el.title = t('Browser connection status only. Check pending work for sync confirmation.');
  el.setAttribute('role', 'status');
  const dot = el.parentElement?.querySelector('.status-dot');
  if (dot) dot.style.backgroundColor = offline ? '#ff9800' : '#34d399';
}
function watchNetworkStatus() {
  if (networkStatusWatching) return;
  networkStatusWatching = true;
  window.addEventListener('online', renderNetworkStatus);
  window.addEventListener('offline', renderNetworkStatus);
  window.addEventListener('focus', renderNetworkStatus);
  // Some environments delay connectivity events; reread the browser signal.
  setInterval(renderNetworkStatus, 1000);
}

function wireBell() {
  const bell = document.getElementById('btnBell');
  if (!bell) return;
  bell.setAttribute('aria-label', t('Notifications'));
  if (bell.dataset.wired === '1') return;
  bell.dataset.wired = '1';
  bell.style.position = 'relative';
  bell.addEventListener('click', () => { location.hash = '#/notifications'; });
}

function listenForNotifications() {
  const clientId = Number(store.activeClientId || 0);
  const uid = store.authUser?.uid || '';
  const recipient = (store.userProfile?.name || '').trim();
  const key = uid && clientId ? `${uid}:${clientId}:${recipient}` : '';
  if (key === notificationKey) return;
  notificationUnsubscribe?.();
  notificationKey = key;
  notificationUnsubscribe = null;
  store.notifications = [];
  updateBadge();
  if (!key) return;
  const results = new Map();
  const stops = [];
  const publish = () => {
    if (key !== notificationKey || clientId !== Number(store.activeClientId)) return;
    const merged = new Map();
    results.forEach(items => items.forEach(n => merged.set(n._docId, n)));
    store.notifications = [...merged.values()].filter(n => !isStaffWorkUser() || n.type === 'STAFF_WORK').sort((a,b) => Number(b.createdAt || 0)-Number(a.createdAt || 0));
    updateBadge();
    store.emit();
  };
  const listen = (field, value) => {
    stops.push(onSnapshot(query(collection(db, 'notifications'), where('clientId', '==', clientId), where(field, '==', value)), snap => {
      if (key !== notificationKey) return;
      results.set(field, snap.docs.map(d => ({...d.data(),_docId:d.id})).filter(n => !n.recipientUid || n.recipientUid === uid));
      publish();
    }, err => console.error('[notifications] listen failed', field, err)));
  };
  // Stable identity for booking alerts; keep legacy name-based alerts.
  listen('recipientUid', uid);
  if (recipient && !isStaffWorkUser()) listen('recipient', recipient);
  notificationUnsubscribe = () => stops.forEach(stop => stop());
}

function updateBadge() {
  const bell = document.getElementById('btnBell');
  if (!bell) return;
  let badge = bell.querySelector('.topbar-badge');
  const count = store.notifications.filter(n => !n.read).length;
  if (!count) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'topbar-badge';
    Object.assign(badge.style, {
      position:'absolute', top:'1px', right:'1px', minWidth:'17px', height:'17px',
      padding:'0 4px', borderRadius:'9px', background:'#F44336', color:'#fff',
      fontSize:'10px', fontWeight:'700', lineHeight:'17px', textAlign:'center'
    });
    bell.appendChild(badge);
  }
  badge.textContent = count > 99 ? '99+' : String(count);
}

/* ---------- Wire hamburger to open drawer ---------- */
function wireDrawerButton() {
  const btn = document.getElementById('btnTopMenu');
  if (!btn) return;
  if (!document.getElementById('topbarLogoStyles')) {
    const style = document.createElement('style');
    style.id = 'topbarLogoStyles';
    style.textContent = `
      #btnTopMenu .topbar-desktop-logo { display:none; }
      @media (min-width:768px) {
        #btnTopMenu { display:grid !important;place-items:center;flex-shrink:0;width:44px;height:44px; }
        #btnTopMenu > svg, #btnTopMenu .topbar-mobile-menu { display:none !important; }
        #btnTopMenu .topbar-desktop-logo { display:block;width:36px;height:36px;object-fit:contain; }
      }
    `;
    document.head.appendChild(style);
  }
  if (!btn.querySelector('.topbar-desktop-logo')) {
    Array.from(btn.children).forEach(child => child.classList.add('topbar-mobile-menu'));
    const logo = document.createElement('img');
    logo.className = 'topbar-desktop-logo';
    logo.src = new URL('../../assets/icons/marina_logo.png', import.meta.url).href;
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    logo.addEventListener('error', () => {
      logo.remove();
      document.getElementById('topbarLogoStyles')?.remove();
    }, { once:true });
    btn.appendChild(logo);
  }
  const desktopHome = window.matchMedia('(min-width:768px)').matches
    && !!btn.querySelector('.topbar-desktop-logo');
  btn.setAttribute('aria-label', t(desktopHome ? 'Home' : 'Menu'));
  if (btn.dataset.drawerWired === '1') return;
  btn.dataset.drawerWired = '1';
  btn.addEventListener('click', () => {
    if (window.matchMedia('(min-width:768px)').matches
        && btn.querySelector('.topbar-desktop-logo')) goHome();
    else toggleDrawer();
  });
}

// Wire now if DOM is ready, otherwise wait
if (document.readyState !== 'loading') {
  wireDrawerButton();
} else {
  document.addEventListener('DOMContentLoaded', wireDrawerButton);
}

function renderMarinaSelector() {
  const title = document.getElementById('topbarTitle');
  if (!title) return;
  let button = document.getElementById('marinaSelector');
  if (button && button.tagName !== 'BUTTON') { button.remove(); button = null; }
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.id = 'marinaSelector';
    button.className = 'marina-selector';
    button.setAttribute('aria-label', itUI('Manage and switch marinas'));
    button.setAttribute('aria-haspopup', 'dialog');
    button.style.cssText = 'display:block;max-width:260px;width:100%;min-width:0;height:32px;padding:4px 8px;border:1px solid #AEB6C1;border-radius:6px;background:#1C222A;color:#F5F7F9;font:inherit;font-size:14px;text-align:start;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
    title.after(button);
    button.addEventListener('click', async () => {
      try {
        const { showManageMarinasSheet } = await import('../screens/ManageMarinasSheet.js');
        showManageMarinasSheet();
      } catch (error) { console.error('Marina sheet failed', error); alert(tr('Unable to open marina management. Please refresh and try again.')); }
    });
  }
  title.hidden = !!store.activeMarina;
  button.textContent = `${store.activeMarina?.name || t('Marinas')} · ${t(roleLabel(store.activeRole || 'staff'))} ▾`;
  button.hidden = !store.activeMarina;
  button.style.display = button.hidden ? 'none' : 'block';
  button.disabled = store.marinaSwitching;
}

export function resetTopBarNotifications() {
  notificationUnsubscribe?.();
  notificationUnsubscribe = null;
  notificationKey = '';
  store.notifications = [];
  updateBadge();
}

// Branding returns to Boats; the marina selector keeps its own action.
function wireHomeLinks() {
  document.querySelectorAll('#topbarLogo, #topbarTitle, .topbar-app-name')
    .forEach(element => {
      element.setAttribute('role', 'link');
      element.setAttribute('tabindex', '0');
      element.setAttribute('aria-label', t('Home'));
      element.setAttribute('title', t('Home'));
      element.style.cursor = 'pointer';
      if (element.dataset.homeWired === '1') return;
      element.dataset.homeWired = '1';
      element.addEventListener('click', goHome);
      element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goHome();
        }
      });
    });
}
