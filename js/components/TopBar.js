// js/components/TopBar.js
import { store } from '../store.js';
import { formatSyncTime } from '../utils.js';
import { toggleDrawer } from './Drawer.js';
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
  if (titleEl) titleEl.textContent = store.activeMarina?.name || TITLES[route] || 'MarinaControl';

  renderMarinaSelector();
  const syncEl = document.getElementById('topbarSync');
  if (!syncEl) return;

  syncEl.textContent = store.syncTime
    ? `Online · Synced ${formatSyncTime(store.syncTime)}`
    : 'Online';

  wireBell();
  listenForNotifications();
}

function wireBell() {
  const bell = document.getElementById('btnBell');
  if (!bell || bell.dataset.wired === '1') return;
  bell.dataset.wired = '1';
  bell.style.position = 'relative';
  bell.addEventListener('click', () => { location.hash = '#/notifications'; });
}

function listenForNotifications() {
  const clientId = Number(store.activeClientId || 0);
  const recipient = (store.userProfile?.name || '').trim();
  const key = store.authUser && clientId && recipient ? `${store.authUser.uid}:${clientId}:${recipient}` : '';
  if (key === notificationKey) return;

  if (notificationUnsubscribe) notificationUnsubscribe();
  notificationKey = key;
  notificationUnsubscribe = null;
  store.notifications = [];
  updateBadge();
  if (!key) return;

  notificationUnsubscribe = onSnapshot(query(
    collection(db, 'notifications'),
    where('clientId', '==', clientId),
    where('recipient', '==', recipient)
  ), snap => {
    if (key !== notificationKey || clientId !== Number(store.activeClientId)) return;
    store.notifications = snap.docs.map(d => ({ _docId: d.id, ...d.data() }))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    updateBadge();
    store.emit();
  }, err => console.error('[notifications] listen failed', err));
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
    button.setAttribute('aria-label', 'Manage and switch marinas');
    button.setAttribute('aria-haspopup', 'dialog');
    button.style.cssText = 'display:block;max-width:260px;width:100%;min-width:0;height:32px;padding:4px 8px;border:1px solid #AEB6C1;border-radius:6px;background:#1C222A;color:#F5F7F9;font:inherit;font-size:14px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
    title.after(button);
    button.addEventListener('click', async () => {
      try {
        const { showManageMarinasSheet } = await import('../screens/ManageMarinasSheet.js');
        showManageMarinasSheet();
      } catch (error) { console.error('Marina sheet failed', error); alert('Unable to open marina management. Please refresh and try again.'); }
    });
  }
  title.hidden = !!store.activeMarina;
  button.textContent = `${store.activeMarina?.name || 'Marinas'} · ${store.activeRole || 'staff'} ▾`;
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
