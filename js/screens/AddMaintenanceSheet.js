// js/screens/AddMaintenanceSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const MAINTENANCE_TYPES = [
  'Engine', 'Electrical', 'Plumbing', 'Hull', 'Deck', 'Rigging',
  'Navigation', 'Safety Equipment', 'HVAC', 'Fuel System',
  'Steering', 'Bilge', 'Interior', 'Exterior', 'Other'
];

/**
 * Open the Add/Edit Maintenance form.
 * @param {Object} opts
 * @param {Object} [opts.item]   Pass a maintenance item to edit; omit to add.
 * @param {Function} [opts.onSaved] Callback after save.
 */
export async function showAddMaintenanceSheet(opts = {}) {
  const { item, onSaved } = opts;
  const isEdit = !!item;

  const boat = await resolveActiveBoat(isEdit && item ? item.boatId : 0);

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">
      ${isEdit ? 'Edit Maintenance' : 'Add Maintenance'}
    </div>

    <form id="amForm" class="add-form" novalidate>
      <div class="add-scroll">

        <label class="add-label">Boat</label>
        <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
          ${boat && boat.name ? `Boat: ${escapeHtml(boat.name)}` : 'No active boat'}
        </div>

        <label class="add-label" for="am-type">Type</label>
        <select class="add-input add-select" id="am-type">
          ${MAINTENANCE_TYPES.map(t => `
            <option value="${escapeAttr(t)}" ${isEdit && item.type === t ? 'selected' : ''}>${escapeHtml(t)}</option>
          `).join('')}
        </select>

        <label class="add-label" for="am-date">Date</label>
        <input class="add-input" id="am-date" type="date">

        <label class="add-label" for="am-notes">Notes</label>
        <textarea class="add-input" id="am-notes" rows="3"
                  placeholder="Describe the work or issue"></textarea>
      </div>

      <button type="submit" class="add-save" id="am-save">
        ${isEdit ? 'Update Maintenance' : 'Add Maintenance'}
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

  // Prefill
  const today = new Date().toISOString().slice(0, 10);
  if (isEdit) {
    sheet.querySelector('#am-date').value = item.date || today;
    sheet.querySelector('#am-notes').value = item.notes || '';
  } else {
    sheet.querySelector('#am-date').value = today;
  }

  const form = sheet.querySelector('#amForm');
  const save = sheet.querySelector('#am-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type  = sheet.querySelector('#am-type').value;
    const date  = sheet.querySelector('#am-date').value;
    const notes = sheet.querySelector('#am-notes').value.trim();

    if (!type)  { toast('Select a type', { kind: 'error' }); return; }
    if (!date)  { toast('Select a date', { kind: 'error' }); return; }
    if (!boat || !boat.id) {
      toast('No active boat — set a boat first', { kind: 'error' });
      return;
    }

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateMaintenance(item, { type, date, notes, boatId: boat.id });
      } else {
        await createMaintenance({ type, date, notes, boatId: boat.id, boatName: boat.name });
      }
      close();
      toast(isEdit ? 'Maintenance updated' : 'Maintenance added', { kind: 'success' });
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[maintenance save] failed', err);
      save.disabled = false;
      save.textContent = isEdit ? 'Update Maintenance' : 'Add Maintenance';
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

/* ============================================================
   HELPERS
   ============================================================ */
async function resolveActiveBoat(preferBoatId) {
  const clientId = Number(store.activeClientId);
  if (!clientId) return null;

  try {
    if (preferBoatId) {
      const snap = await getDocs(
        query(
          collection(db, 'boats'),
          where('clientId', '==', clientId),
          where('id', '==', Number(preferBoatId))
        )
      );
      if (!snap.empty) {
        const d = snap.docs[0].data();
        return { id: Number(d.id), name: d.name || '' };
      }
    }

    const snap = await getDocs(
      query(
        collection(db, 'boats'),
        where('clientId', '==', clientId),
        where('isActive', '==', true)
      )
    );
    if (!snap.empty) {
      const d = snap.docs[0].data();
      return { id: Number(d.id), name: d.name || '' };
    }
  } catch (err) {
    console.error('[maintenance form] boat lookup failed', err);
  }
  return null;
}

async function createMaintenance({ type, date, notes, boatId, boatName }) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  // Next numeric id
  const snap = await getDocs(
    query(collection(db, 'maintenance'), where('clientId', '==', clientId))
  );

  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await setDoc(doc(db, 'maintenance', String(nextId)), {
    id: nextId,
    cloudId: crypto.randomUUID ? crypto.randomUUID() : String(now),
    clientId,
    boatId: Number(boatId),
    berthId: null,
    assetId: null,
    type,
    date,
    notes: notes || '',
    completed: false,
    status: 'ACTIVE',
    source: 'MANUAL',
    priority: null,
    assignedTo: null,
    assignedBy: null,
    assignedAt: 0,
    deferReason: null,
    riskLevel: null,
    mitigation: null,
    reviewDate: null,
    deferredBy: null,
    deferredAt: 0,
    reviewStatus: null,
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  return nextId;
}

async function updateMaintenance(item, { type, date, notes, boatId }) {
  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await updateDoc(doc(db, 'maintenance', String(item._docId)), {
    type,
    date,
    notes: notes || '',
    boatId: Number(boatId),
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