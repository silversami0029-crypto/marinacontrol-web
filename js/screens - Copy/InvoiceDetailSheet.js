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
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(inv.invoiceNumber || 'Invoice')}</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">Customer:</span> <span class="md-value">${escapeHtml(inv.clientName || '—')}</span></div>
      <div class="md-line"><span class="md-label">Boat:</span> <span class="md-value">${escapeHtml(inv.boatName || '—')}</span></div>
      ${inv.description ? `<div class="md-line"><span class="md-label">Description:</span> <span class="md-value">${escapeHtml(inv.description)}</span></div>` : ''}
      <div class="md-line"><span class="md-label">Category:</span> <span class="md-value">${escapeHtml(CATEGORY_LABELS[inv.category] || inv.category)}</span></div>
      <div class="md-line"><span class="md-label">Amount:</span> <span class="md-value" style="font-weight:700;">£${Number(inv.amount || 0).toFixed(2)}</span></div>
      <div class="md-line"><span class="md-label">Issue Date:</span> <span class="md-value">${escapeHtml(formatDate(inv.issueDate))}</span></div>
      <div class="md-line"><span class="md-label">Due Date:</span> <span class="md-value">${escapeHtml(formatDate(inv.dueDate))}</span></div>
      <div class="md-line"><span class="md-label">Status:</span> <span class="md-value" style="color:${statusColor};font-weight:700;">${escapeHtml(inv.status)}</span></div>
    </div>

    ${!isPaid ? `<button type="button" class="add-save" id="ivMarkPaid" style="margin-top:16px;">Mark as Paid</button>` : ''}
    <button type="button" class="md-close-btn" id="ivDetailClose" style="margin-top:8px;">Close</button>
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

  const markBtn = sheet.querySelector('#ivMarkPaid');
  if (markBtn) {
    markBtn.addEventListener('click', async () => {
      markBtn.disabled = true;
      markBtn.textContent = 'Saving…';
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
        toast('Invoice marked as paid', { kind: 'success' });
      } catch (err) {
        console.error('[invoice mark paid] failed', err);
        markBtn.disabled = false;
        markBtn.textContent = 'Mark as Paid';
        toast('Failed to update invoice', { kind: 'error' });
      }
    });
  }
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}