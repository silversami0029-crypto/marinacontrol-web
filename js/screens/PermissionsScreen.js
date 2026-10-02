import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/PermissionsScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showPermissionsHelp } from './PermissionsHelp.js';
import {
  collection, query, where, onSnapshot, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentCrew = [];
let isSearchOpen = false;

/* Android parity: PermissionsAdapter roles */
const ROLES = ['Admin', 'Staff', 'Inspector', 'View Only'];

export function mountPermissionsScreen() {
  const screen = document.getElementById('screen');

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentCrew = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="cm-header" id="pmHeader">
      <div class="cm-header-row">
        <button class="cm-icon-btn" id="pmBack" aria-label="${tr("Back")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="cm-pill">${tr("Permissions & Roles")}</div>
        <button class="cm-icon-btn" id="pmHelp" aria-label="${tr("Help")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="cm-header-spacer"></div>
        <button class="cm-icon-btn" id="pmSearchToggle" aria-label="${tr("Search")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="pmSearchBar" hidden>
      <input id="pmSearchInput" type="text" placeholder="${tr("Search crew...")}" autocomplete="off">
      <button type="button" class="search-cancel" id="pmSearchCancel">${tr("Cancel")}</button>
    </div>

    <div class="cm-list" id="pmList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  document.getElementById('pmBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  const pmHelpBtn = document.getElementById('pmHelp');
  if (pmHelpBtn) pmHelpBtn.addEventListener('click', showPermissionsHelp);

  document.getElementById('pmSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('pmHeader').hidden = true;
    document.getElementById('pmSearchBar').hidden = false;
    document.getElementById('pmSearchInput').focus();
  });

  document.getElementById('pmSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('pmSearchBar').hidden = true;
    document.getElementById('pmHeader').hidden = false;
    document.getElementById('pmSearchInput').value = '';
    renderList();
  });

  document.getElementById('pmSearchInput').addEventListener('input', renderList);

  subscribeToCrew();
}

function subscribeToCrew() {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('pmList').innerHTML =
      `<div class="boats-empty"><h2>${tr("No client assigned")}</h2></div>`;
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
          _docId: d.id,
          id: data.id != null ? Number(data.id) : Number(d.id),
          name: data.name || '',
          email: data.email || '',
          role: data.role || '',
          boatId: data.boatId != null ? Number(data.boatId) : 0,
          clientId: Number(data.clientId || 0)
        };
      })
      .filter(c => c.name && c.name.trim())
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    renderList();
  }, (err) => {
    console.error('[permissions] listen failed', err);
    const el = document.getElementById('pmList');
    if (!el) return;
    el.innerHTML =
      `<div class="boats-empty">
         <h2>${tr("Couldn't load crew")}</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

function getVisibleCrew() {
  const q = (document.getElementById('pmSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentCrew;
  return currentCrew.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q) ||
    (c.role || '').toLowerCase().includes(q)
  );
}

function renderList() {
  const listEl = document.getElementById('pmList');
  if (!listEl) return;

  const crew = getVisibleCrew();

  if (!crew.length) {
    const q = (document.getElementById('pmSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>${tr("No matches")}</h2><p>${escapeHtml(tr("ui.noMatches", {query:q}))}</p></div>`
      : `<div class="boats-empty"><h2>${tr("No crew yet")}</h2><p>${tr("Add crew members first.")}</p></div>`;
    return;
  }

  listEl.innerHTML = crew.map(c => `
    <div class="cm-row" data-crew-id="${c.id}">
      <div class="cm-avatar">${escapeHtml(computeInitials(c.name))}</div>
      <div class="cm-info">
        <div class="cm-name">${escapeHtml(c.name)}</div>
        ${c.email ? `<div class="cm-email">${escapeHtml(c.email)}</div>` : ''}
      </div>
      <div class="pm-role-cell">
        <select class="pm-role-select" data-role-for="${c._docId}">
          ${ROLES.map(r => `<option value="${escapeAttr(r)}"${r === c.role ? ' selected' : ''}>${escapeHtml(tr(r))}</option>`).join('')}
        </select>
      </div>
      <div class="cm-row-divider"></div>
    </div>
  `).join('');

  listEl.querySelectorAll('[data-role-for]').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', async (e) => {
      const docId = sel.dataset.roleFor;
      const newRole = sel.value;
      const member = currentCrew.find(c => c._docId === docId);
      if (!member) return;
      if (newRole === member.role) return;

      const oldRole = member.role || 'None';

      try {
        await updateDoc(doc(db, 'crew', String(docId)), {
          role: newRole
        });
        member.role = newRole;
        toast(tr(`Role updated: ${newRole}`), { kind: 'success' });
      } catch (err) {
        console.error('[permissions] role update failed', err);
        toast(tr('Failed to update role'), { kind: 'error' });
        sel.value = oldRole === 'None' ? '' : oldRole;
      }
    });
  });
}

/* ============================================================ */
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
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}