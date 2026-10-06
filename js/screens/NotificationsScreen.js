import { t as tr, getLocale as uiLocale } from '../i18n.js';
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
      <button id="ntBack" class="nt-back" aria-label="${tr("Back")}">&#8249;</button>
      <div class="nt-title">${tr("Notifications")}</div>
      <button id="ntMarkAll" class="nt-action">${tr("Mark all read")}</button>
    </div>
    <div class="nt-filters">
      <button class="nt-chip is-active" data-filter="ALL">${tr("All")}</button>
      <button class="nt-chip" data-filter="BOOKING">${tr("Bookings")}</button>
      <button class="nt-chip" data-filter="TASK">${tr("Tasks")}</button>
      <button class="nt-chip" data-filter="INVENTORY">${tr("Stock")}</button>
      <button class="nt-chip" data-filter="EQUIPMENT">${tr("Equipment")}</button>
      <button class="nt-chip" data-filter="DOCUMENT">${tr("Documents")}</button>
      <button class="nt-chip" data-filter="DOCK_WALK">${tr("Dock Walk")}</button>
    </div>
    <div id="ntList" class="nt-list"></div>
    <button id="ntClear" class="nt-clear">${tr("Remove read notifications")}</button>`;

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

  const clearButton = document.getElementById('ntClear');
  if (clearButton) clearButton.disabled = !store.notifications.some(n => n.read);

  if (!items.length) {
    listEl.innerHTML = `<div class="nt-empty">${tr("No notifications")}</div>`;
    return;
  }

  listEl.innerHTML = items.map(n => `
    <button class="nt-card${n.read ? '' : ' is-unread'}" data-id="${escapeHtml(n._docId)}">
      <div class="nt-card-top">
        <span class="nt-type">${escapeHtml(formatType(n.type))}</span>
        <span class="nt-time">${relativeTime(Number(n.createdAt || 0))}</span>
      </div>
      <div class="nt-card-title">${escapeHtml(tr(n.title || ''))}</div>
      <div class="nt-message">${notificationMessage(n)}</div>
    </button>`).join('');

  listEl.querySelectorAll('.nt-card').forEach(card => {
    card.onclick = () => openNotification(items.find(n => n._docId === card.dataset.id));
  });
}

async function openNotification(item) {
  if (!item) return;
  if (!item.read) await updateDoc(doc(db, 'notifications', item._docId), { read: true });
  const type = String(item.type || '');
  if (type.startsWith('BOOKING')) {
    location.hash = '#/booking-requests';
  }
  else if (type.startsWith('INVENTORY')) location.hash = '#/inventory';
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
  const names = { BOOKING_REQUEST:'Booking request', BOOKING_REPLY:'Owner reply',
    BOOKING_REPLY_REVIEW:'Reply needs review' };
  return tr(names[type] || String(type || 'Notification').replaceAll('_', ' '));
}

function notificationMessage(item) {
  const raw = String(item.message || '');
  // Translate generated labels only; isolate vessel names and references.
  if (!String(item.type || '').startsWith('BOOKING')) {
    return `<bdi dir="auto">${escapeHtml(raw)}</bdi>`;
  }
  return raw.split(' · ').map(part => {
    if (part.startsWith('Reference: ')) {
      return escapeHtml(tr('Reference')) + ': <bdi dir="ltr">' +
        escapeHtml(part.slice(11)) + '</bdi>';
    }
    return `<bdi dir="auto">${escapeHtml(tr(part))}</bdi>`;
  }).join(' · ');
}

function relativeTime(ts) {
  if (!ts) return '';
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  const formatter = new Intl.RelativeTimeFormat(uiLocale(), {numeric:'auto'});
  if (mins < 1) return escapeHtml(tr('ui.justNow'));
  if (mins < 60) return escapeHtml(formatter.format(-mins, 'minute'));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return escapeHtml(formatter.format(-hours, 'hour'));
  return escapeHtml(formatter.format(-Math.floor(hours / 24), 'day'));
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

    .nt-card{display:block;width:100%;margin:0 0 10px;padding:14px;text-align:start;background:var(--color-surface);border:1px solid var(--color-divider);border-radius:10px;color:var(--color-text-primary)}
    .nt-card.is-unread{border-inline-start:4px solid var(--color-accent)}.nt-card-top{display:flex;justify-content:space-between;gap:10px}.nt-type{font-size:11px;font-weight:700;color:var(--color-accent)}
    .nt-time{font-size:11px;color:var(--color-text-muted)}.nt-card-title{font-size:14px;font-weight:700;margin-top:8px}.nt-message{overflow-wrap:anywhere;font-size:13px;color:var(--color-text-secondary);margin-top:5px;line-height:1.35}
    .nt-empty{text-align:center;color:var(--color-text-secondary);padding:70px 10px}
    .nt-clear{position:static;display:block;margin-block:16px 32px;margin-inline: auto 18px;padding:10px 16px;border:1px solid var(--color-divider,#394654);border-radius:8px;background:transparent;cursor:pointer}
    .nt-clear:disabled{opacity:.4;cursor:default}`;
  document.head.appendChild(style);
}
