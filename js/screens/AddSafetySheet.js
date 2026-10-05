import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs,
  doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const CATEGORIES = [
  'Fire Safety', 'Life Saving', 'Navigation', 'Communication',
  'Pyrotechnics', 'First Aid', 'Safety Equipment', 'Emergency',
  'Pollution Prevention', 'Other'
];

const IMPORTANCE = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// Matches Android's safety_location_display options.
const LOCATIONS = [
  'Cockpit',
  'Galley',
  'Bridge/Wheelhouse',
  'Saloon',
  'Engine Room',
  'Foredeck',
  'Aft Deck',
  'Life Raft Locker',
  'Emergency Locker'
];

const OTHER_LOCATION = '__OTHER__';

export function showAddSafetySheet(opts = {}) {
  const { boatId, boatName, item } = opts;
  const isEdit = !!item;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="safety-sheet-header"
      style="position:sticky;top:0;z-index:2;flex-shrink:0;
        display:flex;align-items:center;min-height:48px;
        background:var(--color-surface,#1C222A);">

      <div class="sheet-title"
        style="flex:1;margin:0;padding:12px 48px;text-align:center;">
        ${isEdit ? tr('Edit Safety') : tr('Add Safety')}
      </div>

      <button type="button" id="iv-close"
        aria-label="${tr('Close safety sheet')}"
        style="position:absolute;right:0;top:2px;display:grid;
          place-items:center;width:44px;height:44px;padding:0;
          border:0;border-radius:8px;background:transparent;
          color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22"
          fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18"/>
        </svg>
      </button>
    </div>

    <form id="sfForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">
        ${boatName ? `
          <label class="add-label">${tr('Boat')}</label>
          <div class="add-input"
            style="padding-top:14px;padding-bottom:14px;
              color:var(--color-text-secondary);">
            ${tr('Boat:')} ${escapeHtml(boatName)}
          </div>
        ` : ''}

        <label class="add-label" for="sf-title">${tr('Title')}</label>
        <input class="add-input" id="sf-title" type="text"
          placeholder="${tr('e.g. SOLAS Red Parachute Flare')}">

        <label class="add-label" for="sf-category">
          ${tr('Category')}
        </label>
        <select class="add-input add-select" id="sf-category">
          <option value="">${tr('Select category…')}</option>
          ${CATEGORIES.map(category => `
            <option value="${escapeAttr(category)}">
              ${escapeHtml(tr(category))}
            </option>
          `).join('')}
        </select>

        <label class="add-label" for="sf-location">
          ${tr('Location')}
        </label>
        <select class="add-input add-select" id="sf-location"
          aria-controls="sf-location-other-group">
          <option value="">
            ${escapeHtml(tr('Select location…'))}
          </option>
          ${LOCATIONS.map(location => `
            <option value="${escapeAttr(location)}">
              ${escapeHtml(tr(location))}
            </option>
          `).join('')}
          <option value="${OTHER_LOCATION}">
            ${escapeHtml(tr('Other (specify below)'))}
          </option>
        </select>

        <div id="sf-location-other-group" hidden>
          <label class="add-label" for="sf-location-other">
            ${escapeHtml(tr('Specify location'))}
          </label>
          <input class="add-input" id="sf-location-other"
            type="text" disabled
            placeholder="${escapeAttr(
              tr('e.g. Waterproof cockpit locker')
            )}">
        </div>

        <label class="add-label" for="sf-importance">
          ${tr('Importance')}
        </label>
        <select class="add-input add-select" id="sf-importance">
          ${IMPORTANCE.map(importance => `
            <option value="${importance}"
              ${importance === 'MEDIUM' ? 'selected' : ''}>
              ${escapeHtml(tr(importance))}
            </option>
          `).join('')}
        </select>

        <label class="add-label" for="sf-purchase">
          ${tr('Purchase Date')}
        </label>
        <input class="add-input" id="sf-purchase" type="date">

        <label class="add-label" for="sf-validity-years">
          ${tr('Validity (Years)')}
        </label>
        <input class="add-input" id="sf-validity-years"
          type="number" min="0" value="0">

        <label class="add-label" for="sf-validity-months">
          ${tr('Validity (Months)')}
        </label>
        <input class="add-input" id="sf-validity-months"
          type="number" min="0" value="0">

        <label class="add-label" for="sf-expiry">
          ${tr('Expiry Date (manual override)')}
        </label>
        <input class="add-input" id="sf-expiry" type="date">

        <label class="add-label" for="sf-notes">
          ${tr('Notes')}
        </label>
        <textarea class="add-input" id="sf-notes" rows="3"
          placeholder="${tr('Notes')}"></textarea>
      </div>

      <button type="submit" class="add-save" id="sf-save">
        ${isEdit ? tr('Update Safety Item') : tr('+ Add Safety Item')}
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

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('#iv-close').addEventListener('click', close);

  if (isEdit) {
    sheet.querySelector('#sf-title').value = item.title || '';
    sheet.querySelector('#sf-category').value = item.category || '';

    const savedLocation = String(item.location || '').trim();

    if (!savedLocation || LOCATIONS.includes(savedLocation)) {
      sheet.querySelector('#sf-location').value = savedLocation;
    } else {
      // Preserve existing custom locations, such as "Bow".
      sheet.querySelector('#sf-location').value = OTHER_LOCATION;
      sheet.querySelector('#sf-location-other').value = savedLocation;
    }

    sheet.querySelector('#sf-importance').value =
      item.importance || 'MEDIUM';

    if (item.purchaseDate > 0) {
      sheet.querySelector('#sf-purchase').value =
        new Date(item.purchaseDate).toISOString().slice(0, 10);
    }

    sheet.querySelector('#sf-validity-years').value =
      item.validityYears || 0;

    sheet.querySelector('#sf-validity-months').value =
      item.validityMonths || 0;

    if (item.expiryDate > 0) {
      sheet.querySelector('#sf-expiry').value =
        new Date(item.expiryDate).toISOString().slice(0, 10);
    }

    sheet.querySelector('#sf-notes').value = item.notes || '';
  }

  const locationPicker = sheet.querySelector('#sf-location');
  const otherLocationGroup =
    sheet.querySelector('#sf-location-other-group');
  const otherLocationInput =
    sheet.querySelector('#sf-location-other');

  const updateLocationFields = (focus = false) => {
    const isOther = locationPicker.value === OTHER_LOCATION;

    otherLocationGroup.hidden = !isOther;
    otherLocationInput.disabled = !isOther;
    otherLocationInput.required = isOther;

    if (isOther && focus) otherLocationInput.focus();
  };

  locationPicker.addEventListener('change', () => {
    updateLocationFields(true);
  });

  updateLocationFields();

  const form = sheet.querySelector('#sfForm');
  const save = sheet.querySelector('#sf-save');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const title = sheet.querySelector('#sf-title').value.trim();
    const category = sheet.querySelector('#sf-category').value;

    const location = locationPicker.value === OTHER_LOCATION
      ? otherLocationInput.value.trim()
      : locationPicker.value;

    const importance = sheet.querySelector('#sf-importance').value;
    const purchaseRaw = sheet.querySelector('#sf-purchase').value;
    const yearsRaw = sheet.querySelector('#sf-validity-years').value;
    const monthsRaw = sheet.querySelector('#sf-validity-months').value;
    const expiryRaw = sheet.querySelector('#sf-expiry').value;
    const notes = sheet.querySelector('#sf-notes').value.trim();

    if (!title) {
      sheet.querySelector('#sf-title').focus();
      return;
    }

    if (!category) {
      toast(tr('Select a category'), { kind: 'error' });
      return;
    }

    if (locationPicker.value === OTHER_LOCATION && !location) {
      toast(tr('Specify a location'), { kind: 'error' });
      otherLocationInput.focus();
      return;
    }

    const purchaseMs = purchaseRaw
      ? new Date(purchaseRaw + 'T00:00:00').getTime()
      : 0;

    const validityYears = Math.max(0, Number(yearsRaw) || 0);
    const validityMonths = Math.max(0, Number(monthsRaw) || 0);

    // Explicit expiry overrides purchase date + validity.
    let expiryMs = expiryRaw
      ? new Date(expiryRaw + 'T00:00:00').getTime()
      : 0;

    if (!expiryMs && purchaseMs && (validityYears || validityMonths)) {
      const date = new Date(purchaseMs);
      date.setFullYear(date.getFullYear() + validityYears);
      date.setMonth(date.getMonth() + validityMonths);
      expiryMs = date.getTime();
    }

    const alertDays = 30;
    const nextInspectionMs = expiryMs
      ? expiryMs - alertDays * 24 * 60 * 60 * 1000
      : 0;

    save.disabled = true;
    save.textContent = tr('Saving…');

    try {
      const payload = {
        title,
        category,
        location,
        importance,
        purchaseMs,
        validityYears,
        validityMonths,
        expiryMs,
        nextInspectionMs,
        alertDays,
        notes
      };

      if (isEdit) {
        await updateSafety(item, payload);
      } else {
        if (!boatId) throw new Error(tr('No boat selected'));

        await createSafety({
          boatId,
          boatName,
          ...payload
        });
      }

      close();

      toast(
        isEdit ? tr('Safety item updated') : tr('Safety item added'),
        { kind: 'success' }
      );
    } catch (error) {
      console.error('[safety save] failed', error);

      save.disabled = false;
      save.textContent = isEdit
        ? tr('Update Safety Item')
        : tr('+ Add Safety Item');

      let errorElement = sheet.querySelector('.add-error');

      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'add-error';
        form.insertBefore(errorElement, save);
      }

      errorElement.textContent =
        error.message || tr('Failed to save.');
    }
  });
}

async function createSafety(payload) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error(tr('No active client'));

  const snap = await getDocs(
    query(
      collection(db, 'safety_items'),
      where('clientId', '==', clientId)
    )
  );

  let maxId = 0;

  snap.forEach(document => {
    const value = Number(document.data()?.id || 0);
    if (value > maxId) maxId = value;
  });

  const nextId = maxId + 1;
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  const cloudId = crypto.randomUUID
    ? crypto.randomUUID()
    : `s-${now}-${nextId}`;

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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}