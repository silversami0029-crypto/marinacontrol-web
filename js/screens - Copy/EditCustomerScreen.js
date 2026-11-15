import { t as tr } from '../i18n.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { db } from '../firebase.js';
import { doc, getDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let activeEditorDispose = null;
export function unmountEditCustomerScreen() {
  activeEditorDispose?.();
  activeEditorDispose = null;
}
export function mountEditCustomerScreen() {
  unmountEditCustomerScreen();
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const docId = params.get('docId');
  if (!docId) {
    toast(tr('Customer not found'), { kind: 'error' });
    location.hash = '#/customer-directory';
    return;
  }
  activeEditorDispose = showEditCustomerScreen({ _docId: docId }, {
    onClose: () => { location.hash = '#/customer-directory'; }
  });
}

// Matches EditCustomerFragment.java and fragment_edit_customer.xml.
export function showEditCustomerScreen(customer, { onClose } = {}) {
  const clientId = Number(store.activeClientId);
  if (!clientId || !customer?._docId) {
    toast(tr('Customer document ID is missing'), { kind: 'error' });
    return;
  }
  const screen = document.getElementById('screen');
  if (!screen) return;
  let closed = false;
  let saving = false;
  const customerRef = doc(db, 'customers', customer._docId);
  screen.innerHTML = `
    <style>
      #editCustomerScreen.ec-screen{box-sizing:border-box;width:100%;max-width:none;min-width:0;align-self:stretch;margin:0;padding:16px 24px;color:#F5F7F9}
      #editCustomerScreen .ec-header{box-sizing:border-box;display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;padding:12px 16px;background:#1C222A;border:1px solid #303943;border-radius:16px}
      .ec-title{margin:0;padding:8px 16px;border-radius:16px;background:#1C222A;font-size:15px;font-weight:600}
      .ec-close{display:grid;place-items:center;min-width:44px;min-height:44px;border:0;border-radius:8px;background:transparent;color:#AEB6C1;font-size:26px;cursor:pointer}
      #editCustomerScreen .ec-form{box-sizing:border-box;display:grid;width:100%;max-width:none;min-width:0;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 24px}#editCustomerScreen .ec-field{display:grid;width:100%;min-width:0;gap:8px;color:#AEB6C1;font-size:14px}#editCustomerScreen .ec-wide{grid-column:1 / -1}
      #editCustomerScreen .ec-field input,#editCustomerScreen .ec-field textarea{box-sizing:border-box;width:100%;max-width:none;min-width:0;padding:13px 12px;border:1px solid #737D89;border-radius:10px;background:#1C222A;color:#F5F7F9;font:inherit}
      .ec-field textarea{min-height:110px;resize:vertical}.ec-field input:focus,.ec-field textarea:focus{outline:2px solid #0A8EF7;outline-offset:1px}
      .ec-field input[aria-invalid=true]{border-color:#ef4444}.ec-error{color:#fca5a5;font-size:13px;min-height:0}
      .ec-preferred{display:flex;gap:10px;align-items:center;min-height:44px;font-size:14px;color:#F5F7F9}
      .ec-preferred input{width:18px;height:18px;accent-color:#0A8EF7}
      #editCustomerScreen .ec-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:4px}#editCustomerScreen .ec-actions button{flex:0 1 180px;width:180px;min-height:48px;padding:10px;border:1px solid #0A8EF7;border-radius:12px;font:inherit;cursor:pointer}
      .ec-cancel{background:transparent;color:#0A8EF7}.ec-save{background:#0A8EF7;color:#151A20;font-weight:600}
      .ec-screen button:disabled{opacity:0.55;cursor:wait}.ec-status{margin:0;color:#AEB6C1;font-size:13px}
      #editCustomerScreen .ec-form[hidden]{display:none}
      @media(max-width:640px){#editCustomerScreen.ec-screen{padding:12px}#editCustomerScreen .ec-form{grid-template-columns:minmax(0,1fr);gap:16px}#editCustomerScreen .ec-actions button{flex:1;width:auto}}
    </style>
    <section class="ec-screen" id="editCustomerScreen" aria-labelledby="editCustomerTitle">
      <header class="ec-header"><h2 class="ec-title" id="editCustomerTitle">${escapeHtml(tr('Edit customer'))}</h2>
        <button type="button" class="ec-close" aria-label="${escapeHtml(tr('Close'))}">×</button></header>
      <p class="ec-status" role="status">${escapeHtml(tr('Loading...'))}</p>
      <form class="ec-form" novalidate hidden>
        <label class="ec-field ec-wide"><span>${escapeHtml(tr('Customer Name *'))}</span>
          <input name="name" type="text" autocomplete="name" required aria-describedby="ecNameError">
          <span class="ec-error" id="ecNameError"></span></label>
        <label class="ec-field"><span>${escapeHtml(tr('Email'))}</span><input name="email" type="email" autocomplete="email"></label>
        <label class="ec-field"><span>${escapeHtml(tr('Phone'))}</span><input name="phone" type="tel" autocomplete="tel"></label>
        <label class="ec-field ec-wide"><span>${escapeHtml(tr('Notes'))}</span><textarea name="notes" rows="4"></textarea></label>
        <label class="ec-preferred ec-wide"><input name="isPreferred" type="checkbox"><span>⭐ ${escapeHtml(tr('Preferred Customer'))}</span></label>
        <p class="ec-error ec-wide" id="ecSaveError" role="alert"></p>
        <div class="ec-actions ec-wide"><button type="button" class="ec-cancel">${escapeHtml(tr('Cancel'))}</button>
          <button type="submit" class="ec-save">${escapeHtml(tr('Update'))}</button></div>
      </form>
    </section>`;
  const root = screen.querySelector('#editCustomerScreen');
  const form = root.querySelector('form');
  const status = root.querySelector('.ec-status');
  const closeButton = root.querySelector('.ec-close');
  const cancelButton = root.querySelector('.ec-cancel');
  const saveButton = root.querySelector('.ec-save');
  const fields = form.elements;
  const isCurrent = () => !closed && root.isConnected && Number(store.activeClientId) === clientId;
  const dispose = () => { closed = true; window.removeEventListener('hashchange', dispose); };
  const close = () => {
    if (saving || !isCurrent()) return;
    dispose();
    if (typeof onClose === 'function') onClose();
  };
  window.addEventListener('hashchange', dispose);
  closeButton.addEventListener('click', close);
  cancelButton.addEventListener('click', close);
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  fields.namedItem('name').addEventListener('input', () => {
    root.querySelector('#ecNameError').textContent = '';
    fields.namedItem('name').removeAttribute('aria-invalid');
  });

  getDoc(customerRef).then(snapshot => {
    if (!isCurrent()) return;
    const data = snapshot.exists() ? snapshot.data() : null;
    if (!isEditableCustomer(data, clientId)) throw new Error(tr('Customer not found'));
    for (const key of ['name', 'email', 'phone', 'notes']) fields.namedItem(key).value = data[key] || '';
    fields.namedItem('isPreferred').checked = !!data.isPreferred;
    status.hidden = true;
    form.hidden = false;
    fields.namedItem('name').focus();
  }).catch(error => {
    if (!isCurrent()) return;
    console.error('[edit customer] load failed', error);
    status.textContent = tr('Could not load customer. Close and try again.');
    toast(tr('Could not load customer'), { kind: 'error' });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || form.hidden || !isCurrent()) return;
    const changes = customerChanges({
      name: fields.namedItem('name').value,
      email: fields.namedItem('email').value,
      phone: fields.namedItem('phone').value,
      notes: fields.namedItem('notes').value,
      isPreferred: fields.namedItem('isPreferred').checked
    });
    if (!changes.name) {
      root.querySelector('#ecNameError').textContent = tr('Name is required');
      fields.namedItem('name').setAttribute('aria-invalid', 'true');
      fields.namedItem('name').focus();
      return;
    }
    saving = true;
    root.querySelector('#ecSaveError').textContent = '';
    closeButton.disabled = cancelButton.disabled = saveButton.disabled = true;
    for (const field of form.querySelectorAll('input, textarea')) field.disabled = true;
    saveButton.textContent = tr('Saving...');
    try {
      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(customerRef);
        if (Number(store.activeClientId) !== clientId || !snapshot.exists()
            || !isEditableCustomer(snapshot.data(), clientId)) throw new Error(tr('Customer not found'));
        transaction.update(customerRef, {
          ...changes,
          lastModified: Date.now(),
          lastModifiedBy: String(store.userProfile?.userId || 0),
          syncedAt: 0
        });
      });
      if (isCurrent()) {
        saving = false;
        toast(tr('Customer updated'), { kind: 'success' });
        close();
      }
    } catch (error) {
      console.error('[edit customer] save failed', error);
      if (isCurrent()) root.querySelector('#ecSaveError').textContent = tr('Could not update customer. Please try again.');
    } finally {
      saving = false;
      if (isCurrent()) {
        closeButton.disabled = cancelButton.disabled = saveButton.disabled = false;
        for (const field of form.querySelectorAll('input, textarea')) field.disabled = false;
        saveButton.textContent = tr('Update');
      }
    }
  });
  return dispose;
}

export function customerChanges(values) {
  return {
    name: String(values.name || '').trim(), email: String(values.email || '').trim(),
    phone: String(values.phone || '').trim(), notes: String(values.notes || '').trim(),
    isPreferred: !!values.isPreferred
  };
}
export function isEditableCustomer(data, clientId) {
  return !!data && Number(data.clientId) === Number(clientId) && !data.removedAt && Number(data.isActive) !== 0;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}
