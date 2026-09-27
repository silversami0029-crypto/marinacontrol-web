// js/screens/AddSafetySheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const CATEGORIES = [
  'Fire Safety', 'Life Saving', 'Navigation', 'Communication',
  'Pyrotechnics', 'First Aid', 'Safety Equipment', 'Emergency',
  'Pollution Prevention', 'Other'
];

const IMPORTANCE = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function showAddSafetySheet(opts = {}) {
  const { boatId, boatName, item } = opts;
  const isEdit = !!item;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">
      ${isEdit ? 'Edit Safety Item' : 'Add Safety Item'}
    </div>

    <form id="sfForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">
        ${boatName ? `
          <label class="add-label">Boat</label>
          <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
            Boat: ${escapeHtml(boatName)}
          </div>
        ` : ''}

        <label class="add-label" for="sf-title">Title</label>
        <input class="add-input" id="sf-title" type="text" placeholder="e.g. SOLAS Red Parachute Flare">

        <label class="add-label" for="sf-category">Category</label>
        <select class="add-input add-select" id="sf-category">
          <option value="">Select category…</option>
          ${CATEGORIES.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>

        <label class="add-label" for="sf-location">Location</label>
        <input class="add-input" id="sf-location" type="text" placeholder="e.g. Waterproof cockpit locker">

        <label class="add-label" for="sf-importance">Importance</label>
        <select class="add-input add-select" id="sf-importance">
          ${IMPORTANCE.map(i => `<option value="${i}" ${i === 'MEDIUM' ? 'selected' : ''}>${i}</option>`).join('')}
        </select>

        <label class="add-label" for="sf-purchase">Purchase Date</label>
        <input class="add-input" id="sf-purchase" type="date">

        <label class="add-label" for="sf-validity-years">Validity (Years)</label>
        <input class="add-input" id="sf-validity-years" type="number" min="0" value="0">

        <label class="add-label" for="sf-validity-months">Validity (Months)</label>
        <input class="add-input" id="sf-validity-months" type="number" min="0" value="0">

        <label class="add-label" for="sf-expiry">Expiry Date (manual override)</label>
        <input class="add-input" id="sf-expiry" type="date">

        <label class="add-label" for="sf-notes">Notes</label>
        <textarea class="add-input" id="sf-notes" rows="3" placeholder="Notes"></textarea>
      </div>

      <button type="submit" class="add-save" id="sf-save">
        ${isEdit ? 'Update Safety Item' : '+ Add Safety Item'}
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

  if (isEdit) {
    sheet.querySelector('#sf-title').value = item.title || '';
    sheet.querySelector('#sf-category').value = item.category || '';
    sheet.querySelector('#sf-location').value = item.location || '';
    sheet.querySelector('#sf-importance').value = item.importance || 'MEDIUM';
    if (item.purchaseDate > 0) sheet.querySelector('#sf-purchase').value = new Date(item.purchaseDate).toISOString().slice(0, 10);
    sheet.querySelector('#sf-validity-years').value = item.validityYears || 0;
    sheet.querySelector('#sf-validity-months').value = item.validityMonths || 0;
    if (item.expiryDate > 0) sheet.querySelector('#sf-expiry').value = new Date(item.expiryDate).toISOString().slice(0, 10);
    sheet.querySelector('#sf-notes').value = item.notes || '';
  }

  const form = sheet.querySelector('#sfForm');
  const save = sheet.querySelector('#sf-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title    = sheet.querySelector('#sf-title').value.trim();
    const category = sheet.querySelector('#sf-category').value;
    const location = sheet.querySelector('#sf-location').value.trim();
    const importance = sheet.querySelector('#sf-importance').value;
    const purchaseRaw = sheet.querySelector('#sf-purchase').value;
    const yearsRaw = sheet.querySelector('#sf-validity-years').value;
    const monthsRaw = sheet.querySelector('#sf-validity-months').value;
    const expiryRaw = sheet.querySelector('#sf-expiry').value;
    const notes = sheet.querySelector('#sf-notes').value.trim();

    if (!title)    { sheet.querySelector('#sf-title').focus(); return; }
    if (!category) { toast('Select a category', { kind: 'error' }); return; }

    const purchaseMs = purchaseRaw ? new Date(purchaseRaw + 'T00:00:00').getTime() : 0;
    const validityYears = Math.max(0, Number(yearsRaw) || 0);
    const validityMonths = Math.max(0, Number(monthsRaw) || 0);

    // Expiry date: explicit override wins, otherwise compute from purchase + validity
    let expiryMs = expiryRaw ? new Date(expiryRaw + 'T00:00:00').getTime() : 0;
    if (!expiryMs && purchaseMs && (validityYears || validityMonths)) {
      const d = new Date(purchaseMs);
      d.setFullYear(d.getFullYear() + validityYears);
      d.setMonth(d.getMonth() + validityMonths);
      expiryMs = d.getTime();
    }

    // nextInspectionDate = alertDaysBefore before expiry (default 30)
    const alertDays = 30;
    const nextInspectionMs = expiryMs
      ? expiryMs - alertDays * 24 * 60 * 60 * 1000
      : 0;

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateSafety(item, {
          title, category, location, importance,
          purchaseMs, validityYears, validityMonths,
          expiryMs, nextInspectionMs, alertDays, notes
        });
      } else {
        if (!boatId) throw new Error('No boat selected');
        await createSafety({
          boatId, boatName,
          title, category, location, importance,
          purchaseMs, validityYears, validityMonths,
          expiryMs, nextInspectionMs, alertDays, notes
        });
      }
      close();
      toast(isEdit ? 'Safety item updated' : 'Safety item added', { kind: 'success' });
    } catch (err) {
      console.error('[safety save] failed', err);
      save.disabled = false;
      save.textContent = isEdit ? 'Update Safety Item' : '+ Add Safety Item';
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

async function createSafety(payload) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  const snap = await getDocs(
    query(collection(db, 'safety_items'), where('clientId', '==', clientId))
  );
  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);
  const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `s-${now}-${nextId}`);

  await setDoc(doc(db, 'safety_items', cloudId), {
    id: nextId,
    clientId,
    boatId: Number(payload.boatId),
    boatName: payload.boatName || '',
    title: payload.title,
    category: payload.category,
    location: payload.location || '',
    importance: payload.importance || 'MEDIUM',
    status: 'ACTIVE',
    expiryDate: payload.expiryMs || 0,
    nextInspectionDate: payload.nextInspectionMs || 0,
    lastInspectedDate: 0,
    purchaseDate: payload.purchaseMs || 0,
    alertDaysBefore: payload.alertDays || 30,
    validityYears: payload.validityYears || 0,
    validityMonths: payload.validityMonths || 0,
    notes: payload.notes || '',
    photoPath: null,
    serialNumber: null,
    supplierInfo: null,
    templateId: 'WEB_MANUAL',
    templateItemId: '',
    createdAt: now,
    updatedAt: now,
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  return nextId;
}

async function updateSafety(item, payload) {
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await updateDoc(doc(db, 'safety_items', String(item._docId)), {
    title: payload.title,
    category: payload.category,
    location: payload.location || '',
    importance: payload.importance || 'MEDIUM',
    purchaseDate: payload.purchaseMs || 0,
    validityYears: payload.validityYears || 0,
    validityMonths: payload.validityMonths || 0,
    expiryDate: payload.expiryMs || 0,
    nextInspectionDate: payload.nextInspectionMs || 0,
    alertDaysBefore: payload.alertDays || 30,
    notes: payload.notes || '',
    updatedAt: now,
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