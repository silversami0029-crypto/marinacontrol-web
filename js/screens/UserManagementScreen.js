// js/screens/UserManagementScreen.js

import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { app } from '../firebase.js';

const functions = getFunctions(app, 'us-central1');

let isBulkMode = false;
const selectedIds = new Set();
let currentUsers = [];

const ADD_ROLES = ['staff', 'manager', 'inspector', 'viewer'];
const ALL_ROLES = ['admin', 'manager', 'staff', 'inspector', 'viewer'];

/* ============================================================
   MOUNT
   ============================================================ */

export function mountUserManagementScreen() {
  if (!store.activeClientId) {
    document.getElementById('screen').innerHTML = `
      <div class="boats-empty">
        <h2>No client assigned</h2>
      </div>
    `;
    return;
  }

  isBulkMode = false;
  selectedIds.clear();
  currentUsers = [];

  const screen = document.getElementById('screen');

  screen.innerHTML = `
    <div class="um-header">
      <div class="um-header-row">
        <div class="um-pill">User Management</div>

        <button class="um-icon-btn" id="umHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20"
               fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>

        <div class="um-header-spacer"></div>

        <button class="um-icon-btn" id="umClose" aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="um-invite-row" id="umInviteRow">
      <span class="um-invite-label">Invite Code:</span>
      <span class="um-invite-code" id="umInviteCode">Loading…</span>
      <button class="um-copy-btn" id="umCopyBtn" disabled>
        Copy
      </button>
    </div>

    <div class="bulk-bar" id="umBulkBar" hidden>
      <label class="bulk-select-all">
        <input type="checkbox" id="umBulkSelectAll">
        <span>Select all</span>
      </label>

      <span class="bulk-count" id="umBulkCount">0 selected</span>

      <button type="button" class="bulk-cancel" id="umBulkCancel">
        Cancel
      </button>
    </div>

    <div class="um-list" id="umList">
      <div class="boats-loading">
        <div class="spinner-ring"></div>
      </div>
    </div>

    <button class="bulk-btn" id="umBulkBtn"
            aria-label="Bulk delete" hidden>
      <svg viewBox="0 0 24 24" width="20" height="20"
           fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"/>
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        <line x1="10" y1="11" x2="10" y2="17"/>
        <line x1="14" y1="11" x2="14" y2="17"/>
      </svg>
    </button>

    <button class="um-fab" id="umFabAdd" aria-label="Add user">
      <svg viewBox="0 0 24 24" width="20" height="20"
           fill="none" stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('umClose').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  document.getElementById('umHelp').addEventListener('click', () => {
    toast('User management allows administrators to add users, change roles and remove marina access.');
  });

  document
    .getElementById('umFabAdd')
    .addEventListener('click', showAddUserSheet);

  document
    .getElementById('umBulkBtn')
    .addEventListener('click', onBulkButtonTap);

  document
    .getElementById('umBulkCancel')
    .addEventListener('click', exitBulkMode);

  document
    .getElementById('umBulkSelectAll')
    .addEventListener('change', event => {
      if (event.target.checked) {
        selectAllVisible();
      } else {
        clearSelection();
      }
    });

  const copyButton = document.getElementById('umCopyBtn');

  copyButton.addEventListener('click', async () => {
    const code = document
      .getElementById('umInviteCode')
      .textContent
      .trim();

    if (!code || code === 'Unavailable' || code === 'Loading…') {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      toast('Invite code copied', { kind: 'success' });
    } catch (error) {
      console.error('[invite] copy failed', error);
      toast('Failed to copy invite code', { kind: 'error' });
    }
  });

  copyButton.addEventListener('contextmenu', event => {
    event.preventDefault();
    rotateInviteCode();
  });

  loadInviteCode();
  loadUsers();
}

/* ============================================================
   LOAD ACTIVE MARINA USERS

   This intentionally uses listMarinaUsers rather than reading
   the users collection directly. removeMarinaUser disables the
   marina membership, so the membership-aware Cloud Function is
   the authoritative source.
   ============================================================ */

async function loadUsers() {
  const list = document.getElementById('umList');

  if (!list) return;

  try {
    const callable = httpsCallable(functions, 'listMarinaUsers');

    const response = await callable({
      clientId: Number(store.activeClientId)
    });

    currentUsers = (response?.data?.users || []).map(user => ({
      ...user,
      id: Number(user.userId)
    }));

    const liveIds = new Set(
      currentUsers.map(user => Number(user.id))
    );

    for (const selectedId of Array.from(selectedIds)) {
      if (!liveIds.has(Number(selectedId))) {
        selectedIds.delete(selectedId);
      }
    }

    renderUserList(currentUsers);
    updateBulkVisibility();
    syncSelectAllCheckbox();
    updateCount();
  } catch (error) {
    console.error('[users] load failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details
    });

    list.innerHTML = `
      <div class="boats-empty">
        <h2>Couldn't load users</h2>
        <p>
          ${escapeHtml(
            error?.message || 'Unable to load marina users.'
          )}
        </p>
      </div>
    `;
  }
}

/* ============================================================
   INVITE CODE
   ============================================================ */

async function loadInviteCode() {
  const codeElement = document.getElementById('umInviteCode');
  const copyButton = document.getElementById('umCopyBtn');

  if (!codeElement || !copyButton) return;

  codeElement.textContent = 'Loading…';
  copyButton.disabled = true;

  try {
    const callable = httpsCallable(functions, 'getMarinaInvite');

    const response = await callable({
      clientId: Number(store.activeClientId)
    });

    const code = response?.data?.inviteCode || 'Unavailable';

    codeElement.textContent = code;
    copyButton.disabled = code === 'Unavailable';
  } catch (error) {
    console.error('[invite] load failed', error);

    codeElement.textContent = 'Unavailable';
    copyButton.disabled = true;
  }
}

async function rotateInviteCode() {
  const confirmed = confirm(
    'Rotate invite code? The current code will stop working immediately.'
  );

  if (!confirmed) return;

  try {
    const callable = httpsCallable(
      functions,
      'rotateMarinaInvite'
    );

    const response = await callable({
      clientId: Number(store.activeClientId)
    });

    const code = response?.data?.inviteCode || 'Unavailable';

    document.getElementById('umInviteCode').textContent = code;

    toast('Invite code rotated', { kind: 'success' });
  } catch (error) {
    console.error('[invite] rotate failed', error);
    toast('Failed to rotate invite code', { kind: 'error' });
  }
}

/* ============================================================
   USER LIST
   ============================================================ */

function renderUserList(users) {
  const list = document.getElementById('umList');

  if (!list) return;

  if (!users.length) {
    list.innerHTML = `
      <div class="boats-empty">
        <h2>No users</h2>
      </div>
    `;
    return;
  }

  const sortedUsers = [...users].sort((first, second) => {
    const firstAdmin = first.role === 'admin' ? 0 : 1;
    const secondAdmin = second.role === 'admin' ? 0 : 1;

    if (firstAdmin !== secondAdmin) {
      return firstAdmin - secondAdmin;
    }

    return String(first.name || '').localeCompare(
      String(second.name || '')
    );
  });

  list.innerHTML = sortedUsers.map(user => {
    const userId = Number(user.id);
    const selected = selectedIds.has(userId);

    return `
      <div class="um-row${selected ? ' is-selected' : ''}"
           data-user-id="${userId}">

        ${isBulkMode ? `
          <input type="checkbox"
                 class="um-check"
                 ${selected ? 'checked' : ''}>
        ` : ''}

        <div class="um-avatar">
          ${escapeHtml(computeInitials(user.name))}
        </div>

        <div class="um-info">
          <div class="um-name">
            ${escapeHtml(user.name || 'Unnamed')}
          </div>

          <div class="um-email">
            ${escapeHtml(user.email || '')}
          </div>

          <div class="um-role">
            <span class="um-role-label">Role:</span>
            <span class="um-role-value">
              ${escapeHtml(user.role || 'staff')}
            </span>
          </div>
        </div>

        ${isBulkMode ? '' : `
          <div class="um-chevron">
            <svg viewBox="0 0 24 24" width="20" height="20"
                 fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </div>
        `}

        <div class="um-row-divider"></div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.um-row').forEach(row => {
    const userId = Number(row.dataset.userId);

    const user = currentUsers.find(
      item => Number(item.id) === userId
    );

    if (!user) return;

    if (isBulkMode) {
      row.addEventListener('click', () => {
        toggleSelection(userId);
      });

      row
        .querySelector('.um-check')
        ?.addEventListener('click', event => {
          event.stopPropagation();
          toggleSelection(userId);
        });

      return;
    }

    row.addEventListener('click', () => {
      showRoleSheet(user);
    });
  });
}

/* ============================================================
   BULK MODE
   ============================================================ */

function updateBulkVisibility() {
  const button = document.getElementById('umBulkBtn');

  if (!button) return;

  const currentUserId = Number(
    store.userProfile?.userId || 0
  );

  const removableUsers = currentUsers.filter(
    user => Number(user.id) !== currentUserId
  );

  button.hidden = removableUsers.length === 0;
}

function enterBulkMode() {
  isBulkMode = true;
  selectedIds.clear();

  document
    .getElementById('umBulkBtn')
    ?.classList.add('is-armed');

  document.getElementById('umBulkBar').hidden = false;
  document.getElementById('umFabAdd').hidden = true;
  document.getElementById('umInviteRow').hidden = true;
  document.getElementById('umBulkSelectAll').checked = false;

  updateCount();
  renderUserList(currentUsers);
}

function exitBulkMode() {
  isBulkMode = false;
  selectedIds.clear();

  document
    .getElementById('umBulkBtn')
    ?.classList.remove('is-armed');

  const bulkBar = document.getElementById('umBulkBar');
  const fab = document.getElementById('umFabAdd');
  const inviteRow = document.getElementById('umInviteRow');
  const selectAll = document.getElementById('umBulkSelectAll');

  if (bulkBar) bulkBar.hidden = true;
  if (fab) fab.hidden = false;
  if (inviteRow) inviteRow.hidden = false;
  if (selectAll) selectAll.checked = false;

  updateCount();
  renderUserList(currentUsers);
}

function toggleSelection(userId) {
  const currentUserId = Number(
    store.userProfile?.userId || 0
  );

  if (Number(userId) === currentUserId) {
    toast(
      'You cannot delete your own account',
      { kind: 'error' }
    );
    return;
  }

  if (selectedIds.has(userId)) {
    selectedIds.delete(userId);
  } else {
    selectedIds.add(userId);
  }

  const row = document.querySelector(
    `.um-row[data-user-id="${userId}"]`
  );

  if (row) {
    row.classList.toggle(
      'is-selected',
      selectedIds.has(userId)
    );

    const checkbox = row.querySelector('.um-check');

    if (checkbox) {
      checkbox.checked = selectedIds.has(userId);
    }
  }

  syncSelectAllCheckbox();
  updateCount();
}

function selectAllVisible() {
  const currentUserId = Number(
    store.userProfile?.userId || 0
  );

  currentUsers.forEach(user => {
    const userId = Number(user.id);

    if (userId !== currentUserId) {
      selectedIds.add(userId);
    }
  });

  syncSelectAllCheckbox();
  updateCount();
  renderUserList(currentUsers);
}

function clearSelection() {
  selectedIds.clear();

  syncSelectAllCheckbox();
  updateCount();
  renderUserList(currentUsers);
}

function syncSelectAllCheckbox() {
  const checkbox = document.getElementById(
    'umBulkSelectAll'
  );

  if (!checkbox) return;

  const currentUserId = Number(
    store.userProfile?.userId || 0
  );

  const selectableUsers = currentUsers.filter(
    user => Number(user.id) !== currentUserId
  );

  checkbox.checked =
    selectableUsers.length > 0 &&
    selectableUsers.every(user =>
      selectedIds.has(Number(user.id))
    );
}

function updateCount() {
  const element = document.getElementById('umBulkCount');

  if (!element) return;

  const count = selectedIds.size;

  element.textContent =
    count === 1
      ? '1 selected'
      : `${count} selected`;
}

function onBulkButtonTap() {
  if (!isBulkMode) {
    enterBulkMode();
    return;
  }

  if (selectedIds.size === 0) {
    toast('No users selected');
    return;
  }

  confirmBulkDelete();
}

/* ============================================================
   DELETE USERS
   ============================================================ */

async function confirmBulkDelete() {
  const currentUserId = Number(
    store.userProfile?.userId || 0
  );

  const ids = Array.from(selectedIds).filter(
    userId => Number(userId) !== currentUserId
  );

  if (ids.length !== selectedIds.size) {
    toast(
      'You cannot delete your own account',
      { kind: 'error' }
    );
  }

  if (ids.length === 0) {
    exitBulkMode();
    return;
  }

  const count = ids.length;

  const confirmed = await confirmSheet({
    title: `Delete ${count} user${count === 1 ? '' : 's'}?`,
    message: 'Their access to this marina will be removed.',
    confirmText: 'Delete',
    cancelText: 'Cancel'
  });

  if (!confirmed) return;

  const callable = httpsCallable(
    functions,
    'removeMarinaUser'
  );

  let deleted = 0;
  let failed = 0;

  for (const userId of ids) {
    try {
      await callable({
        clientId: Number(store.activeClientId),
        userId: Number(userId)
      });

      deleted++;
      selectedIds.delete(userId);
    } catch (error) {
      failed++;

      console.error('[remove user] failed', {
        userId,
        code: error?.code,
        message: error?.message,
        details: error?.details
      });
    }
  }

  exitBulkMode();

  // Reload from active marina memberships.
  await loadUsers();

  if (deleted > 0) {
    toast(
      `Deleted ${deleted} user${deleted === 1 ? '' : 's'}`,
      { kind: 'success' }
    );
  }

  if (failed > 0) {
    toast(
      `Failed to delete ${failed} user${failed === 1 ? '' : 's'}`,
      { kind: 'error' }
    );
  }
}

/* ============================================================
   ROLE SHEET
   ============================================================ */

function showRoleSheet(user) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  sheet.innerHTML = `
    <div class="assign-handle"></div>

    <div class="assign-title">
      Change role for ${escapeHtml(user.name || 'user')}
    </div>

    <div class="assign-divider"></div>

    <div class="assign-list">
      ${ALL_ROLES.map(role => `
        <button class="assign-row" data-role="${role}">
          <span class="assign-name">${role}</span>

          ${role === user.role
            ? '<span class="assign-current">✓</span>'
            : ''
          }
        </button>
      `).join('')}
    </div>

    <div class="assign-divider"></div>

    <button class="assign-cancel" id="umRoleCancel">
      Cancel
    </button>
  `;

  document
    .getElementById('modalRoot')
    .append(backdrop, sheet);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);

  sheet
    .querySelector('#umRoleCancel')
    .addEventListener('click', close);

  sheet.querySelectorAll('.assign-row').forEach(button => {
    button.addEventListener('click', async () => {
      const newRole = button.dataset.role;

      close();

      if (newRole === user.role) return;

      try {
        const callable = httpsCallable(
          functions,
          'updateMarinaUserRole'
        );

        await callable({
          clientId: Number(store.activeClientId),
          userId: Number(user.id),
          role: newRole
        });

        toast(
          `Role updated to ${newRole}`,
          { kind: 'success' }
        );

        await loadUsers();
      } catch (error) {
        console.error('[role] update failed', error);

        toast(
          'Failed to update role',
          { kind: 'error' }
        );
      }
    });
  });
}

/* ============================================================
   ADD USER SHEET
   ============================================================ */

function showAddUserSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>

    <div class="sheet-title" style="text-align:center;">
      Add User
    </div>

    <form id="umAddForm"
          class="add-form"
          novalidate
          autocomplete="off">

      <input type="text"
             name="fakeusernameremembered"
             style="display:none"
             tabindex="-1"
             autocomplete="username">

      <input type="password"
             name="fakepasswordremembered"
             style="display:none"
             tabindex="-1"
             autocomplete="current-password">

      <div class="add-scroll">
        <label class="add-label" for="um-name">
          Full Name
        </label>

        <input class="add-input"
               id="um-name"
               name="um-name"
               type="text"
               placeholder="Full Name"
               autocomplete="off"
               autocorrect="off"
               autocapitalize="words"
               spellcheck="false">

        <label class="add-label" for="um-email">
          Email
        </label>

        <input class="add-input"
               id="um-email"
               name="um-email"
               type="email"
               placeholder="Email"
               autocomplete="off"
               autocorrect="off"
               autocapitalize="off"
               spellcheck="false">

        <label class="add-label" for="um-password">
          Password
        </label>

        <input class="add-input"
               id="um-password"
               name="um-password"
               type="password"
               placeholder="Password"
               autocomplete="new-password">

        <div class="add-section-title"
             style="margin-top:16px;">
          User Role
        </div>

        <select class="add-input add-select"
                id="um-role"
                name="um-role"
                autocomplete="off">

          ${ADD_ROLES.map(role => `
            <option value="${role}">
              ${role}
            </option>
          `).join('')}
        </select>
      </div>

      <button type="submit"
              class="add-save"
              id="um-save">
        + Create User
      </button>
    </form>
  `;

  document
    .getElementById('modalRoot')
    .append(backdrop, sheet);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);

  const form = sheet.querySelector('#umAddForm');
  const saveButton = sheet.querySelector('#um-save');

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const name = sheet
      .querySelector('#um-name')
      .value
      .trim();

    const email = sheet
      .querySelector('#um-email')
      .value
      .trim();

    const password = sheet
      .querySelector('#um-password')
      .value
      .trim();

    const role = sheet
      .querySelector('#um-role')
      .value;

    if (!name) {
      sheet.querySelector('#um-name').focus();
      return;
    }

    if (!email) {
      sheet.querySelector('#um-email').focus();
      return;
    }

    if (!password) {
      sheet.querySelector('#um-password').focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Creating…';

    try {
      const callable = httpsCallable(
        functions,
        'createMarinaUser'
      );

      await callable({
        clientId: Number(store.activeClientId),
        name,
        email,
        password,
        role
      });

      close();

      toast(
        `User created: ${name}`,
        { kind: 'success' }
      );

      await loadUsers();
    } catch (error) {
      console.error('[add user] failed', error);

      saveButton.disabled = false;
      saveButton.textContent = '+ Create User';

      let errorElement = sheet.querySelector('.add-error');

      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'add-error';

        form.insertBefore(
          errorElement,
          saveButton
        );
      }

      errorElement.textContent =
        error?.message || 'Failed to create user.';
    }
  });
}

/* ============================================================
   HELPERS
   ============================================================ */

function computeInitials(name) {
  const clean = String(name || '').trim();

  if (!clean) return '?';

  if (clean.length >= 2) {
    return clean.substring(0, 2).toUpperCase();
  }

  return clean.substring(0, 1).toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character])
  );
}