import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/AdjustQuantitySheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showAdjustQuantitySheet(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${tr("Adjust Quantity")}</div>

    <form id="aqForm" class="add-form" novalidate>
      <div class="add-scroll">
        <label class="add-label">${tr("Item")}</label>
        <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
          ${escapeHtml(item.name || 'Item')} — current Qty: ${item.quantity}${item.unit ? ' ' + escapeHtml(item.unit) : ''}
        </div>

        <label class="add-label" for="aq-input">${tr("New Quantity")}</label>
        <input class="add-input" id="aq-input" type="number" inputmode="numeric" min="0" step="1" value="${item.quantity ?? 0}">
      </div>
      <button type="submit" class="add-save" id="aq-save">${tr("Update Quantity")}</button>
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

  sheet.querySelector('#aqForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const str = sheet.querySelector('#aq-input').value.trim();
    const newQty = str === '' ? 0 : Math.max(0, parseInt(str, 10) || 0);
    const oldQty = Number(item.quantity || 0);

    if (newQty === oldQty) { close(); return; }

    const btn = sheet.querySelector('#aq-save');
    btn.disabled = true;
    btn.textContent = tr('Saving…');

    try {
      const now = Date.now();
      const userId = String(store.userProfile?.userId || 0);
      const status = computeStatus(newQty);

      await updateDoc(doc(db, 'inventory', String(item._docId)), {
        quantity: newQty,
        status,
        lastModified: now,
        lastModifiedBy: userId
      });

      await logHistory({
        entityType: 'INVENTORY',
        entityId: item.id,
        itemName: item.name,
        boatId: item.boatId,
        action: 'QUANTITY_ADJUSTED',
        title: 'Quantity adjusted',
        detail: `Stock: ${oldQty} → ${newQty}`
      });

      close();
      toast(tr(`Quantity updated to ${newQty}`), { kind: 'success' });
    } catch (err) {
      console.error('[inventory adjust] failed', err);
      btn.disabled = false;
      btn.textContent = tr('Update Quantity');
      toast(tr('Failed to update quantity'), { kind: 'error' });
    }
  });
}

function computeStatus(quantity) {
  const q = Number(quantity || 0);
  if (q <= 0) return 'OUT_OF_STOCK';
  if (q <= 1) return 'CRITICAL';
  if (q <= 3) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}