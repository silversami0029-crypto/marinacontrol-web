// js/screens/AddDocumentSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const DOCUMENT_TYPES = [
  'Title/Registration', 'Bill of Sale', 'Insurance Policy', 'Warranty',
  'Lease Agreement', 'Owners Manual', 'Service Manual', 'Parts Manual',
  'Wiring Diagram', 'Technical Drawing', 'Inventory Log', 'Service Records',
  'Inspection Report', 'Repair Receipt', 'Inventory Schedule',
  'Safety Certificate', 'Survey Report', 'Radio License', 'MMSI Registration',
  'Chart', 'Cruising Guide', 'Travel Log', 'Checklist', 'Photos', 'Brochure',
  'Contact List', 'Correspondence', 'Other Document',
  'Vessel Registration', 'MMSI Certificate', 'Safety Equipment Certificate',
  'Commercial Compliance Certificate', 'Charter License',
  'Port / Marina Permit', 'Navigation Permit',
  'Environmental Compliance Certificate', 'Classification Certificate',
  'Survey Certificate', 'Flag State Certificate', 'Work Permit',
  'Crew Contract', 'Charter Contract', 'Berthing / Mooring Contract',
  'Warranty (Manufacturer / Extended)', 'Temporary Import Permit',
  'Customs Clearance', 'Visas (Crew / Vessel)', 'Inventory Contract',
  'Service Agreement', 'Purchase Agreement', 'Loan / Finance Agreement',
  'Guarantee', 'Fuel Contract', 'Towing Agreement', 'Docking Agreement',
  'Training Certificate', 'Crew Medical Certificate', 'Fishing Permit'
];

export function showAddDocumentSheet(opts = {}) {
  const { boatId, boatName, item } = opts;
  const isEdit = !!item;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
  <div class="document-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

  <div class="sheet-title"
    style="flex:1;margin:0;padding:12px 48px;text-align:center;">
    ${isEdit ? 'Edit Document' : 'Add Document'}
  </div>

  <button type="button" id="iv-close" aria-label="Close invoice sheet"
    style="position:absolute;right:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;border-radius:8px;background:transparent;color:#F5F7F9;cursor:pointer;">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</div>

    <form id="docForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">

        ${boatName ? `
          <label class="add-label">Boat</label>
          <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
            Boat: ${escapeHtml(boatName)}
          </div>
        ` : ''}

        <label class="add-label" for="doc-name">Document Name</label>
        <input class="add-input" id="doc-name" type="text" placeholder="e.g. 2026 Insurance">

        <label class="add-label" for="doc-type">Document Type</label>
        <select class="add-input add-select" id="doc-type">
          <option value="">Select type…</option>
          ${DOCUMENT_TYPES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
        </select>

        <label class="add-label" for="doc-expiry">Expiry Date</label>
        <input class="add-input" id="doc-expiry" type="date">

        <label class="add-label" for="doc-notes">Notes</label>
        <textarea class="add-input" id="doc-notes" rows="3" placeholder="Notes"></textarea>
      </div>

      <button type="submit" class="add-save" id="doc-save">
        ${isEdit ? 'Update Document' : '+ Add Document'}
      </button>
    </form>
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
sheet.querySelector('#iv-close').addEventListener('click', close);

  if (isEdit) {
    sheet.querySelector('#doc-name').value = item.name || '';
    sheet.querySelector('#doc-type').value = item.type || '';
    if (item.expiryDate) {
      sheet.querySelector('#doc-expiry').value =
        new Date(item.expiryDate).toISOString().slice(0, 10);
    }
    sheet.querySelector('#doc-notes').value = item.notes || '';
  }

  const form = sheet.querySelector('#docForm');
  const save = sheet.querySelector('#doc-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name   = sheet.querySelector('#doc-name').value.trim();
    const type   = sheet.querySelector('#doc-type').value;
    const expiry = sheet.querySelector('#doc-expiry').value;
    const notes  = sheet.querySelector('#doc-notes').value.trim();

    if (!name) { sheet.querySelector('#doc-name').focus(); return; }
    if (!type) { toast('Select a type', { kind: 'error' }); return; }

    const expiryMs = expiry ? new Date(expiry + 'T00:00:00').getTime() : null;

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateDocument(item, { name, type, expiryMs, notes });
      } else {
        if (!boatId) throw new Error('No boat selected');
        await createDocument({ boatId, name, type, expiryMs, notes });
      }
      close();
      toast(isEdit ? 'Document updated' : 'Document added', { kind: 'success' });
    } catch (err) {
      console.error('[document save] failed', err);
      save.disabled = false;
      save.textContent = isEdit ? 'Update Document' : '+ Add Document';
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to save.';
    }
  });
}

async function createDocument({ boatId, name, type, expiryMs, notes }) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  const snap = await getDocs(
    query(collection(db, 'documents'), where('clientId', '==', clientId))
  );
  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);
  const cloudId = (crypto.randomUUID ? crypto.randomUUID() : String(now));

  await setDoc(doc(db, 'documents', cloudId), {
    id: nextId,
    clientId,
    boatId: Number(boatId),
    name,
    type,
    notes: notes || '',
    expiryDate: expiryMs,
    filePath: '',
    fileName: '',
    assignedTo: '',
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  return nextId;
}

async function updateDocument(item, { name, type, expiryMs, notes }) {
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await updateDoc(doc(db, 'documents', String(item._docId)), {
    name,
    type,
    notes: notes || '',
    expiryDate: expiryMs,
    lastModified: now,
    lastModifiedBy: userId
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}