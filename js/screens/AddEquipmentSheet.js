// js/screens/AddEquipmentSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';
import { logHistory } from '../util/history.js';

const EQUIPMENT_TYPES = [
  'Engine', 'Generator', 'Electrical - Battery', 'Electrical - Charger',
  'Electrical - Inverter', 'Electrical - Panel', 'Navigation', 'Electronics',
  'HVAC', 'Refrigeration', 'Plumbing - Pumps', 'Plumbing - Toilets',
  'Safety', 'Galley', 'Deck', 'Rigging', 'Other'
];

const EQUIPMENT_STATUS = ['OPERATIONAL', 'SERVICE_DUE', 'FAULT', 'OUT_OF_SERVICE'];

const EQUIPMENT_MANUFACTURERS = [
  'ABB', 'Abu Garcia', 'Avon Protection', 'Garmin Marine', 'Mercury Marine',
  'Yamaha Marine', 'Volvo Penta', 'Suzuki Marine', 'Honda Marine', 'Raymarine',
  'Furuno', 'Simrad', 'Lewmar', 'Harken', 'Blue Sea Systems', 'Cummins Marine',
  'Caterpillar Marine', 'Mustang Survival', 'Zodiac', 'ACR Electronics',
  'Dometic', 'Jabsco', 'Raritan', 'Sea-Dog', 'Perko', 'Rule', 'Attwood',
  'Victron Energy', 'Mastervolt', 'Shimano', 'Penn Fishing', 'T-H Marine',
  'Star brite', 'Interlux', '3M Marine', 'Kohler', 'Northern Lights', 'Webasto',
  'Bennett', 'Lenco', 'SeaStar', 'Humminbird', 'Lowrance', 'ICOM',
  'Fusion Entertainment', 'KVH', 'Torqeedo', 'BRP', 'Custom', 'Other'
];

const BOAT_LOCATIONS = [
  'Aft', 'Anchor Locker', 'Bilge', 'Bow', 'Bunk', 'Cabin', 'Cabin - Port',
  'Cabin - Starboard', 'T-Top', 'Utility Room', 'V-Berth', 'Wheelhouse',
  'Running Gear (Port)', 'Running Gear (Starboard)', 'Radar Arch', 'Forepeak',
  'Galley', 'Salon', 'Cockpit', 'Deck Locker', 'Engine Room', 'Bridge',
  'Salon - Port', 'Salon - Starboard', 'Settee', 'Skylounge', 'Stateroom',
  'Locker - Starboard', 'Locker - Port', 'Foredeck', 'Stern'
];

export function showAddEquipmentSheet(opts = {}) {
  const { boatId, boatName, item } = opts;
  const isEdit = !!item;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="invoice-sheet-header"
  style="position:sticky;top:0;z-index:2;flex-shrink:0;display:flex;align-items:center;min-height:48px;background:var(--color-surface, #1C222A);">

  <div class="sheet-title"
    style="flex:1;margin:0;padding:12px 48px;text-align:center;">
    ${isEdit ? 'Edit Invoice' : 'Add Equipment'}
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

    <form id="eqForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">
        ${boatName ? `
          <label class="add-label">Boat</label>
          <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
            Boat: ${escapeHtml(boatName)}
          </div>
        ` : ''}

        <label class="add-label" for="eq-manufacturer">Manufacturer</label>
        <select class="add-input add-select" id="eq-manufacturer">
          <option value="">Select manufacturer…</option>
          ${EQUIPMENT_MANUFACTURERS.map(m => `<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('')}
        </select>

        <label class="add-label" for="eq-model">Model</label>
        <input class="add-input" id="eq-model" type="text" placeholder="e.g. Verado 300">

        <label class="add-label" for="eq-type">Type</label>
        <select class="add-input add-select" id="eq-type">
          <option value="">Select type…</option>
          ${EQUIPMENT_TYPES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
        </select>

        <label class="add-label" for="eq-serial">Serial Number</label>
        <input class="add-input" id="eq-serial" type="text" placeholder="Serial number">

        <label class="add-label" for="eq-location">Location</label>
        <select class="add-input add-select" id="eq-location">
          <option value="">Select location…</option>
          ${BOAT_LOCATIONS.map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('')}
        </select>

        <label class="add-label" for="eq-status">Status</label>
        <select class="add-input add-select" id="eq-status">
          ${EQUIPMENT_STATUS.map(s => `<option value="${s}">${s}</option>`).join('')}
        </select>

        <label class="add-label" for="eq-notes">Notes</label>
        <textarea class="add-input" id="eq-notes" rows="3" placeholder="Notes"></textarea>
      </div>

      <button type="submit" class="add-save" id="eq-save">
        ${isEdit ? 'Update Equipment' : '+ Add Equipment'}
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
    setSelectValue(sheet.querySelector('#eq-manufacturer'), item.manufacturer || '');
    sheet.querySelector('#eq-model').value = item.model || '';
    sheet.querySelector('#eq-type').value = item.type || '';
    sheet.querySelector('#eq-serial').value = item.serialNumber || '';
    setSelectValue(sheet.querySelector('#eq-location'), item.location || '');
    sheet.querySelector('#eq-status').value = item.status || 'OPERATIONAL';
    sheet.querySelector('#eq-notes').value = item.notes || '';
  }

  const form = sheet.querySelector('#eqForm');
  const save = sheet.querySelector('#eq-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const manufacturer = sheet.querySelector('#eq-manufacturer').value.trim();
    const model        = sheet.querySelector('#eq-model').value.trim();
    const type         = sheet.querySelector('#eq-type').value;
    const serialNumber = sheet.querySelector('#eq-serial').value.trim();
    const location     = sheet.querySelector('#eq-location').value.trim();
    const status       = sheet.querySelector('#eq-status').value;
    const notes        = sheet.querySelector('#eq-notes').value.trim();

    if (!manufacturer) { toast('Select a manufacturer', { kind: 'error' }); sheet.querySelector('#eq-manufacturer').focus(); return; }
    if (!type)         { toast('Select a type', { kind: 'error' }); return; }

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateEquipment(item, { manufacturer, model, type, serialNumber, location, status, notes });
      } else {
        if (!boatId) throw new Error('No boat selected');
        await createEquipment({ boatId, manufacturer, model, type, serialNumber, location, status, notes });
      }
      close();
      toast(isEdit ? 'Equipment updated' : 'Equipment added', { kind: 'success' });
    } catch (err) {
      console.error('[equipment save] failed', err);
      save.disabled = false;
      save.textContent = isEdit ? 'Update Equipment' : '+ Add Equipment';
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

// If value isn't one of the existing <option>s, inject it so edit mode
// doesn't silently blank a legacy value.
function setSelectValue(select, value) {
  if (!select) return;
  if (!value) { select.value = ''; return; }
  const exists = Array.from(select.options).some(o => o.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
  select.value = value;
}

async function createEquipment(payload) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  const snap = await getDocs(
    query(collection(db, 'equipment'), where('clientId', '==', clientId))
  );
  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);
  const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `eq-${now}-${nextId}`);

  await setDoc(doc(db, 'equipment', cloudId), {
    id: nextId,
    clientId,
    boatId: Number(payload.boatId),
    manufacturer: payload.manufacturer,
    model: payload.model || '',
    type: payload.type,
    serialNumber: payload.serialNumber || '',
    location: payload.location || '',
    status: payload.status || 'OPERATIONAL',
    assignedTo: '',
    assignedBy: '',
    assignedAt: 0,
    notes: payload.notes || '',
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  await logHistory({
    entityType: 'EQUIPMENT',
    entityId: nextId,
    itemName: payload.manufacturer,
    boatId: payload.boatId,
    action: 'CREATED',
    title: 'Equipment created',
    detail: `${payload.type || ''}${payload.model ? ' — ' + payload.model : ''}`
  });

  return nextId;
}

async function updateEquipment(item, payload) {
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await updateDoc(doc(db, 'equipment', String(item._docId)), {
    manufacturer: payload.manufacturer,
    model: payload.model || '',
    type: payload.type,
    serialNumber: payload.serialNumber || '',
    location: payload.location || '',
    status: payload.status || 'OPERATIONAL',
    notes: payload.notes || '',
    lastModified: now,
    lastModifiedBy: userId
  });

  await logHistory({
    entityType: 'EQUIPMENT',
    entityId: item.id,
    itemName: payload.manufacturer,
    boatId: item.boatId,
    action: 'UPDATED',
    title: 'Equipment edited'
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