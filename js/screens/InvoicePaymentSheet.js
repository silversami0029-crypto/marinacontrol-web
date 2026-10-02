import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/InvoicePaymentSheet.js
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showInvoicePaymentSheet(inv) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${tr("Confirm Payment")}</div>

    <div class="md-body" style="margin-top:8px;">
      <div class="md-line"><span class="md-label">${tr("Invoice:")}</span> <span class="md-value">${escapeHtml(inv.invoiceNumber || '')}</span></div>
      <div class="md-line"><span class="md-label">${tr("Boat:")}</span> <span class="md-value">${escapeHtml(inv.boatName || '—')}</span></div>
      ${inv.description ? `<div class="md-line"><span class="md-label">${tr("Description:")}</span> <span class="md-value">${escapeHtml(inv.description)}</span></div>` : ''}
      <div class="md-line"><span class="md-label">${tr("Amount:")}</span> <span class="md-value" style="font-weight:700;">£${Number(inv.amount || 0).toFixed(2)}</span></div>
    </div>

    <div class="ao-actions" style="margin-top:20px;">
      <button type="button" class="csv-btn csv-btn--cancel" id="ivPayCancel">${tr("Cancel")}</button>
      <button type="button" class="csv-btn csv-btn--choose" id="ivPayConfirm">${tr("Mark as Paid")}</button>
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
  sheet.querySelector('#ivPayCancel').addEventListener('click', close);

  sheet.querySelector('#ivPayConfirm').addEventListener('click', async () => {
    const btn = sheet.querySelector('#ivPayConfirm');
    btn.disabled = true;
    btn.textContent = tr('Saving…');

    try {
      await updateDoc(doc(db, 'invoices', String(inv._docId)), {
        status: 'PAID',
        lastModified: Date.now()
      });
      await logHistory({
        entityType: 'INVOICE',
        entityId: inv.id,
        itemName: inv.invoiceNumber,
        boatId: inv.boatId,
        action: 'PAID',
        title: 'Invoice marked as paid',
        detail: `£${Number(inv.amount || 0).toFixed(2)}`
      });
      close();
      toast(tr('Invoice marked as paid'), { kind: 'success' });
    } catch (err) {
      console.error('[invoice payment] failed', err);
      btn.disabled = false;
      btn.textContent = tr('Mark as Paid');
      toast(tr('Failed to update invoice'), { kind: 'error' });
    }
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}