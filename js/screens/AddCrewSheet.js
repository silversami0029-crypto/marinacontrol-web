// js/screens/AddCrewSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showAddCrewChooser() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Add Crew</div>

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
        <div class="sheet-item-title">Add Single Crew</div>
        <div class="sheet-item-subtitle">Add one crew member with all details</div>
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
        <div class="sheet-item-subtitle">Import multiple crew from CSV</div>
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

  sheet.querySelector('#acsAddSingle').addEventListener('click', () => {
    close();
    setTimeout(showAddCrewForm, 250);
  });

  sheet.querySelector('#acsBulkImport').addEventListener('click', () => {
    close();
    setTimeout(() => {
      import('./ImportCrewSheet.js').then(m => m.showImportCrewSheet());
    }, 250);
  });
}

function showAddCrewForm() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Add Crew</div>

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

        <label class="add-label" for="acs-role">Role</label>
        <select class="add-input add-select" id="acs-role" name="acs-role">
          <option value="">Select role…</option>
          <option value="Captain">Captain</option>
          <option value="First Mate">First Mate</option>
          <option value="Mate">Mate</option>
          <option value="Deck Officer">Deck Officer</option>
          <option value="Deckhand">Deckhand</option>
          <option value="Engineer">Engineer</option>
          <option value="Chief Engineer">Chief Engineer</option>
          <option value="Navigator">Navigator</option>
          <option value="Boatswain">Boatswain</option>
          <option value="Steward">Steward</option>
          <option value="Stewardess">Stewardess</option>
          <option value="Cook">Cook</option>
          <option value="Marina Staff">Marina Staff</option>
          <option value="Harbor Master">Harbor Master</option>
          <option value="Pilot">Pilot</option>
          <option value="Guest">Guest</option>
          <option value="Owner">Owner</option>
        </select>

        <label class="add-label" for="acs-notes">Notes</label>
        <textarea class="add-input" id="acs-notes" name="acs-notes"
                  placeholder="Notes" rows="3"
                  autocomplete="off" spellcheck="false"></textarea>
      </div>

      <button type="submit" class="add-save" id="acs-save">
        + Add Crew
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

    const name  = sheet.querySelector('#acs-name').value.trim();
    const email = sheet.querySelector('#acs-email').value.trim();
    const role  = sheet.querySelector('#acs-role').value.trim();
    const notes = sheet.querySelector('#acs-notes').value.trim();

    if (!name)  { sheet.querySelector('#acs-name').focus(); return; }
    if (!email) { sheet.querySelector('#acs-email').focus(); return; }
    if (!role)  { sheet.querySelector('#acs-role').focus(); return; }

    save.disabled = true;
    save.textContent = 'Adding…';

    try {
      await createCrew({ name, email, role, notes });
      close();
      toast(`Crew added: ${name}`, { kind: 'success' });
    } catch (err) {
      console.error('[add crew] failed', err);
      save.disabled = false;
      save.textContent = '+ Add Crew';
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to add crew member.';
    }
  });
}

/* ============================================================
   CREATE
   ============================================================ */
async function createCrew({ name, email, role, notes }) {
  const clientId = Number(store.activeClientId);
  if (!clientId) throw new Error('No active client');

  // Next numeric id
  const snap = await getDocs(
    query(collection(db, 'crew'), where('clientId', '==', clientId))
  );

  let maxId = 0;
  snap.forEach(d => {
    const v = Number(d.data()?.id || 0);
    if (v > maxId) maxId = v;
  });
  const nextId = maxId + 1;

  // Find active boat to associate
  let boatId = 0;
  try {
    const boatsSnap = await getDocs(
      query(
        collection(db, 'boats'),
        where('clientId', '==', clientId),
        where('isActive', '==', true)
      )
    );
    if (!boatsSnap.empty) {
      boatId = Number(boatsSnap.docs[0].data().id || 0);
    }
  } catch { /* ignore */ }

  const now = Date.now();
  const userId = String(store.userProfile?.userId || 0);

  await setDoc(doc(db, 'crew', String(nextId)), {
    id: nextId,
    clientId,
    boatId,
    name,
    email,
    role: role || '',
    notes: notes || '',
    status: 'OFF DUTY',
    createdAt: now,
    lastModified: now,
    lastModifiedBy: userId,
    syncTime: serverTimestamp(),
    syncedAt: 0
  });

  return nextId;
}