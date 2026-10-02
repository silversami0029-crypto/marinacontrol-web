// js/components/UtilitiesSheet.js
// Utilities sheet — Add Reading dialog

import { esc } from '../utils.js';

const UTILITY_TYPES = ['ELECTRICITY', 'WATER'];
const UNITS = { ELECTRICITY: 'kWh', WATER: 'L' };
const MODES = ['CUMULATIVE', 'INTERVAL', 'INSTANTANEOUS'];

/* ============================================================
   ADD READING DIALOG
   ============================================================ */
export function showAddReadingDialog(berth, onAddReading) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Add ${esc(berth.berthNumber)} Reading</div>

    <form id="utilForm" class="add-form" novalidate>
      <div class="add-scroll">

        <div class="add-section-title">Utility Type</div>
        <select class="add-input add-select" id="utilType">
          ${UTILITY_TYPES.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>

        <div class="add-section-title">Reading Mode</div>
        <select class="add-input add-select" id="utilMode">
          ${MODES.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>

        <input class="add-input" id="utilValue"
               type="number" step="0.01" placeholder="Meter reading">

        <input class="add-input" id="utilNotes"
               type="text" placeholder="Notes (optional)">

        <div class="add-section-title">Unit</div>
        <input class="add-input" id="utilUnit" type="text" value="kWh" readonly>
      </div>

      <div class="util-dialog-actions">
        <button type="button" class="util-cancel-btn" id="utilCancel">CANCEL</button>
        <button type="submit" class="util-save-btn" id="utilSave">SAVE</button>
      </div>
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

  const typeEl = sheet.querySelector('#utilType');
  const unitEl = sheet.querySelector('#utilUnit');
  const syncUnit = () => { unitEl.value = UNITS[typeEl.value] || ''; };
  typeEl.addEventListener('change', syncUnit);
  syncUnit();

  const form = sheet.querySelector('#utilForm');
  const save = sheet.querySelector('#utilSave');
  const valueInput = sheet.querySelector('#utilValue');
  const notesInput = sheet.querySelector('#utilNotes');

  sheet.querySelector('#utilCancel').addEventListener('click', close);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const value = parseFloat(valueInput.value);
    if (isNaN(value)) { valueInput.focus(); return; }

    save.disabled = true;
    save.textContent = 'SAVING…';

    try {
      const type = typeEl.value;
      await onAddReading({
        berthId:     berth.id,
        utilityType: type,
        value:       value,
        unit:        UNITS[type],
        readingMode: sheet.querySelector('#utilMode').value,
        readingType: type === 'ELECTRICITY' ? 'ENERGY' : 'WATER_VOLUME',
        notes:       notesInput.value.trim()
      });

      // Keep dialog open, clear value, focus back
      valueInput.value = '';
      notesInput.value = '';
      save.disabled = false;
      save.textContent = 'SAVE';
      valueInput.focus();

    } catch (err) {
      console.error('[utility] save failed', err);
      save.disabled = false;
      save.textContent = 'SAVE';
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        form.insertBefore(errEl, save);
      }
      errEl.textContent = err.message || 'Failed to save reading.';
    }
  });
}