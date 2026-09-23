// js/components/AssignBoatSheet.js
// Assign boat to berth — mirrors AlertDialog in showAssignDialogLocked()

import { esc } from '../utils.js';

/**
 * @param {Object} opts
 * @param {import('../models/Berth.js').Berth} opts.berth
 * @param {Array<import('../models/Boat.js').Boat>} opts.boats  unassigned boats
 * @param {Function} opts.onAssign  (boat) => Promise
 */
export function showAssignBoatSheet(opts) {
  const { berth, boats, onAssign } = opts;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  if (!boats || !boats.length) {
    sheet.innerHTML = `
      <div class="assign-handle"></div>
      <div class="assign-title">Assign Boat to ${esc(berth.berthNumber)}</div>
      <div class="assign-divider"></div>
      <div class="assign-empty">
        No unassigned boats available.<br>
        Release a boat from another berth first.
      </div>
      <div class="assign-divider"></div>
      <button class="assign-cancel" id="assignBoatCancel">Cancel</button>
    `;
  } else {
    sheet.innerHTML = `
      <div class="assign-handle"></div>
      <div class="assign-title">Assign Boat to ${esc(berth.berthNumber)}</div>
      <div class="assign-divider"></div>
      <div class="assign-list" id="assignBoatList">
        ${boats.map(b => `
          <button class="assign-row" data-boat-id="${b.id}">
            <span class="assign-name">${esc(b.name)}</span>
          </button>
        `).join('')}
      </div>
      <div class="assign-divider"></div>
      <button class="assign-cancel" id="assignBoatCancel">Cancel</button>
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

  const list = sheet.querySelector('#assignBoatList');
  if (list) {
    list.querySelectorAll('.assign-row').forEach(row => {
      row.addEventListener('click', async () => {
        const boatId = Number(row.dataset.boatId);
        const boat = boats.find(b => b.id === boatId);
        close();
        try {
          await onAssign(boat);
        } catch (err) {
          console.error('[assign boat] failed', err);
        }
      });
    });
  }

  sheet.querySelector('#assignBoatCancel').addEventListener('click', close);
}