// js/screens/ReceiveStockSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showReceiveStockSheet(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Receive Stock</div>

    <form id="rsForm" class="add-form" novalidate>
      <div class="add-scroll">
        <label class="add-label">Item</label>
        <div class="add-input" style="padding-top:14px; padding-bottom:14px; color:var(--color-text-secondary);">
          ${escapeHtml(item.name || 'Item')} — current Qty: ${item.quantity}${item.unit ? ' ' + escapeHtml(item.unit) : ''}
        </div>

        <label class="add-label" for="rs-qty">Quantity Received</label>
        <input class="add-input" id="rs-qty" type="number" inputmode="numeric" min="1" step="1" placeholder="0">

        <label class="add-label" for="rs-reason">Reason (optional)</label>
        <input class="add-input" id="rs-reason" type="text" placeholder="e.g. Supplier delivery">

        <label class="add-label" for="rs-ref">Reference (optional)</label>
        <input class="add-input" id="rs-ref" type="text" placeholder="e.g. PO-1024">
      </div>
      <button type="submit" class="add-save" id="rs-save">Receive Stock</button>
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

  sheet.querySelector('#rsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const qtyStr = sheet.querySelector('#rs-qty').value.trim();
    const reason = sheet.querySelector('#rs-reason').value.trim();
    const reference = sheet.querySelector('#rs-ref').value.trim();

    if (!qtyStr) { toast('Enter a quantity', { kind: 'error' }); return; }
    const add = parseInt(qtyStr, 10);
    if (!Number.isFinite(add) || add <= 0) { toast('Quantity must be greater than zero', { kind: 'error' }); return; }

    const btn = sheet.querySelector('#rs-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    try {
      const now = Date.now();
      const userId = String(store.userProfile?.userId || 0);
      const oldQty = Number(item.quantity || 0);
      const newQty = oldQty + add;
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
        action: 'STOCK_RECEIVED',
        title: 'Stock received',
        detail: `Received: +${add}\nStock: ${oldQty} → ${newQty}`,
        reason,
        reference
      });

      close();
      toast(`Received ${add} item${add === 1 ? '' : 's'}`, { kind: 'success' });
    } catch (err) {
      console.error('[inventory receive] failed', err);
      btn.disabled = false;
      btn.textContent = 'Receive Stock';
      toast('Failed to receive stock', { kind: 'error' });
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