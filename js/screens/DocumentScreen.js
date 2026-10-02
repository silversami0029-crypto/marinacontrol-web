import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/DocumentScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showAddDocumentSheet } from './AddDocumentSheet.js';
import { showDocumentMenu } from './DocumentMenuSheet.js';
import { showDocumentDetail } from './DocumentDetailSheet.js';
import { showDocumentHelp } from './DocumentHelp.js';
import {
  collection, query, where, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

let unsubscribe = null;
let currentBoatId = 0;
let currentBoatName = '';
let currentItems = [];
let isSearchOpen = false;

export function mountDocumentScreen() {
  const screen = document.getElementById('screen');

  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlBoatId = Number(params.get('boatId') || 0);

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentItems = [];
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="doc-header" id="docHeader">
      <div class="doc-header-row">
        <button class="doc-icon-btn" id="docBack" aria-label="${tr("Back")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="doc-pill" id="docPill">${tr("Documents")}</div>
        <button class="doc-icon-btn" id="docHelp" aria-label="${tr("Help")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="doc-header-spacer"></div>
        <button class="doc-icon-btn" id="docSearchToggle" aria-label="${tr("Search")}">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="docSearchBar" hidden>
      <input id="docSearchInput" type="text" placeholder="${tr("Search documents...")}" autocomplete="off">
      <button type="button" class="search-cancel" id="docSearchCancel">${tr("Cancel")}</button>
    </div>

    <div class="doc-list" id="docList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button class="cm-fab" id="docFabAdd" aria-label="${tr("Add document")}">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  `;

/* back button */

 document.getElementById('docBack')?.addEventListener('click', () => history.back());

  document.getElementById('docHelp').addEventListener('click', showDocumentHelp);

  document.getElementById('docSearchToggle').addEventListener('click', () => {
    isSearchOpen = true;
    document.getElementById('docHeader').hidden = true;
    document.getElementById('docSearchBar').hidden = false;
    document.getElementById('docSearchInput').focus();
  });

  document.getElementById('docSearchCancel').addEventListener('click', () => {
    isSearchOpen = false;
    document.getElementById('docSearchBar').hidden = true;
    document.getElementById('docHeader').hidden = false;
    document.getElementById('docSearchInput').value = '';
    renderList();
  });

  document.getElementById('docSearchInput').addEventListener('input', renderList);

  document.getElementById('docFabAdd').addEventListener('click', () => {
    showAddDocumentChooser({ boatId: currentBoatId, boatName: currentBoatName });
  });

  resolveBoatAndSubscribe(urlBoatId);
}

async function resolveBoatAndSubscribe(urlBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) {
    document.getElementById('docList').innerHTML =
      `<div class="boats-empty"><h2>${tr("No client assigned")}</h2></div>`;
    return;
  }

  let boatId = urlBoatId;

  try {
    if (!boatId && store.activeBoatId) boatId = Number(store.activeBoatId);

    if (!boatId) {
      const snap = await getDocs(
        query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('isActive', '==', true)
        )
      );
      if (!snap.empty) {
        boatId = Number(snap.docs[0].data().id || snap.docs[0].id);
        currentBoatName = snap.docs[0].data().name || '';
      }
    } else {
      const snap = await getDocs(
        query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('id', '==', Number(boatId))
        )
      );
      if (!snap.empty) currentBoatName = snap.docs[0].data().name || '';
    }
  } catch (err) {
    console.error('[documents] boat lookup failed', err);
  }

  if (!boatId) {
    document.getElementById('docList').innerHTML =
      `<div class="boats-empty">
         <h2>${tr("No active boat")}</h2>
         <p>${tr("Set a boat as active to see its documents.")}</p>
       </div>`;
    return;
  }

  currentBoatId = boatId;
  document.getElementById('docPill').textContent = currentBoatName
    ? `${tr('Documents')} · ${currentBoatName}`
    : tr('Documents');

  subscribeToDocuments(clientId);
}

function subscribeToDocuments(clientId) {
  const q = query(
    collection(db, 'documents'),
    where('clientId', '==', Number(clientId))
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentItems = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: Number(data.id || 0),
          _docId: d.id,
          clientId: Number(data.clientId || 0),
          boatId: data.boatId != null ? Number(data.boatId) : null,
          name: data.name || '',
          type: data.type || '',
          notes: data.notes || '',
          expiryDate: data.expiryDate != null ? Number(data.expiryDate) : null,
          filePath: data.filePath || '',
          fileName: data.fileName || '',
          assignedTo: data.assignedTo || '',
          lastModified: Number(data.lastModified || 0)
        };
      })
      .filter(item => Number(item.boatId) === Number(currentBoatId));

    renderList();
  }, (err) => {
    console.error('[documents] listen failed', err);
    document.getElementById('docList').innerHTML =
      `<div class="boats-empty">
         <h2>${tr("Couldn't load documents")}</h2>
         <p>${escapeHtml(err.message || 'Permission denied.')}</p>
       </div>`;
  });
}

function getVisibleItems() {
  const q = (document.getElementById('docSearchInput')?.value || '').trim().toLowerCase();
  if (!q) return currentItems;
  return currentItems.filter(d =>
    (d.name || '').toLowerCase().includes(q) ||
    (d.type || '').toLowerCase().includes(q) ||
    (d.notes || '').toLowerCase().includes(q) ||
    (d.assignedTo || '').toLowerCase().includes(q)
  );
}

function renderList() {
  const listEl = document.getElementById('docList');
  if (!listEl) return;

  const items = getVisibleItems();

  if (!items.length) {
    const q = (document.getElementById('docSearchInput')?.value || '').trim();
    listEl.innerHTML = q
      ? `<div class="boats-empty"><h2>${tr("No matches")}</h2><p>${escapeHtml(tr("ui.noMatches", {query:q}))}</p></div>`
      : `<div class="boats-empty"><h2>${tr("No documents")}</h2><p>${tr("Tap + to add the first one.")}</p></div>`;
    return;
  }

  const sorted = [...items].sort((a, b) => {
    const ae = a.expiryDate || Number.MAX_SAFE_INTEGER;
    const be = b.expiryDate || Number.MAX_SAFE_INTEGER;
    return ae - be;
  });

  listEl.innerHTML = sorted.map(d => {
    const state = getExpiryState(d);
    const hasFile = !!(d.filePath && d.filePath.trim());

    return `
      <div class="doc-row" data-doc-id="${d.id}">
        <div class="doc-indicator" style="background:${state.color};">
          <span class="doc-indicator-icon">${state.icon}</span>
        </div>

        <div class="doc-info">
          <div class="doc-name">
            ${hasFile ? '<span class="doc-clip">📎</span> ' : ''}${escapeHtml(d.name || tr('Untitled'))}
          </div>
          <div class="doc-type">${escapeHtml(tr(d.type || ''))}</div>
          ${d.expiryDate ? `<div class="doc-expiry" style="color:${state.dateColor};">${tr("Expires:" )} ${escapeHtml(formatDate(d.expiryDate))}</div>` : `<div class="doc-expiry doc-expiry-dim">${tr("No expiry")}</div>`}
          ${d.notes ? `<div class="doc-notes">${escapeHtml(d.notes)}</div>` : ''}
          ${d.assignedTo ? `<div class="doc-assigned">${tr("Assigned:" )} ${escapeHtml(d.assignedTo)}</div>` : ''}
        </div>

        <button class="doc-kebab" data-doc-menu="${d.id}" aria-label="${tr("Menu")}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="12" r="0.6" fill="currentColor"/>
            <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
          </svg>
        </button>
        <div class="doc-row-divider"></div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.doc-row').forEach(row => {
    const id = Number(row.dataset.docId);
    const item = sorted.find(d => d.id === id);
    if (!item) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-doc-menu]')) return;
      showDocumentDetail(item);
    });
  });

  listEl.querySelectorAll('[data-doc-menu]').forEach(btn => {
    const id = Number(btn.dataset.docMenu);
    const item = sorted.find(d => d.id === id);
    if (!item) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDocumentMenu(item);
    });
  });
}

function getExpiryState(d) {
  if (!d.expiryDate) {
    return { color: '#737D89', icon: '•', dateColor: '#737D89' };
  }
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const t = d.expiryDate;

  if (t < now)         return { color: '#F44336', icon: '!', dateColor: '#F44336' };
  if (t <= now + thirtyDays) return { color: '#FF9800', icon: '⏰', dateColor: '#FF9800' };
  return { color: '#4CAF50', icon: '✓', dateColor: '#4CAF50' };
}

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(uiLocale(), {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return '—';
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ============================================================
   ADD DOCUMENT CHOOSER
   ============================================================ */
function showAddDocumentChooser({ boatId, boatName }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

sheet.innerHTML = `
  <div style="position:relative;min-height:48px;">
    <div class="sheet-title" style="margin:0;padding:12px 48px;text-align:center;">${tr("Add Document")}</div>
    <button type="button" id="documentSheetClose" aria-label="${tr("Close document sheet")}"
      style="position:absolute;right:8px;top:2px;width:44px;height:44px;padding:0;border:0;background:transparent;color:#F5F7F9;font-size:28px;cursor:pointer;">
      &times;
    </button>
  </div>


    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="adcSingle">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">${tr("Add Single Document")}</div>
        <div class="sheet-item-subtitle">${tr("Add one document with all details")}</div>
      </div>
      <div class="sheet-chevron">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
      </div>
    </div>

    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="adcBulk">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">${tr("Bulk Import")}</div>
        <div class="sheet-item-subtitle">${tr("Import multiple documents from CSV")}</div>
      </div>
      <div class="sheet-chevron">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
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
sheet.querySelector('#documentSheetClose').addEventListener('click', close);

  sheet.querySelector('#adcSingle').addEventListener('click', async () => {
    close();
    const m = await import('./AddDocumentSheet.js');
    m.showAddDocumentSheet({ boatId, boatName });
  });

  sheet.querySelector('#adcBulk').addEventListener('click', async () => {
    close();
    const m = await import('./ImportDocumentsSheet.js');
    m.showImportDocumentsSheet({ boatId, boatName });
  });
}