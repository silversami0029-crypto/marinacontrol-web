import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/AssignDocumentOwnerSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import {
  collection, query, where, getDocs, doc, updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export async function showAssignDocumentOwnerSheet(item) {
  const clientId = Number(store.activeClientId);
  if (!clientId) { toast(tr('No active client'), { kind: 'error' }); return; }

  const crewNames = await loadCrewNames(clientId, item.boatId);
  const current = item.assignedTo || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${tr("Assign Owner")}</div>

    <div class="ao-scroll">
      ${crewNames.length === 0
        ? `<div class="assign-empty">${tr("No crew members found.")}<br>${tr("Add crew first.")}</div>`
        : crewNames.map(name => `
            <button type="button" class="ao-row${name === current ? ' is-current' : ''}" data-name="${escapeAttr(name)}">
              <span class="ao-radio"></span>
              <span class="ao-name">${escapeHtml(name)}</span>
              ${name === current ? '<span class="ao-check">✓</span>' : ''}
            </button>
          `).join('')}
    </div>

    <div class="ao-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="doCancel">${tr("Cancel")}</button>
      ${current ? `<button type="button" class="csv-btn ao-unassign" id="doUnassign">${tr("Unassign")}</button>` : ''}
      <button type="button" class="csv-btn csv-btn--choose" id="doAssign">${tr("Assign")}</button>
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
  sheet.querySelector('#doCancel').addEventListener('click', close);

  let picked = current;

  sheet.querySelectorAll('.ao-row').forEach(row => {
    row.addEventListener('click', () => {
      picked = row.dataset.name;
      sheet.querySelectorAll('.ao-row').forEach(r => {
        r.classList.toggle('is-current', r.dataset.name === picked);
        const check = r.querySelector('.ao-check');
        if (check) check.remove();
        if (r.dataset.name === picked) {
          const span = document.createElement('span');
          span.className = 'ao-check';
          span.textContent = '✓';
          r.appendChild(span);
        }
      });
    });
  });

  sheet.querySelector('#doAssign').addEventListener('click', async () => {
    if (!picked) { toast(tr('Select a crew member'), { kind: 'error' }); return; }
    close();
    await setOwner(item, picked);
  });

  const unassignBtn = sheet.querySelector('#doUnassign');
  if (unassignBtn) {
    unassignBtn.addEventListener('click', async () => {
      close();
      await setOwner(item, null);
    });
  }
}

async function loadCrewNames(clientId, boatId) {
  try {
    const snap = await getDocs(
      query(collection(db, 'crew'), where('clientId', '==', clientId))
    );
    const unique = new Set();
    snap.forEach(d => {
      const data = d.data();
      const name = (data.name || '').trim();
      if (!name) return;
      const crewBoatId = data.boatId;
      if (boatId && crewBoatId != null && Number(crewBoatId) !== Number(boatId) && Number(crewBoatId) !== 0) return;
      unique.add(name);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error('[assign doc owner] crew load failed', err);
    return [];
  }
}

async function setOwner(item, name) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    await updateDoc(doc(db, 'documents', String(item._docId)), {
      assignedTo: name || '',
      lastModified: now,
      lastModifiedBy: userId
    });

    toast(name ? `Assigned to ${name}` : tr('Unassigned'), { kind: 'success' });
  } catch (err) {
    console.error('[assign doc owner] save failed', err);
    toast(tr('Failed to assign owner'), { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}