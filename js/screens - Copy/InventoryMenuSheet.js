import { t } from '../i18n.js';
// js/screens/InventoryMenuSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { confirmSheet } from '../ui/confirm.js';
import { logHistory } from '../util/history.js';
import { showAddInventorySheet } from './AddInventorySheet.js';
import { showInventoryDetail } from './InventoryDetailSheet.js';
import { showInventoryHistory } from './InventoryHistorySheet.js';
import { showAdjustQuantitySheet } from './AdjustQuantitySheet.js';
import { showReceiveStockSheet } from './ReceiveStockSheet.js';
import { doc, deleteDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showInventoryMenu(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${escapeHtml(item.name || t('Inventory Item'))}</div>

    <div class="sheet-item" id="imView">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("View")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imEdit">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Edit")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imAdjust">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M3 20h4"/><path d="M7 4h4"/>
          <path d="M11 4v16"/><path d="M17 4v16"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Adjust Quantity")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imReceive">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14"/><path d="M5 12h14"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Receive Stock")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imAssign">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Assign Owner")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imReorder">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v6"/><path d="M12 22v-6"/>
          <path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 14.83l4.24 4.24"/>
          <path d="M2 12h6"/><path d="M22 12h-6"/>
          <path d="M4.93 19.07l4.24-4.24"/><path d="M14.83 9.17l4.24-4.24"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Set Reorder Level")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imDuplicate">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="12" height="12" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Duplicate")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item" id="imHistory">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/>
          <line x1="9" y1="17" x2="15" y2="17"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("History")}</div></div>
    </div>
    <div class="sheet-gap-8"></div>

    <div class="sheet-item sheet-item--danger" id="imDelete">
      <div class="sheet-item-icon">
        <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
        </svg>
      </div>
      <div class="sheet-item-text"><div class="sheet-item-title">${t("Delete")}</div></div>
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

  sheet.querySelector('#imView').addEventListener('click', () => {
    close(); setTimeout(() => showInventoryDetail(item), 250);
  });
  sheet.querySelector('#imEdit').addEventListener('click', () => {
    close(); setTimeout(() => showAddInventorySheet({ item }), 250);
  });
  sheet.querySelector('#imAdjust').addEventListener('click', () => {
    close(); setTimeout(() => showAdjustQuantitySheet(item), 250);
  });
  sheet.querySelector('#imReceive').addEventListener('click', () => {
    close(); setTimeout(() => showReceiveStockSheet(item), 250);
  });
  sheet.querySelector('#imAssign').addEventListener('click', () => {
    close(); setTimeout(() => showAssignOwner(item), 250);
  });
  sheet.querySelector('#imReorder').addEventListener('click', () => {
    close(); setTimeout(() => showSetReorderLevel(item), 250);
  });
  sheet.querySelector('#imDuplicate').addEventListener('click', () => {
    close(); setTimeout(() => duplicateInventory(item), 250);
  });
  sheet.querySelector('#imHistory').addEventListener('click', () => {
    close(); setTimeout(() => showInventoryHistory(item), 250);
  });
  sheet.querySelector('#imDelete').addEventListener('click', async () => {
    close(); await deleteInventory(item);
  });
}

/* ---------- Assign Owner ---------- */
async function showAssignOwner(item) {
  const clientId = Number(store.activeClientId);

  const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { db } = await import('../firebase.js');

  let crewNames = [];
  try {
    const snap = await getDocs(query(
      collection(db, 'crew'),
      where('clientId', '==', clientId)
    ));
    const unique = new Set();
    snap.forEach(d => {
      const name = (d.data().name || '').trim();
      if (name) unique.add(name);
    });
    crewNames = Array.from(unique).sort((a, b) => a.localeCompare(b));
  } catch {}

  const current = item.assignedTo || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${t("Assign Owner")}</div>

    <div class="ao-scroll">
      ${crewNames.length === 0
        ? `<div class="assign-empty">${t("No crew members found.")}<br>${t("Add crew first.")}</div>`
        : crewNames.map(name => `
            <button type="button" class="ao-row${name === current ? ' is-current' : ''}" data-name="${escapeAttr(name)}">
              <span class="ao-radio"></span>
              <span class="ao-name">${escapeHtml(name)}</span>
              ${name === current ? '<span class="ao-check">✓</span>' : ''}
            </button>
          `).join('')}
    </div>

    <div class="ao-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="ioCancel">${t("Cancel")}</button>
      ${current ? `<button type="button" class="csv-btn ao-unassign" id="ioUnassign">${t("Unassign")}</button>` : ''}
      <button type="button" class="csv-btn csv-btn--choose" id="ioAssign">${t("Assign")}</button>
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
  sheet.querySelector('#ioCancel').addEventListener('click', close);

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

  sheet.querySelector('#ioAssign').addEventListener('click', async () => {
    if (!picked) { toast(t('Select a crew member'), { kind: 'error' }); return; }
    close();
    await setOwner(item, picked);
  });

  const unBtn = sheet.querySelector('#ioUnassign');
  if (unBtn) {
    unBtn.addEventListener('click', async () => { close(); await setOwner(item, null); });
  }
}

async function setOwner(item, name) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    await updateDoc(doc(db, 'inventory', String(item._docId)), {
      assignedTo: name || '',
      assignedBy: name ? userId : '',
      assignedAt: name ? now : 0,
      lastModified: now,
      lastModifiedBy: userId
    });

    await logHistory({
      entityType: 'INVENTORY',
      entityId: item.id,
      itemName: item.name,
      boatId: item.boatId,
      action: 'OWNER_ASSIGNED',
      title: name ? `Owner assigned: ${name}` : 'Owner unassigned',
      detail: name ? `${item.assignedTo || 'None'} → ${name}` : `${item.assignedTo || 'None'} → None`
    });

    toast(name ? t('assignedNamed', {name:name}) : 'Unassigned', { kind: 'success' });
  } catch (err) {
    console.error('[inventory assign] failed', err);
    toast(t('Failed to assign owner'), { kind: 'error' });
  }
}

/* ---------- Set Reorder Level ---------- */
async function showSetReorderLevel(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${t("Reorder Level")}</div>

    <form id="rlForm" class="add-form" novalidate>
      <div class="add-scroll">
        <label class="add-label" for="rl-input">${t("Reorder Level for")} ${escapeHtml(item.name || t('Item'))}</label>
        <input class="add-input" id="rl-input" type="number" inputmode="numeric" min="0" step="1" value="${item.reorderLevel ?? 0}">
      </div>
      <button type="submit" class="add-save" id="rl-save">${t("Save")}</button>
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

  sheet.querySelector('#rlForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const str = sheet.querySelector('#rl-input').value.trim();
    const newLevel = str === '' ? 0 : Math.max(0, parseInt(str, 10) || 0);
    const oldLevel = Number(item.reorderLevel || 0);

    if (newLevel === oldLevel) { close(); return; }

    try {
      const now = Date.now();
      const userId = String(store.userProfile?.userId || 0);

      await updateDoc(doc(db, 'inventory', String(item._docId)), {
        reorderLevel: newLevel,
        lastModified: now,
        lastModifiedBy: userId
      });

      await logHistory({
        entityType: 'INVENTORY',
        entityId: item.id,
        itemName: item.name,
        boatId: item.boatId,
        action: 'REORDER_LEVEL_CHANGED',
        title: 'Reorder level changed',
        detail: `${oldLevel} → ${newLevel}`
      });

      close();
      toast(t('reorderSet', {count:newLevel}), { kind: 'success' });
    } catch (err) {
      console.error('[inventory reorder] failed', err);
      toast(t('Failed to update reorder level'), { kind: 'error' });
    }
  });
}

/* ---------- Duplicate ---------- */
function stripCopySuffix(name) {
  return String(name || '').replace(/(\s*\(Copy\))+\s*$/i, '').trim();
}

async function duplicateInventory(item) {
  try {
    const clientId = Number(store.activeClientId);
    const { collection, query, where, getDocs, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const snap = await getDocs(query(
      collection(db, 'inventory'),
      where('clientId', '==', clientId)
    ));
    let maxId = 0;
    snap.forEach(d => {
      const v = Number(d.data()?.id || 0);
      if (v > maxId) maxId = v;
    });
    const nextId = maxId + 1;
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);
    const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `inv-${now}-${nextId}`);

    await setDoc(doc(db, 'inventory', cloudId), {
      id: nextId,
      clientId,
      boatId: Number(item.boatId),
      name: stripCopySuffix(item.name) + ' (Copy)',
      category: item.category || '',
      location: item.location || '',
      quantity: Number(item.quantity || 0),
      reorderLevel: Number(item.reorderLevel || 0),
      unit: item.unit || 'PCS',
      supplier: item.supplier || '',
      notes: item.notes || '',
      status: item.status || 'IN_STOCK',
      assignedTo: '',
      assignedBy: '',
      assignedAt: 0,
      lastUpdated: item.lastUpdated || '',
      lastModified: now,
      lastModifiedBy: userId,
      syncTime: serverTimestamp(),
      syncedAt: 0
    });

    await logHistory({
      entityType: 'INVENTORY',
      entityId: nextId,
      itemName: stripCopySuffix(item.name) + ' (Copy)',
      boatId: item.boatId,
      action: 'DUPLICATED',
      title: 'Item duplicated',
      detail: `Original: ${item.name}`
    });

    toast(t('Item duplicated'), { kind: 'success' });
  } catch (err) {
    console.error('[inventory duplicate] failed', err);
    toast(t('Failed to duplicate'), { kind: 'error' });
  }
}

/* ---------- Delete ---------- */
async function deleteInventory(item) {
  const ok = await confirmSheet({
    title: t('Delete item?'),
    message: t('removeNamed', {name:item.name}),
    confirmText: t('Delete'),
    cancelText: t('Cancel')
  });
  if (!ok) return;

  try {
    await logHistory({
      entityType: 'INVENTORY',
      entityId: item.id,
      itemName: item.name,
      boatId: item.boatId,
      action: 'DELETED',
      title: 'Item deleted'
    });

    await deleteDoc(doc(db, 'inventory', String(item._docId)));
    toast(t('deletedNamed', {name:item.name}), { kind: 'success' });
  } catch (err) {
    console.error('[inventory delete] failed', err);
    toast(t('Failed to delete'), { kind: 'error' });
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