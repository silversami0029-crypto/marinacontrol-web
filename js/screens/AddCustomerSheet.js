// js/screens/AddCustomerSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

/* ============================================================
   STEP 1 — CHOOSER SHEET
   ============================================================ */
export function showAddCustomerChooser() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Add Customer</div>

    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="acsAddSingle">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <div class="sheet-item-text">
        <div class="sheet-item-title">Add Single Customer</div>
        <div class="sheet-item-subtitle">Add one customer manually with all details</div>
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

    <div class="sheet-item" id="acsBulkImport">
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
        <div class="sheet-item-title">Bulk Import</div>
        <div class="sheet-item-subtitle">Import multiple customers from a CSV file</div>
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

sheet.querySelector('#acsBulkImport').addEventListener('click', () => {
    close();
    setTimeout(() => {
      import('./ImportCustomersSheet.js').then(m => m.showImportCustomersSheet());
    }, 250);
  });
}

/* ============================================================
   STEP 2 — ADD CUSTOMER FORM
   ============================================================ */
function showAddCustomerForm() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Add Customer</div>

    <form id="acsForm" class="add-form" novalidate autocomplete="off">
      <input type="text"     name="fakeusernameremembered" style="display:none" tabindex="-1" autocomplete="username">
      <input type="password" name="fakepasswordremembered"  style="display:none" tabindex="-1" autocomplete="current-password">

      <div class="add-scroll">
        <label class="add-label" for="acs-name">Full Name</label>
        <input class="add-input" id="acs-name" name="acs-name"
               type="text" placeholder="Full Name"
               autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false">

        <label class="add-label" for="acs-email">Email</label>
        <input class="add-input" id="acs-email" name="acs-email"
               type="email" placeholder="Email"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">

        <label class="add-label" for="acs-phone">Phone</label>
        <input class="add-input" id="acs-phone" name="acs-phone"
               type="tel" placeholder="Phone"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">

        <label class="add-label" for="acs-notes">Notes</label>
        <textarea class="add-input" id="acs-notes" name="acs-notes"
                  placeholder="Notes" rows="3"
                  autocomplete="off" spellcheck="false"></textarea>

        <label class="add-checkbox">
          <input type="checkbox" id="acs-preferred">
          <span>★ Preferred Customer</span>
        </label>
      </div>

      <button type="submit" class="add-save" id="acs-save">
        + Add Customer
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

  const form = sheet.querySelector('#acsForm');
  const save = sheet.querySelector('#acs-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name        = sheet.querySelector('#acs-name').value.trim();
    const email       = sheet.querySelector('#acs-email').value.trim();
    const phone       = sheet.querySelector('#acs-phone').value.trim();
    const notes       = sheet.querySelector('#acs-notes').value.trim();
    const isPreferred = sheet.querySelector('#acs-preferred').checked;

    if (!name) { sheet.querySelector('#acs-name').focus(); return; }

    save.disabled = true;
    save.textContent = 'Adding…';

    try {
      await createCustomer({ name, email, phone, notes, isPreferred });
      close();
      toast(`Customer added: ${name}`, { kind: 'success' });
    } catch (err) {
      console.error('[add customer] failed', err);
      save.disabled = false;
      save.textContent = '+ Add Customer';
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to add customer.';
    }
  });
}

/* ============================================================
   CREATE
   ============================================================ */
async function createCustomer({ name, email, phone, notes, isPreferred }) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  // 1. Find next id = max(existing.id) + 1
  const snap = await getDocs(
    query(collection(db, 'customers'), where('clientId', '==', clientId))
  );

  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  // 2. Write doc keyed by that id
  const now = Date.now();
  const docRef = doc(db, 'customers', String(nextId));

  await setDoc(docRef, {
    id: nextId,
    clientId,
    name,
    email: email || '',
    phone: phone || '',
    notes: notes || '',
    isPreferred: !!isPreferred,
    createdDate: now,
    lastModified: now,
    lastModifiedBy: String(store.userProfile?.userId || 0),
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  return nextId;
}