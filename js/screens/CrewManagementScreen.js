// js/screens/CrewManagementScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { showAddCrewChooser } from './AddCrewSheet.js';
import {
  collection, query, where, onSnapshot, doc, updateDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentCrew = [];
let isSearchOpen = false;

export function mountCrewManagementScreen() {
  const screen = document.getElementById('screen');

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentCrew = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="cm-header" id="cmHeader">
      <div class="cm-header-row">
        <button class="cm-icon-btn" id="cmBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="cm-pill">Crew</div>
        <button class="cm-icon-btn" id="cmHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="cm-header-spacer"></div>
        <button class="cm-icon-btn" id="cmSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="cmSearchBar" hidden>
      <input id="cmSearchInput" type="text" placeholder="Search crew..." autocomplete="off">
      <button type="button" class="search-cancel" id="cmSearchCancel">Cancel</button>
    </div>

    <div class="cm-list" id="cmList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="cmFabAdd" aria-label="Add crew">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

  document.getElementById('cmBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  document.getElementById('cmHelp').addEventListener('click', () => {
    toast('Crew help coming soon');
  });

  document.getElementById('cmSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('cmHeader').hidden = true;
    document.getElementById('cmSearchBar').hidden = false;
    document.getElementById('cmSearchInput').focus();
  });

  document.getElementById('cmSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('cmSearchBar').hidden = true;
    document.getElementById('cmHeader').hidden = false;
    document.getElementById('cmSearchInput').value = '';
    renderList();
  });

  document.getElementById('cmSearchInput').addEventListener('input', renderList);

  document.getElementById('cmFabAdd').addEventListener('click', showAddCrewChooser);

  subscribeToCrew();
}

function subscribeToCrew() {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('cmList').innerHTML =
      `<div class="boats-empty"><h2>No client assigned</h2></div>`;
    return;
  }

  const q = query(
    collection(db, 'crew'),
    where('clientId', '==', clientId)
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentCrew = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: data.id != null ? Number(data.id) : Number(d.id),
          _docId: d.id,
          clientId: Number(data.clientId || 0),
          boatId: data.boatId != null ? Number(data.boatId) : 0,
          name: data.name || '',
          email: data.email || '',
          role: data.role || '',
          notes: data.notes || '',
          status: data.status || '',
          createdAt: Number(data.createdAt || 0)
        };
      })
      .filter(c => c.name && c.name.trim())
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    renderList();
  }, (err) => {
    console.error('[crew] listen failed', err);
    document.getElementById('cmList').innerHTML =
      `<div class="boats-empty">
         <h2>Couldn't load crew</h2>
         <p>${err.message || 'Permission denied.'}</p>
       </div>`;
  });
}

function getVisibleCrew() {
  const q = (document.getElementById('cmSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentCrew;
  return currentCrew.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.role || '').toLowerCase().includes(q)
  );
}

function renderList() {
  const listEl = document.getElementById('cmList');
  if (!listEl) return;

  const crew = getVisibleCrew();

  if (!crew.length) {
    const q = (document.getElementById('cmSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>No matches</h2><p>No crew match "${escapeHtml(q)}"</p></div>`
      : `<div class="boats-empty"><h2>No crew yet</h2><p>Tap + to add your first crew member.</p></div>`;
    return;
  }

  listEl.innerHTML = crew.map(c => `
    <div class="cm-row" data-crew-id="${c.id}">
      <div class="cm-avatar">${escapeHtml(computeInitials(c.name))}</div>
      <div class="cm-info">
        <div class="cm-name">${escapeHtml(c.name)}</div>
        ${c.role ? `<div class="cm-role">${escapeHtml(c.role)}</div>` : ''}
        ${c.email ? `<div class="cm-email">${escapeHtml(c.email)}</div>` : ''}
        ${c.notes ? `<div class="cm-notes">${escapeHtml(c.notes)}</div>` : ''}
        ${c.status ? `<div class="cm-status">${escapeHtml(c.status)}</div>` : ''}
      </div>
      <button class="cm-kebab" data-crew-menu="${c.id}" aria-label="Menu">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="5" r="0.6" fill="currentColor"/>
          <circle cx="12" cy="12" r="0.6" fill="currentColor"/>
          <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
        </svg>
      </button>
      <div class="cm-row-divider"></div>
    </div>
  `).join('');

  listEl.querySelectorAll('.cm-row').forEach(row => {
    const id = Number(row.dataset.crewId);
    const member = crew.find(c => c.id === id);
    if (!member) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-crew-menu]')) return;
      showCrewDetail(member);
    });
  });

  listEl.querySelectorAll('[data-crew-menu]').forEach(btn => {
    const id = Number(btn.dataset.crewMenu);
    const member = crew.find(c => c.id === id);
    if (!member) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showCrewMenu(member);
    });
  });
}

/* ============================================================
   DETAIL SHEET
   ============================================================ */
function showCrewDetail(member) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const joined = member.createdAt
    ? new Date(member.createdAt).toLocaleDateString('en-GB', {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
      })
    : '—';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(member.name)}</div>

    <div class="cm-detail-body">
      <div class="bkr-detail-row"><span>Role</span><b>${escapeHtml(member.role || 'N/A')}</b></div>
      <div class="bkr-detail-row"><span>Email</span><b>${escapeHtml(member.email || 'N/A')}</b></div>
      <div class="bkr-detail-row"><span>Joined</span><b>${escapeHtml(joined)}</b></div>
      ${member.notes ? `<div class="bkr-detail-row"><span>Notes</span><b>${escapeHtml(member.notes)}</b></div>` : ''}
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="cmCloseDetail">Close</button>
    </div>
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
  sheet.querySelector('#cmCloseDetail').addEventListener('click', close);
}

/* ============================================================
   MENU (Delete only, for now)
   ============================================================ */
function showCrewMenu(member) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(member.name)}</div>

    <div class="sheet-item" id="cmView">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">View Details</div>
      </div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="cmDelete">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Delete</div>
      </div>
    </div>
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

  sheet.querySelector('#cmView').addEventListener('click', () => {
    close();
    setTimeout(() => showCrewDetail(member), 250);
  });

  sheet.querySelector('#cmDelete').addEventListener('click', async () => {
    close();
    const ok = await confirmSheet({
      title: 'Delete crew member?',
      message: `This will permanently remove ${member.name}. This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'crew', String(member._docId)));
      toast(`Deleted ${member.name}`, { kind: 'success' });
    } catch (err) {
      console.error('[crew] delete failed', err);
      toast('Failed to delete crew member', { kind: 'error' });
    }
  });
}

/* ============================================================
   HELPERS
   ============================================================ */
function computeInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, Math.min(2, parts[0].length)).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}