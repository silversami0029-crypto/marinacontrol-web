import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/components/UtilitiesSheet.js
// Utilities sheet — Add Reading dialog

import { esc } from '../utils.js';

const UTILITY_TYPES = ['ELECTRICITY', 'WATER'];
const UNITS = { ELECTRICITY: 'kWh', WATER: 'L' };
const message = (en, ar) => uiLocale().startsWith('ar') ? ar : en;
const MODES = ['CUMULATIVE', 'INTERVAL', 'INSTANTANEOUS'];

/* ============================================================
   ADD READING DIALOG
   ============================================================ */
export function showAddReadingDialog(berth, onAddReading, options = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${esc(options.title || tr("Add Berth Reading", {berth:berth.berthNumber}))}</div>

    <form id="utilForm" class="add-form" novalidate>
      <div class="add-scroll">

        <div class="add-section-title">${tr("Utility Type")}</div>
        <select class="add-input add-select" id="utilType">
          ${UTILITY_TYPES.map(t => `<option value="${t}">${esc(tr(t))}</option>`).join('')}
        </select>

        <div class="add-section-title">${tr("Reading Mode")}</div>
        <select class="add-input add-select" id="utilMode">
          ${MODES.map(m => `<option value="${m}">${esc(tr(m))}</option>`).join('')}
        </select>

        <input class="add-input" id="utilValue"
               type="number" min="0" step="any" placeholder="${tr("Meter reading")}">

        <input class="add-input" id="utilNotes"
               type="text" placeholder="${tr("Notes (optional)")}">

        <div class="add-section-title">${tr("Unit")}</div>
        <input class="add-input" id="utilUnit" type="text" value="kWh" readonly>
      </div>

      <div class="util-dialog-actions">
        <button type="button" class="util-cancel-btn" id="utilCancel">${tr("CANCEL")}</button>
        <button type="submit" class="util-save-btn" id="utilSave">${esc(options.saveLabel || tr("SAVE"))}</button>
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
  const modeEl = sheet.querySelector('#utilMode');
  if (options.initial) {
    typeEl.value = options.initial.utilityType || options.initial.type || 'ELECTRICITY';
    modeEl.value = options.initial.readingMode || options.initial.mode || 'CUMULATIVE';
    sheet.querySelector('#utilValue').value = options.initial.value ?? '';
    sheet.querySelector('#utilNotes').value = options.initial.notes || '';
  }
  const syncUnit = () => {
    unitEl.value = modeEl.value==='INSTANTANEOUS' ? (typeEl.value==='ELECTRICITY' ? 'kW' : 'L/min') : UNITS[typeEl.value];
    sheet.querySelector('#utilValue').placeholder = modeEl.value==='CUMULATIVE' ? tr('Meter reading') : modeEl.value==='INTERVAL' ? message('Consumption for one non-overlapping period','الاستهلاك لفترة واحدة غير متداخلة') : message('Current power or flow','القدرة أو التدفق الحالي');
  };
  modeEl.addEventListener('change', syncUnit);
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
    if (!Number.isFinite(value) || value<0) { valueInput.focus(); return; }

    save.disabled = true;
    save.textContent = tr('SAVING…');

    try {
      const type = typeEl.value;
      await onAddReading({
        berthId:     berth.id,
        utilityType: type,
        value:       value,
        unit:        unitEl.value,
        readingMode: sheet.querySelector('#utilMode').value,
        readingType: modeEl.value==='INSTANTANEOUS' ? (type==='ELECTRICITY' ? 'POWER' : 'WATER_FLOW') : (type==='ELECTRICITY' ? 'ENERGY' : 'WATER_VOLUME'),
        notes:       notesInput.value.trim()
      });

      // Keep dialog open, clear value, focus back
      valueInput.value = '';
      notesInput.value = '';
      save.disabled = false;
      save.textContent = options.saveLabel || tr('SAVE');
      if (options.closeOnSave) { close(); return; }
      valueInput.focus();

    } catch (err) {
      console.error('[utility] save failed', err);
      save.disabled = false;
      save.textContent = options.saveLabel || tr('SAVE');
      let errEl = sheet.querySelector('.add-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'add-error';
        sheet.querySelector('.add-scroll').append(errEl);
      }
      errEl.textContent = err.message || tr('Failed to save reading.');
    }
  });
}
