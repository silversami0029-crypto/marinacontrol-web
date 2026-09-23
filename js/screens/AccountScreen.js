// js/screens/AccountScreen.js
// Account — mirrors activity_account.xml + AccountFragment.java

import { store } from '../store.js';
import { auth } from '../firebase.js';
import { signOut } from '../firebase.js';
import { confirmSheet } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { db, doc, getDoc, deleteDoc } from '../firebase.js';

const ICONS = {
  person: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21a8 8 0 0 1 16 0"/>
    </svg>`,
  delete: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>`,
  logout: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>`,
  chevron: `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 6 15 12 9 18"/>
    </svg>`
};

export function mountAccountScreen() {
  const screen = document.getElementById('screen');
  const profile = store.userProfile || {};

  const name  = profile.name  || '';
  const email = profile.email || '';
  const initials = computeInitials(name);

  screen.innerHTML = `
    <div class="account-wrap">

      <!-- Header pill -->
      <div class="account-header">
        <div class="account-pill">My Account</div>
      </div>

      <!-- User info card -->
      <div class="account-card">
        <div class="account-user-row">
          <div class="account-avatar">${escapeHtml(initials)}</div>
          <div class="account-user-info">
            <div class="account-user-name">${escapeHtml(name || 'Client Name')}</div>
            <div class="account-user-email">${escapeHtml(email || 'client@example.com')}</div>
          </div>
        </div>
      </div>

      <!-- Menu card -->
      <div class="account-card account-menu">
        <button class="account-item" id="btnEditProfile">
          <span class="account-item-icon">${ICONS.person}</span>
          <span class="account-item-text">Edit Profile</span>
          <span class="account-item-chevron">${ICONS.chevron}</span>
        </button>

        <button class="account-item account-item--danger" id="btnDeleteAccount">
          <span class="account-item-icon">${ICONS.delete}</span>
          <span class="account-item-text">Delete Account</span>
          <span class="account-item-chevron">${ICONS.chevron}</span>
        </button>

        <button class="account-item account-item--danger" id="btnLogout">
          <span class="account-item-icon">${ICONS.logout}</span>
          <span class="account-item-text">Logout</span>
          <span class="account-item-chevron">${ICONS.chevron}</span>
        </button>
      </div>

      <!-- Footer -->
      <div class="account-footer">
        By continuing to use MarinaControl, you agree to the Terms of Use and Privacy Policy
      </div>

      <div class="account-version">
        MarinaControl<br>Version 1.0.0
      </div>
    </div>
  `;

  document.getElementById('btnEditProfile').addEventListener('click', () => {
    toast('Edit Profile coming soon');
  });

  document.getElementById('btnDeleteAccount').addEventListener('click', onDeleteAccount);
  document.getElementById('btnLogout').addEventListener('click', onLogout);
}

/* ---------- Helpers ---------- */
function computeInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

async function onDeleteAccount() {
  const ok = await confirmSheet({
    title: 'Delete Account',
    message: 'This will permanently delete your account data. This action cannot be undone.',
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    const uid = store.authUser?.uid;
    if (!uid) throw new Error('No authenticated user');

    // Find the users doc matching this firebaseUid and delete it
    const { collection, query, where, getDocs } = await import('../firebase.js');
    const q = query(collection(db, 'users'), where('firebaseUid', '==', uid));
    const snap = await getDocs(q);

    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }

    toast('Account deleted', { kind: 'success' });

    // Sign out → router will redirect to /login
    await signOut(auth);

  } catch (err) {
    console.error('[delete account] failed', err);
    toast('Failed to delete account', { kind: 'error' });
  }
}

async function onLogout() {
  const ok = await confirmSheet({
    title: 'Log out',
    message: 'Are you sure you want to log out of MarinaControl?',
    confirmText: 'Log out',
    cancelText: 'Cancel'
  });
  if (!ok) return;

  try {
    await signOut(auth);
    toast('Signed out');
    // router will redirect to /login automatically
  } catch (err) {
    console.error('[logout] failed', err);
    toast('Failed to log out', { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}