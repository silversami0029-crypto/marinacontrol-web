// js/screens/UserManagementScreen.js
// User Management — mirrors fragment_user_management.xml + UserManagementFragment.java

import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { listenForUsers } from '../db.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { app } from '../firebase.js';

const functions = getFunctions(app, 'us-central1');

let unsubscribe = null;

const ROLES = ['admin', 'manager', 'staff', 'inspector', 'viewer'];

export function mountUserManagementScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML =
      `<div class="boats-empty">
         <h2>No client assigned</h2>
       </div>`;
    return;
  }

  const screen = document.getElementById('screen');
  screen.innerHTML = `
    <div class="um-header">
      <div class="um-header-row">
        <div class="um-pill">User Management</div>
        <button class="um-icon-btn" id="umHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="um-header-spacer"></div>
        <button class="um-icon-btn" id="umClose" aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="um-invite-row">
      <span class="um-invite-label">Invite Code:</span>
      <span class="um-invite-code" id="umInviteCode">Loading…</span>
      <button class="um-copy-btn" id="umCopyBtn" disabled>Copy</button>
    </div>

    <div class="um-list" id="umList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="um-fab" id="umFabAdd" aria-label="Add user">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('umClose').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  document.getElementById('umHelp').addEventListener('click', () => {
    toast('Help coming soon');
  });

  document.getElementById('umFabAdd').addEventListener('click', () => {
    toast('Add user coming soon');
  });

  const copyBtn = document.getElementById('umCopyBtn');

  copyBtn.addEventListener('click', () => {
    const code = document.getElementById('umInviteCode').textContent;
    if (!code || code === 'Unavailable' || code === 'Loading…') return;
    navigator.clipboard.writeText(code);
    toast('Invite code copied', { kind: 'success' });
  });

  copyBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    rotateInviteCode();
  });

  loadInviteCode();

  if (unsubscribe) unsubscribe();
  unsubscribe = listenForUsers(store.activeClientId, (users, err) => {
    if (err) {
      document.getElementById('umList').innerHTML =
        `<div class="boats-empty">
           <h2>Couldn't load users</h2>
           <p>${err.message || 'Permission denied.'}</p>
         </div>`;
      return;
    }
    renderUserList(users);
  });
}

/* ============================================================
   INVITE CODE
   ============================================================ */
async function loadInviteCode() {
  const el = document.getElementById('umInviteCode');
  const btn = document.getElementById('umCopyBtn');
  el.textContent = 'Loading…';
  btn.disabled = true;

  try {
    const callable = httpsCallable(functions, 'getMarinaInvite');
    const res = await callable({ clientId: Number(store.activeClientId) });
    const code = res?.data?.inviteCode || 'Unavailable';
    el.textContent = code;
    btn.disabled = code === 'Unavailable';
  } catch (err) {
    console.error('[invite] load failed', err);
    el.textContent = 'Unavailable';
    btn.disabled = true;
  }
}

async function rotateInviteCode() {
  if (!confirm('Rotate invite code? The current code will stop working immediately.')) return;

  try {
    const callable = httpsCallable(functions, 'rotateMarinaInvite');
    const res = await callable({ clientId: Number(store.activeClientId) });
    const code = res?.data?.inviteCode || 'Unavailable';
    document.getElementById('umInviteCode').textContent = code;
    toast('Invite code rotated', { kind: 'success' });
  } catch (err) {
    console.error('[invite] rotate failed', err);
    toast('Failed to rotate invite code', { kind: 'error' });
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function renderUserList(users) {
  const list = document.getElementById('umList');

  if (!users.length) {
    list.innerHTML = `<div class="boats-empty"><h2>No users</h2></div>`;
    return;
  }

  const sorted = [...users].sort((a, b) => {
    const aAdmin = a.role === 'admin' ? 0 : 1;
    const bAdmin = b.role === 'admin' ? 0 : 1;
    if (aAdmin !== bAdmin) return aAdmin - bAdmin;
    return (a.name || '').localeCompare(b.name || '');
  });

  list.innerHTML = sorted.map(u => {
    const initials = computeInitials(u.name);
    return `
      <div class="um-row" data-user-id="${u.id}">
        <div class="um-avatar">${escapeHtml(initials)}</div>
        <div class="um-info">
          <div class="um-name">${escapeHtml(u.name || 'Unnamed')}</div>
          <div class="um-email">${escapeHtml(u.email || '')}</div>
          <div class="um-role">
            <span class="um-role-label">Role:</span>
            <span class="um-role-value">${escapeHtml(u.role || 'staff')}</span>
          </div>
        </div>
        <div class="um-chevron">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        </div>
        <div class="um-row-divider"></div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.um-row').forEach(row => {
    const userId = Number(row.dataset.userId);
    const user = users.find(u => u.id === userId);
    row.addEventListener('click', () => showRoleSheet(user));
  });
}

/* ============================================================
   ROLE SHEET (view-only)
   ============================================================ */
function showRoleSheet(user) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  sheet.innerHTML = `
    <div class="assign-handle"></div>
    <div class="assign-title">Change role for ${escapeHtml(user.name || 'user')}</div>
    <div class="assign-divider"></div>
    <div class="assign-list" id="umRoleList">
      ${ROLES.map(r => `
        <button class="assign-row" data-role="${r}">
          <span class="assign-name">${r}</span>
          ${r === user.role ? '<span class="assign-current">✓</span>' : ''}
        </button>
      `).join('')}
    </div>
    <div class="assign-divider"></div>
    <button class="assign-cancel" id="umRoleCancel">Cancel</button>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);

  sheet.querySelector('#umRoleCancel').addEventListener('click', close);

  sheet.querySelectorAll('.assign-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const newRole = btn.dataset.role;
      close();
      if (newRole === user.role) return;
      toast('Role change coming soon');
    });
  });
}

/* ============================================================
   HELPERS
   ============================================================ */
function computeInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  if (clean.length >= 2) return clean.substring(0, 2).toUpperCase();
  return clean.substring(0, 1).toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}