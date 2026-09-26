import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const MAINTENANCE_TYPES = [
  'Engine',
  'Electrical',
  'Plumbing',
  'Hull',
  'Deck',
  'Rigging',
  'Navigation',
  'Safety Equipment',
  'HVAC',
  'Fuel System',
  'Steering',
  'Bilge',
  'Interior',
  'Exterior',
  'Other'
];

export async function showAddMaintenanceSheet(opts = {}) {
  const { item, onSaved } = opts;
  const isEdit = !!item;

  const boat = await resolveActiveBoat(
    isEdit && item ? item.boatId : 0
  );

  if (!boat || !boat.id) {
    toast('Set a boat as active first', {
      kind: 'error'
    });
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>

    <div class="sheet-title"
         style="text-align:center;">
      ${isEdit
        ? 'Edit Maintenance'
        : 'Add Maintenance'}
    </div>

    <form id="amForm"
          class="add-form"
          novalidate>

      <div class="add-scroll">

        <label class="add-label">
          Boat
        </label>

        <div class="add-input"
             style="
               padding-top:14px;
               padding-bottom:14px;
               color:var(--color-text-secondary);
             ">
          Boat:
          ${escapeHtml(
            boat.name || 'Unnamed'
          )}
        </div>

        <label class="add-label"
               for="am-type">
          Type
        </label>

        <select class="add-input add-select"
                id="am-type">
          ${MAINTENANCE_TYPES.map(type => `
            <option
              value="${escapeAttr(type)}"
              ${
                isEdit &&
                item.type === type
                  ? 'selected'
                  : ''
              }>
              ${escapeHtml(type)}
            </option>
          `).join('')}
        </select>

        <label class="add-label"
               for="am-date">
          Date
        </label>

        <input class="add-input"
               id="am-date"
               type="date">

        <label class="add-label"
               for="am-notes">
          Notes
        </label>

        <textarea
          class="add-input"
          id="am-notes"
          rows="3"
          placeholder="Describe the work or issue"
        ></textarea>

      </div>

      <button type="submit"
              class="add-save"
              id="am-save">
        ${isEdit
          ? 'Update Maintenance'
          : 'Add Maintenance'}
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

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (isEdit) {
    sheet.querySelector('#am-date').value =
      item.date || today;

    sheet.querySelector('#am-notes').value =
      item.notes || '';
  } else {
    sheet.querySelector('#am-date').value =
      today;
  }

  const form =
    sheet.querySelector('#amForm');

  const save =
    sheet.querySelector('#am-save');

  form.addEventListener(
    'submit',
    async event => {
      event.preventDefault();

      const type =
        sheet.querySelector('#am-type').value;

      const date =
        sheet.querySelector('#am-date').value;

      const notes =
        sheet
          .querySelector('#am-notes')
          .value
          .trim();

      if (!type) {
        toast('Select a type', {
          kind: 'error'
        });
        return;
      }

      if (!date) {
        toast('Select a date', {
          kind: 'error'
        });
        return;
      }

      save.disabled = true;
      save.textContent = 'Saving…';

      try {
        if (isEdit) {
          await updateMaintenance(item, {
            type,
            date,
            notes,
            boatId: boat.id
          });
        } else {
          await createMaintenance({
            type,
            date,
            notes,
            boatId: boat.id,
            boatName: boat.name
          });
        }

        close();

        toast(
          isEdit
            ? 'Maintenance updated'
            : 'Maintenance added',
          { kind: 'success' }
        );

        if (onSaved) {
          onSaved();
        }
      } catch (error) {
        console.error(
          '[maintenance save] failed',
          error
        );

        save.disabled = false;

        save.textContent = isEdit
          ? 'Update Maintenance'
          : 'Add Maintenance';

        let errorElement =
          sheet.querySelector('.add-error');

        if (!errorElement) {
          errorElement =
            document.createElement('div');

          errorElement.className =
            'add-error';

          form.insertBefore(
            errorElement,
            save
          );
        }

        errorElement.textContent =
          error.message ||
          'Failed to save.';
      }
    }
  );
}

async function resolveActiveBoat(
  preferBoatId
) {
  const clientId =
    Number(store.activeClientId);

  if (!clientId) return null;

  try {
    if (preferBoatId) {
      const snapshot = await getDocs(
        query(
          collection(db, 'boats'),
          where(
            'clientId',
            '==',
            clientId
          ),
          where(
            'id',
            '==',
            Number(preferBoatId)
          )
        )
      );

      if (!snapshot.empty) {
        const data =
          snapshot.docs[0].data();

        return {
          id: Number(data.id),
          name: data.name || ''
        };
      }
    }

    if (store.activeBoatId) {
      const snapshot = await getDocs(
        query(
          collection(db, 'boats'),
          where(
            'clientId',
            '==',
            clientId
          ),
          where(
            'id',
            '==',
            Number(store.activeBoatId)
          )
        )
      );

      if (!snapshot.empty) {
        const data =
          snapshot.docs[0].data();

        return {
          id: Number(data.id),
          name: data.name || ''
        };
      }
    }

    if (
      store.activeBoat &&
      store.activeBoat.id
    ) {
      return {
        id: Number(
          store.activeBoat.id
        ),
        name:
          store.activeBoat.name || ''
      };
    }

    const snapshot = await getDocs(
      query(
        collection(db, 'boats'),
        where(
          'clientId',
          '==',
          clientId
        ),
        where(
          'isActive',
          '==',
          true
        )
      )
    );

    if (!snapshot.empty) {
      const data =
        snapshot.docs[0].data();

      return {
        id: Number(data.id),
        name: data.name || ''
      };
    }
  } catch (error) {
    console.error(
      '[maintenance form] boat lookup failed',
      error
    );
  }

  return null;
}

async function createMaintenance({
  type,
  date,
  notes,
  boatId,
  boatName
}) {
  const clientId =
    Number(store.activeClientId);

  if (!clientId) {
    throw new Error('No active client');
  }

  const now = Date.now();
  const nextId = now;

  const userId = String(
    store.userProfile?.userId || 0
  );

  const cloudId =
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${clientId}_${nextId}`;

  await setDoc(
    doc(db, 'maintenance', cloudId),
    {
      id: nextId,
      cloudId,
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
    }
  );

  return nextId;
}

async function updateMaintenance(
  item,
  {
    type,
    date,
    notes,
    boatId
  }
) {
  const now = Date.now();

  const userId = String(
    store.userProfile?.userId || 0
  );

  await updateDoc(
    doc(
      db,
      'maintenance',
      String(item._docId)
    ),
    {
      type,
      date,
      notes: notes || '',
      boatId: Number(boatId),
      lastModified: now,
      lastModifiedBy: userId
    }
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(
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

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}