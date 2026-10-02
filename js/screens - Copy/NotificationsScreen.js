// js/screens/NotificationsScreen.js
import { store } from '../store.js';
import { doc, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribeStore = null;
let filter = 'ALL';

export function mountNotificationsScreen() {
  if (unsubscribeStore) unsubscribeStore();
  filter = 'ALL';
  ensureStyles();

  document.getElementById('screen').innerHTML = `
    <div class="nt-head">
      <button id="ntBack" class="nt-back" aria-label="Back">&#8249;</button>
      <div class="nt-title">Notifications</div>
      <button id="ntMarkAll" class="nt-action">Mark all read</button>
    </div>
    <div class="nt-filters">
      <button class="nt-chip is-active" data-filter="ALL">All</button>
      <button class="nt-chip" data-filter="TASK">Tasks</button>
      <button class="nt-chip" data-filter="INVENTORY">Stock</button>
      <button class="nt-chip" data-filter="EQUIPMENT">Equipment</button>
      <button class="nt-chip" data-filter="DOCUMENT">Documents</button>
      <button class="nt-chip" data-filter="DOCK_WALK">Dock Walk</button>
    </div>
    <div id="ntList" class="nt-list"></div>
    <button id="ntClear" class="nt-clear">Clear read</button>`;

  document.getElementById('ntBack').onclick = () => history.back();
  document.getElementById('ntMarkAll').onclick = markAllRead;
  document.getElementById('ntClear').onclick = clearRead;
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.onclick = () => {
      filter = btn.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(b =>
        b.classList.toggle('is-active', b === btn));
      render();
    };
  });

  unsubscribeStore = store.subscribe(render);
  render();
}

function render() {
  const listEl = document.getElementById('ntList');
  if (!listEl) return;
  const items = store.notifications.filter(n =>
    filter === 'ALL' || String(n.type || '').startsWith(filter));

  if (!items.length) {
    listEl.innerHTML = '<div class="nt-empty">No notifications</div>';
    return;
  }

  listEl.innerHTML = items.map(n => `
    <button class="nt-card${n.read ? '' : ' is-unread'}" data-id="${escapeHtml(n._docId)}">
      <div class="nt-card-top">
        <span class="nt-type">${escapeHtml(formatType(n.type))}</span>
        <span class="nt-time">${relativeTime(Number(n.createdAt || 0))}</span>
      </div>
      <div class="nt-card-title">${escapeHtml(n.title || '')}</div>
      <div class="nt-message">${escapeHtml(n.message || '')}</div>
    </button>`).join('');

  listEl.querySelectorAll('.nt-card').forEach(card => {
    card.onclick = () => openNotification(items.find(n => n._docId === card.dataset.id));
  });
}

async function openNotification(item) {
  if (!item) return;
  if (!item.read) await updateDoc(doc(db, 'notifications', item._docId), { read: true });
  const type = String(item.type || '');
  if (type.startsWith('INVENTORY')) location.hash = '#/inventory';
  else if (type.startsWith('EQUIPMENT')) location.hash = '#/equipment';
  else if (type.startsWith('DOCUMENT')) location.hash = '#/documents';
  else if (type.startsWith('DOCK_WALK')) location.hash = '#/berths';
  else location.hash = '#/maintenance';
}

async function markAllRead() {
  await Promise.all(store.notifications.filter(n => !n.read)
    .map(n => updateDoc(doc(db, 'notifications', n._docId), { read: true })));
}

async function clearRead() {
  await Promise.all(store.notifications.filter(n => n.read)
    .map(n => deleteDoc(doc(db, 'notifications', n._docId))));
}

function formatType(type) {
  return String(type || 'NOTIFICATION').replaceAll('_', ' ');
}

function relativeTime(ts) {
  if (!ts) return '';
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function ensureStyles() {
  if (document.getElementById('notificationStyles')) return;
  const style = document.createElement('style');
  style.id = 'notificationStyles';
  style.textContent = `
    .nt-head{display:flex;align-items:center;gap:10px;padding:16px 18px 10px}.nt-back{font-size:34px;color:var(--color-text-primary)}
    .nt-title{font-size:20px;font-weight:700;flex:1}.nt-action,.nt-clear{color:var(--color-accent);font-size:13px}


.nt-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 18px 14px;
}

.nt-chip {
  flex: none;
  border: 1px solid var(--color-divider);
  border-radius: 15px;
  padding: 5px 8px;
  color: var(--color-text-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.nt-chip.is-active {
  background: var(--color-accent, #2f9cf4);
  border-color: var(--color-accent, #2f9cf4);
  color: #fff;
  font-weight: 700;
}

.nt-chip:active {
  transform: scale(.96);
}

.nt-list { padding: 0 18px 10px; }

.nt-clear {
  display: block;
  margin: 16px auto 90px;
  padding: 10px 16px;
}

    .nt-card{display:block;width:100%;margin:0 0 10px;padding:14px;text-align:left;background:var(--color-surface);border:1px solid var(--color-divider);border-radius:10px;color:var(--color-text-primary)}
    .nt-card.is-unread{border-left:4px solid var(--color-accent)}.nt-card-top{display:flex;justify-content:space-between;gap:10px}.nt-type{font-size:11px;font-weight:700;color:var(--color-accent)}
    .nt-time{font-size:11px;color:var(--color-text-muted)}.nt-card-title{font-size:14px;font-weight:700;margin-top:8px}.nt-message{font-size:13px;color:var(--color-text-secondary);margin-top:5px;line-height:1.35}
    .nt-empty{text-align:center;color:var(--color-text-secondary);padding:70px 10px}.nt-clear{display:block;margin:-72px auto 90px;padding:10px 16px}`;
  document.head.appendChild(style);
}
