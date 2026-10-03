import { showInvoicePaymentFoundation } from './InvoicePaymentFoundationSheet.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/InvoiceDetailSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const STATUS_COLORS = {
  PAID: '#4CAF50',
  PENDING: '#FF9800',
  OVERDUE: '#F44336'
};

const CATEGORY_LABELS = {
  BERTH: 'Berth',
  MAINTENANCE: 'Maintenance',
  EQUIPMENT: 'Equipment',
  CREW: 'Crew',
  UTILITIES: 'Utilities',
  GENERAL: 'General'
};

export function showInvoiceDetail(inv) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const statusColor = STATUS_COLORS[inv.status] || '#737D89';
  const isPaid = inv.status === 'PAID';

  sheet.innerHTML = `
<div style="position:relative;display:flex;align-items:center;min-height:48px;">
  <div class="sheet-title"
       style="flex:1;margin:0;padding:12px 48px;text-align:center;">
    ${tr("Confirm Payment")}
  </div>
  <button type="button" id="ivPayClose" aria-label="${tr("Close")}"
          style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;background:transparent;color:#F5F7F9;cursor:pointer;">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round"
         aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  </button>
</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">${tr("Customer:")}</span> <span class="md-value">${escapeHtml(inv.clientName || '—')}</span></div>
      <div class="md-line"><span class="md-label">${tr("Boat:")}</span> <span class="md-value">${escapeHtml(inv.boatName || '—')}</span></div>
      ${inv.description ? `<div class="md-line"><span class="md-label">${tr("Description:")}</span> <span class="md-value">${escapeHtml(inv.description)}</span></div>` : ''}
      <div class="md-line"><span class="md-label">${tr("Category:")}</span> <span class="md-value">${escapeHtml(tr(CATEGORY_LABELS[inv.category] || inv.category))}</span></div>
      <div class="md-line"><span class="md-label">${tr("Amount:")}</span> <span class="md-value" style="font-weight:700;">£${Number(inv.amount || 0).toFixed(2)}</span></div>
      <div class="md-line"><span class="md-label">${tr("Issue Date:")}</span> <span class="md-value">${escapeHtml(formatDate(inv.issueDate))}</span></div>
      <div class="md-line"><span class="md-label">${tr("Due Date:")}</span> <span class="md-value">${escapeHtml(formatDate(inv.dueDate))}</span></div>
      <div class="md-line"><span class="md-label">${tr("Status:")}</span> <span class="md-value" style="color:${statusColor};font-weight:700;">${escapeHtml(tr(inv.status))}</span></div>
    </div>

    ${!isPaid ? `<button type="button" class="add-save" id="ivMarkPaid" style="margin-top:16px;">${tr("Mark as Paid")}</button>` : ''}
    <button type="button" class="md-close-btn" id="ivPaymentSetup" style="margin-top:12px;width:100%;min-height:48px;height:auto;padding:12px 16px;box-sizing:border-box;white-space:normal;line-height:1.3;">${uiLocale().startsWith('ar') ? 'إعداد الدفع الإلكتروني' : 'Online Payment Setup'}</button>
    <button type="button" class="md-close-btn" id="ivDetailClose" style="margin-top:8px;">${tr("Close")}</button>
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
  sheet.querySelector('#ivDetailClose').addEventListener('click', close);
sheet.querySelector('#ivPayClose').addEventListener('click', close);

  sheet.querySelector('#ivPaymentSetup').addEventListener('click', () => {
    close();
    showInvoicePaymentFoundation(inv);
  });

  const markBtn = sheet.querySelector('#ivMarkPaid');
  if (markBtn) {
    markBtn.addEventListener('click', async () => {
      markBtn.disabled = true;
      markBtn.textContent = tr('Saving…');
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
        console.error('[invoice mark paid] failed', err);
        markBtn.disabled = false;
        markBtn.textContent = tr('Mark as Paid');
        toast(tr('Failed to update invoice'), { kind: 'error' });
      }
    });
  }
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  return d.toLocaleDateString(uiLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}