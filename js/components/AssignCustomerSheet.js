// js/components/AssignCustomerSheet.js
import { esc } from '../utils.js';

export function showAssignCustomerSheet(opts) {
  const { boat, customers, onAssign } = opts;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  if (!customers || !customers.length) {
    sheet.innerHTML = `
      <div class="assign-handle"></div>
      <div class="assign-title">Assign Customer to ${esc(boat.name)}</div>
      <div class="assign-divider"></div>
      <div class="assign-empty">No customers found. Create one first.</div>
      <div class="assign-divider"></div>
      <button class="assign-cancel" id="assignCancel">Cancel</button>
    `;
  } else {
    const currentId = Number(boat.customerId || 0);

    sheet.innerHTML = `
      <div class="assign-handle"></div>
      <div class="assign-title">Assign Customer to ${esc(boat.name)}</div>
      <div class="assign-divider"></div>
      <div class="assign-list" id="assignList">
        ${customers.map(c => `
          <button class="assign-row" data-customer-id="${c.id}">
            <span class="assign-name">${esc(c.name)}</span>
            ${currentId === c.id ? '<span class="assign-current">✓</span>' : ''}
          </button>
        `).join('')}
      </div>
      <div class="assign-divider"></div>
      <button class="assign-cancel" id="assignCancel">Cancel</button>
    `;
  }

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

  const list = sheet.querySelector('#assignList');
  if (list) {
    list.querySelectorAll('.assign-row').forEach(row => {
      row.addEventListener('click', async () => {
        const customerId = Number(row.dataset.customerId);
        close();
        try { await onAssign(customerId); }
        catch (err) { console.error('[assign] failed', err); }
      });
    });
  }

  sheet.querySelector('#assignCancel').addEventListener('click', close);
}