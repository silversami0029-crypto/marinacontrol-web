// js/screens/AddInvoiceSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { logHistory } from '../util/history.js';
import {
  collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const CATEGORIES = ['GENERAL', 'BERTH', 'MAINTENANCE', 'EQUIPMENT', 'CREW', 'UTILITIES'];
const STATUSES = ['PENDING', 'PAID', 'OVERDUE'];

export async function showAddInvoiceSheet(opts = {}) {
  const { item, customerId } = opts;
  const isEdit = !!item;
  const clientId = Number(store.activeClientId);

  let customers = [];
  let boats = [];

  try {
    const custSnap = await getDocs(query(
      collection(db, 'customers'),
      where('clientId', '==', clientId)
    ));

    customers = custSnap.docs
      .map(d => ({
        id: Number(d.data().id || 0),
        name: d.data().name || ''
      }))
      .filter(c => c.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn('[invoice] customers load failed', e);
  }

  try {
    const boatSnap = await getDocs(query(
      collection(db, 'boats'),
      where('clientId', '==', clientId)
    ));

    boats = boatSnap.docs
      .map(d => {
        const data = d.data();

        return {
          id: Number(data.id || 0),
          name: data.name || '',
          customerId: Number(data.customerId || 0),
          isActive: data.isActive === true || Number(data.isActive) === 1
        };
      })
      .filter(b => b.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.warn('[invoice] boats load failed', e);
  }

  const requestedBoatId = Number(opts.boatId || store.activeBoatId || 0);
  const activeBoat =
    boats.find(b => b.id === requestedBoatId) ||
    boats.find(b => b.isActive);

  const activeBoatId = Number(activeBoat?.id || 0);
  const defaultCustomerId = Number(
    customerId || activeBoat?.customerId || 0
  );

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const defaultDue = new Date(
    today.getTime() + 30 * 24 * 60 * 60 * 1000
  ).toISOString().slice(0, 10);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>

    <div class="sheet-title" style="text-align:center;">
      ${isEdit ? 'Edit Invoice' : 'Add Invoice'}
    </div>

    <form id="ivForm" class="add-form" novalidate autocomplete="off">
      <div class="add-scroll">

        <label class="add-label" for="iv-customer">Customer</label>
        <select class="add-input add-select" id="iv-customer">
          <option value="">Select customer…</option>
          ${customers.map(c => `
            <option value="${c.id}">
              ${escapeHtml(c.name)}
            </option>
          `).join('')}
        </select>

        <label class="add-label" for="iv-boat">Boat</label>
        <select class="add-input add-select" id="iv-boat">
          <option value="">Select boat…</option>
          ${boats.map(b => `
            <option value="${b.id}" data-customer="${b.customerId}">
              ${escapeHtml(b.name)}
            </option>
          `).join('')}
        </select>

        <label class="add-label" for="iv-number">Invoice Number</label>
        <input
          class="add-input"
          id="iv-number"
          type="text"
          placeholder="INV-..."
        >

        <label class="add-label" for="iv-desc">Description</label>
        <input
          class="add-input"
          id="iv-desc"
          type="text"
          placeholder="e.g. Mooring – January 2026"
        >

        <label class="add-label" for="iv-category">Category</label>
        <select class="add-input add-select" id="iv-category">
          ${CATEGORIES.map(c => `
            <option value="${c}">
              ${c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          `).join('')}
        </select>

        <label class="add-label" for="iv-amount">Amount (£)</label>
        <input
          class="add-input"
          id="iv-amount"
          type="number"
          inputmode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
        >

        <label class="add-label" for="iv-issue">Issue Date</label>
        <input class="add-input" id="iv-issue" type="date">

        <label class="add-label" for="iv-due">Due Date</label>
        <input class="add-input" id="iv-due" type="date">

        <label class="add-label" for="iv-status">Status</label>
        <select class="add-input add-select" id="iv-status">
          ${STATUSES.map(s => `
            <option value="${s}">${s}</option>
          `).join('')}
        </select>

      </div>

      <button type="submit" class="add-save" id="iv-save">
        ${isEdit ? 'Update Invoice' : '+ Add Invoice'}
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

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);

  const customerSelect = sheet.querySelector('#iv-customer');
  const boatSelect = sheet.querySelector('#iv-boat');

  if (isEdit) {
    customerSelect.value = String(item.customerId || '');
    boatSelect.value = String(item.boatId || '');
    sheet.querySelector('#iv-number').value =
      item.invoiceNumber || '';
    sheet.querySelector('#iv-desc').value =
      item.description || '';
    sheet.querySelector('#iv-category').value =
      item.category || 'GENERAL';
    sheet.querySelector('#iv-amount').value =
      String(item.amount ?? '');
    sheet.querySelector('#iv-issue').value =
      toDateInput(item.issueDate);
    sheet.querySelector('#iv-due').value =
      toDateInput(item.dueDate);
    sheet.querySelector('#iv-status').value =
      item.status || 'PENDING';
  } else {
    customerSelect.value = String(defaultCustomerId || '');
    boatSelect.value = String(activeBoatId || '');
    sheet.querySelector('#iv-number').value =
      'INV-' + Date.now();
    sheet.querySelector('#iv-issue').value = todayStr;
    sheet.querySelector('#iv-due').value = defaultDue;
    sheet.querySelector('#iv-status').value = 'PENDING';
  }

  boatSelect.addEventListener('change', () => {
    const selectedOption = boatSelect.selectedOptions[0];
    const selectedCustomerId = Number(
      selectedOption?.dataset.customer || 0
    );

    if (selectedCustomerId) {
      customerSelect.value = String(selectedCustomerId);
    }
  });

  const form = sheet.querySelector('#ivForm');
  const save = sheet.querySelector('#iv-save');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const selectedCustomerId = Number(customerSelect.value);
    const boatId = Number(boatSelect.value);
    const invoiceNumber =
      sheet.querySelector('#iv-number').value.trim();
    const description =
      sheet.querySelector('#iv-desc').value.trim();
    const category =
      sheet.querySelector('#iv-category').value;
    const amountStr =
      sheet.querySelector('#iv-amount').value.trim();
    const issueStr =
      sheet.querySelector('#iv-issue').value;
    const dueStr =
      sheet.querySelector('#iv-due').value;
    const status =
      sheet.querySelector('#iv-status').value;

    if (!selectedCustomerId) {
      toast('Select a customer', { kind: 'error' });
      return;
    }

    if (!boatId) {
      toast('Select a boat', { kind: 'error' });
      return;
    }

    if (!amountStr) {
      toast('Enter an amount', { kind: 'error' });
      return;
    }

    const amount = Math.max(0, parseFloat(amountStr) || 0);
    const issueDate =
      new Date(issueStr + 'T00:00:00').getTime();
    const dueDate =
      new Date(dueStr + 'T00:00:00').getTime();

    const customerName =
      customerSelect.selectedOptions[0]?.textContent.trim() || '';
    const boatName =
      boatSelect.selectedOptions[0]?.textContent.trim() || '';

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      if (isEdit) {
        await updateDoc(
          doc(db, 'invoices', String(item._docId)),
          {
            customerId: selectedCustomerId,
            clientName: customerName,
            boatId,
            boatName,
            invoiceNumber,
            description,
            category,
            amount,
            issueDate,
            dueDate,
            status,
            lastModified: Date.now()
          }
        );

        await logHistory({
          entityType: 'INVOICE',
          entityId: item.id,
          itemName: invoiceNumber,
          boatId,
          action: 'UPDATED',
          title: 'Invoice edited'
        });
      } else {
        const now = Date.now();

        const snap = await getDocs(query(
          collection(db, 'invoices'),
          where('clientId', '==', clientId)
        ));

        let maxId = 0;

        snap.forEach(invoiceDocument => {
          const value = Number(invoiceDocument.data()?.id || 0);

          if (
            Number.isInteger(value) &&
            value > maxId &&
            value < 2147483647
          ) {
            maxId = value;
          }
        });

        const nextId = maxId + 1;
        const cloudId = crypto.randomUUID
          ? crypto.randomUUID()
          : `inv-${clientId}-${nextId}`;

        await setDoc(
          doc(db, 'invoices', cloudId),
          {
            id: nextId,
            clientId,
            customerId: selectedCustomerId,
            clientName: customerName,
            boatId,
            boatName,
            invoiceNumber,
            description,
            category,
            amount,
            issueDate,
            dueDate,
            status,
            createdAt: now,
            syncTime: serverTimestamp(),
            syncedAt: 0
          }
        );

        await logHistory({
          entityType: 'INVOICE',
          entityId: nextId,
          itemName: invoiceNumber,
          boatId,
          action: 'CREATED',
          title: 'Invoice created',
          detail: `£${amount.toFixed(2)} · ${status}`
        });
      }

      close();

      toast(
        isEdit ? 'Invoice updated' : 'Invoice added',
        { kind: 'success' }
      );
    } catch (err) {
      console.error('[invoice save] failed', err);

      save.disabled = false;
      save.textContent =
        isEdit ? 'Update Invoice' : '+ Add Invoice';

      let errEl = sheet.querySelector('.add-error');

      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }

      errEl.textContent =
        err.message || 'Failed to save.';
    }
  });
}

function toDateInput(ts) {
  if (!ts) return '';

  const date = new Date(Number(ts));
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}