// js/screens/AddInventorySheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const INVENTORY_TYPES = [
  'Appliance', 'Audio', 'Canvas', 'Lighting', 'Mechanical', 'Electrical',
  'Hull', 'Watersport Toys', 'Videos', 'Transmission', 'Thrusters',
  'Tank (Water)', 'Tank (Fuel)', 'Steering', 'Stabilizer', 'Solar',
  'Rigging and Sails', 'Propulsion', 'Plumbing', 'Painting', 'Other',
  'Oil Analysis', 'Network', 'Mechanical (Other)', 'Life Support Systems',
  'Hydraulics', 'HVAC', 'Generator', 'Furniture', 'Fuel System',
  'Flooring', 'Fishing', 'Financial', 'Engine', 'Electronics',
  'Desk Equipment', 'Auxiliary Equipment'
];

const INVENTORY_UNITS = ['PCS', 'L', 'ml', 'kg', 'g', 'm', 'cm', 'roll', 'box', 'pair', 'set'];

const BOAT_LOCATIONS = [
  'Aft', 'Anchor Locker', 'Bilge', 'Bow', 'Bunk', 'Cabin', 'Cabin - Port',
  'Cabin - Starboard', 'T-Top', 'Utility Room', 'V-Berth', 'Wheelhouse',
  'Running Gear (Port)', 'Running Gear (Starboard)', 'Radar Arch', 'Forepeak',
  'Galley', 'Salon', 'Cockpit', 'Deck Locker', 'Engine Room', 'Bridge',
  'Salon - Port', 'Salon - Starboard', 'Settee', 'Skylounge', 'Stateroom',
  'Locker - Starboard', 'Locker - Port', 'Foredeck', 'Stern'
];

export function showAddInventorySheet(opts = {}) {
  const { boatId, boatName, item } = opts;
  const isEdit = !!item;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">
      ${isEdit ? 'Edit Inventory' : 'Add Inventory'}
    </div>

    <form id="invForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">
        ${boatName ? `
          <label class="add-label">Boat</label>
          <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
            Boat: ${escapeHtml(boatName)}
          </div>
        ` : ''}

        <label class="add-label" for="inv-name">Item Name</label>
        <input class="add-input" id="inv-name" type="text" placeholder="e.g. Engine Oil 15W-40">

        <label class="add-label" for="inv-category">Category</label>
        <select class="add-input add-select" id="inv-category">
          <option value="">Select category…</option>
          ${INVENTORY_TYPES.map(t => `<option value="${escapeAttr(t)}">${escapeHtml(t)}</option>`).join('')}
        </select>

        <label class="add-label" for="inv-location">Location</label>
        <select class="add-input add-select" id="inv-location">
          <option value="">Select location…</option>
          ${BOAT_LOCATIONS.map(l => `<option value="${escapeAttr(l)}">${escapeHtml(l)}</option>`).join('')}
        </select>

        <label class="add-label" for="inv-quantity">Quantity</label>
        <input class="add-input" id="inv-quantity" type="number" inputmode="numeric" min="0" step="1" placeholder="0">

        <label class="add-label" for="inv-reorder">Reorder Level</label>
        <input class="add-input" id="inv-reorder" type="number" inputmode="numeric" min="0" step="1" placeholder="0">

        <label class="add-label" for="inv-unit">Unit</label>
        <select class="add-input add-select" id="inv-unit">
          <option value="">Select unit…</option>
          ${INVENTORY_UNITS.map(u => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`).join('')}
        </select>

        <label class="add-label" for="inv-supplier">Supplier</label>
        <input class="add-input" id="inv-supplier" type="text" placeholder="Supplier name">

        <label class="add-label" for="inv-notes">Notes</label>
        <textarea class="add-input" id="inv-notes" rows="3" placeholder="Notes"></textarea>
      </div>

      <button type="submit" class="add-save" id="inv-save">
        ${isEdit ? 'Update Item' : '+ Add Item'}
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
    sheet.querySelector('#inv-name').value = item.name || '';
    setSelectValue(sheet.querySelector('#inv-category'), item.category || '');
    setSelectValue(sheet.querySelector('#inv-location'), item.location || '');
    sheet.querySelector('#inv-quantity').value = String(item.quantity ?? 0);
    sheet.querySelector('#inv-reorder').value = String(item.reorderLevel ?? 0);
    setSelectValue(sheet.querySelector('#inv-unit'), item.unit || '');
    sheet.querySelector('#inv-supplier').value = item.supplier || '';
    sheet.querySelector('#inv-notes').value = item.notes || '';
  }

  const form = sheet.querySelector('#invForm');
  const save = sheet.querySelector('#inv-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name         = sheet.querySelector('#inv-name').value.trim();
    const category     = sheet.querySelector('#inv-category').value;
    const location     = sheet.querySelector('#inv-location').value;
    const quantityStr  = sheet.querySelector('#inv-quantity').value.trim();
    const reorderStr   = sheet.querySelector('#inv-reorder').value.trim();
    const unit         = sheet.querySelector('#inv-unit').value;
    const supplier     = sheet.querySelector('#inv-supplier').value.trim();
    const notes        = sheet.querySelector('#inv-notes').value.trim();

    if (!name) { toast('Enter an item name', { kind: 'error' }); sheet.querySelector('#inv-name').focus(); return; }
    if (!category) { toast('Select a category', { kind: 'error' }); return; }

    const quantity = quantityStr === '' ? 0 : Math.max(0, parseInt(quantityStr, 10) || 0);
    const reorderLevel = reorderStr === '' ? 0 : Math.max(0, parseInt(reorderStr, 10) || 0);

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateInventory(item, { name, category, location, quantity, reorderLevel, unit, supplier, notes });
      } else {
        if (!boatId) throw new Error('No boat selected');
        await createInventory({ boatId, name, category, location, quantity, reorderLevel, unit, supplier, notes });
      }
      close();
      toast(isEdit ? 'Item updated' : 'Item added', { kind: 'success' });
    } catch (err) {
      console.error('[inventory save] failed', err);
      save.disabled = false;
      save.textContent = isEdit ? 'Update Item' : '+ Add Item';
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

// Android parity: qty<=0 OUT_OF_STOCK, qty<=1 CRITICAL, qty<=3 LOW_STOCK, else IN_STOCK
function computeStatus(quantity) {
  const q = Number(quantity || 0);
  if (q <= 0) return 'OUT_OF_STOCK';
  if (q <= 1) return 'CRITICAL';
  if (q <= 3) return 'LOW_STOCK';
  return 'IN_STOCK';
}

async function createInventory(payload) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  const snap = await getDocs(
    query(collection(db, 'inventory'), where('clientId', '==', clientId))
  );
  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);
  const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `inv-${now}-${nextId}`);
  const status = computeStatus(payload.quantity);

  await setDoc(doc(db, 'inventory', cloudId), {
    id: nextId,
    clientId,
    boatId: Number(payload.boatId),
    name: payload.name,
    category: payload.category,
    location: payload.location || '',
    quantity: payload.quantity,
    reorderLevel: payload.reorderLevel,
    unit: payload.unit || 'PCS',
    supplier: payload.supplier || '',
    notes: payload.notes || '',
    status,
    assignedTo: '',
    assignedBy: '',
    assignedAt: 0,
    lastUpdated: '',
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  await logHistory({
    entityType: 'INVENTORY',
    entityId: nextId,
    itemName: payload.name,
    boatId: payload.boatId,
    action: 'CREATED',
    title: 'Item created',
    detail: `Qty: ${payload.quantity}${payload.unit ? ' ' + payload.unit : ''}`
  });

  return nextId;
}

async function updateInventory(item, payload) {
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);
  const status = computeStatus(payload.quantity);

  await updateDoc(doc(db, 'inventory', String(item._docId)), {
    name: payload.name,
    category: payload.category,
    location: payload.location || '',
    quantity: payload.quantity,
    reorderLevel: payload.reorderLevel,
    unit: payload.unit || 'PCS',
    supplier: payload.supplier || '',
    notes: payload.notes || '',
    status,
    lastModified: now,
    lastModifiedBy: userId
  });

  await logHistory({
    entityType: 'INVENTORY',
    entityId: item.id,
    itemName: payload.name,
    boatId: item.boatId,
    action: 'UPDATED',
    title: 'Item edited',
    detail: ''
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