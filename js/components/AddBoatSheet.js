// js/components/AddBoatSheet.js
// Two views in one sheet (Options → Form) + CSV info sheet
// Supports two modes:
//   - ADD  (no boat passed)  → "Boat Details" + "Save Boat"  + onSaveSingle
//   - EDIT (boat passed)     → "Edit Boat"    + "Update Boat" + onUpdateSingle

const ICONS = {
  add: `
    <svg class="add-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>`,
  upload: `
    <svg class="add-icon" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>`,
  chevron: `
    <svg class="add-chevron" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 6 15 12 9 18"/>
    </svg>`
};

const BASE_STATUS_OPTIONS = ['In Service', 'Off Service', 'Maintenance'];

/**
 * @param {Object} opts
 * @param {import('../models/Boat.js').Boat} [opts.boat]   If provided, opens in EDIT mode
 * @param {Function} opts.onSaveSingle  (fields) => Promise   (ADD mode)
 * @param {Function} [opts.onUpdateSingle] (fields) => Promise   (EDIT mode)
 * @param {Function} [opts.onBulkImport]
 */
export function showAddBoatSheet(opts = {}) {
  const { boat, onSaveSingle, onUpdateSingle, onBulkImport } = opts;
  const isEditMode = !!boat;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div id="addBoatBody"></div>
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

  const body = sheet.querySelector('#addBoatBody');

  /* ---------- Options (only in ADD mode) ---------- */
  function renderOptions() {
    body.innerHTML = `
      <div class="sheet-title" style="text-align:center;">Add Boat</div>

      <div class="add-option" id="optSingle">
        <div class="add-option-icon">${ICONS.add}</div>
        <div class="add-option-text">
          <div class="add-option-title">Add Single Boat</div>
          <div class="add-option-sub">Add one boat manually with all details</div>
        </div>
        ${ICONS.chevron}
      </div>

      <div class="add-option" id="optBulk" style="margin-top:8px;">
        <div class="add-option-icon">${ICONS.upload}</div>
        <div class="add-option-text">
          <div class="add-option-title">Bulk Import</div>
          <div class="add-option-sub">Import multiple boats from CSV file</div>
        </div>
        ${ICONS.chevron}
      </div>
    `;

    body.querySelector('#optSingle').addEventListener('click', () => renderForm());
    body.querySelector('#optBulk').addEventListener('click', () => {
      if (onBulkImport) { close(); onBulkImport(); }
      else renderCsvInfo();
    });
  }

  /* ---------- CSV info ---------- */
  function renderCsvInfo() {
    body.innerHTML = `
      <div class="sheet-title" style="text-align:center;">Import from CSV</div>

      <div class="csv-info-scroll">
        <p class="csv-info-intro">
          Your CSV file should have a <b>header row</b> and
          <b>comma-separated columns</b> in this order:
        </p>

        <ul class="csv-info-list">
          <li><b>name</b> — Boat name <span class="csv-req">(required)</span></li>
          <li><b>type</b> — Vessel type</li>
          <li><b>model</b> — Model number</li>
          <li><b>hin</b> — HIN number</li>
          <li><b>mmsi</b> — MMSI number</li>
          <li><b>port</b> — Home port</li>
          <li><b>status</b> — In Service / Off Service / Maintenance</li>
        </ul>

        <div class="csv-info-example-label">Example:</div>
        <pre class="csv-info-example">name,type,model,hin,mmsi,port,status
Sea Ray,Sport,270,ABC123,123456789,Monaco,Active
Bayliner,Cruiser,285,XYZ789,987654321,Miami,Maintenance</pre>
      </div>

      <div class="csv-info-actions">
        <button type="button" class="csv-btn csv-btn--cancel" id="csvCancel">Cancel</button>
        <button type="button" class="csv-btn csv-btn--choose" id="csvChoose">Choose File</button>
      </div>
    `;

    body.querySelector('#csvCancel').addEventListener('click', () => close());
    body.querySelector('#csvChoose').addEventListener('click', () => {
      close();
      pickAndImportCsv();
    });
  }

  /* ---------- Form (used for both Add + Edit) ---------- */
  function renderForm() {
    const title  = isEditMode ? 'Edit Boat'   : 'Boat Details';
    const btnTxt = isEditMode ? 'Update Boat' : 'Save Boat';

    // Build status options — in edit mode, add the current value if non-standard
    let statusOptions = [...BASE_STATUS_OPTIONS];
    if (isEditMode && boat.status && !statusOptions.includes(boat.status)) {
      statusOptions = [boat.status, ...statusOptions];
    }

    // Prefill helper — empty string if value is 0 / null / undefined
    const prefill = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number' && v === 0) return '';
      return String(v);
    };

    body.innerHTML = `
      <div class="sheet-title" style="text-align:center;">${title}</div>

      <form id="addBoatForm" class="add-form" novalidate>
        <div class="add-scroll">

          <input class="add-input" id="f-name"  type="text" placeholder="Boat Name *"
                 autocomplete="off" autocapitalize="words"
                 value="${isEditMode ? escapeAttr(prefill(boat.name)) : ''}">

          <input class="add-input" id="f-type"  type="text" placeholder="Boat Type"
                 autocomplete="off" autocapitalize="words"
                 value="${isEditMode ? escapeAttr(prefill(boat.type)) : ''}">

          <div class="add-section-title">Vessel Dimensions</div>
          <div class="add-section-sub">Optional • used for berth compatibility checks</div>

          <div class="add-row-2">
            <input class="add-input" id="f-length" type="number" step="0.1" placeholder="Length (m)"
                   value="${isEditMode ? escapeAttr(prefill(boat.length)) : ''}">
            <input class="add-input" id="f-beam"   type="number" step="0.1" placeholder="Beam (m)"
                   value="${isEditMode ? escapeAttr(prefill(boat.beam)) : ''}">
          </div>

          <div class="add-row-2">
            <input class="add-input" id="f-draft"    type="number" step="0.1" placeholder="Draft (m)"
                   value="${isEditMode ? escapeAttr(prefill(boat.draft)) : ''}">
            <input class="add-input" id="f-airDraft" type="number" step="0.1" placeholder="Air Draft (m)"
                   value="${isEditMode ? escapeAttr(prefill(boat.airDraft)) : ''}">
          </div>

          <input class="add-input" id="f-engineType" type="text" placeholder="Engine Type"
                 autocomplete="off" autocapitalize="words"
                 value="${isEditMode ? escapeAttr(prefill(boat.engineType)) : ''}">

          <input class="add-input" id="f-hin"  type="text" placeholder="HIN Number"
                 autocomplete="off" style="text-transform:uppercase;"
                 value="${isEditMode ? escapeAttr(prefill(boat.hin)) : ''}">

          <input class="add-input" id="f-mmsi" type="text" placeholder="MMSI"
                 inputmode="numeric" autocomplete="off"
                 value="${isEditMode ? escapeAttr(prefill(boat.mmsi)) : ''}">

          <input class="add-input" id="f-port" type="text" placeholder="Port Name"
                 autocomplete="off" autocapitalize="words"
                 value="${isEditMode ? escapeAttr(prefill(boat.port)) : ''}">

          <div class="add-section-title" style="margin-top:20px;">Status</div>
          <select class="add-input add-select" id="f-status">
            ${statusOptions.map(s => {
              const selected = isEditMode && s === boat.status ? 'selected' : '';
              return `<option value="${escapeAttr(s)}" ${selected}>${escapeHtml(s)}</option>`;
            }).join('')}
          </select>

          <label class="add-checkbox" style="margin-top:16px;">
            <input type="checkbox" id="f-setActive"
                   ${isEditMode ? (boat.isActive ? 'checked' : '') : 'checked'}>
            <span>Set as active boat</span>
          </label>
        </div>

        <button type="submit" class="add-save" id="f-save">${btnTxt}</button>
      </form>
    `;

    const form = body.querySelector('#addBoatForm');
    const name = body.querySelector('#f-name');
    const save = body.querySelector('#f-save');

    // In ADD mode → start disabled; in EDIT mode → start enabled (name prefilled)
    save.disabled = isEditMode ? false : name.value.trim().length === 0;

    // Enable / disable as user types (matches Android)
    name.addEventListener('input', () => {
      save.disabled = name.value.trim().length === 0;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (save.disabled) return;

      const fields = {
        name:       body.querySelector('#f-name').value.trim(),
        type:       body.querySelector('#f-type').value.trim() || 'Unknown',
        engineType: body.querySelector('#f-engineType').value.trim() || 'Unknown',
        hin:        body.querySelector('#f-hin').value.trim() || 'TBC',
        mmsi:       body.querySelector('#f-mmsi').value.trim() || 'TBC',
        port:       body.querySelector('#f-port').value.trim() || 'TBC',
        status:     body.querySelector('#f-status').value,
        isActive:   body.querySelector('#f-setActive').checked,
        customerId: isEditMode ? boat.customerId : 0,
        length:     parseFloat(body.querySelector('#f-length').value) || 0,
        beam:       parseFloat(body.querySelector('#f-beam').value) || 0,
        draft:      parseFloat(body.querySelector('#f-draft').value) || 0,
        airDraft:   parseFloat(body.querySelector('#f-airDraft').value) || 0
      };

      save.disabled = true;
      save.textContent = isEditMode ? 'Updating…' : 'Saving…';

      try {
        if (isEditMode) {
          await onUpdateSingle(fields);
        } else {
          await onSaveSingle(fields);
        }
        close();
      } catch (err) {
        console.error('[boat form] failed', err);
        save.disabled = false;
        save.textContent = btnTxt;
        let errEl = body.querySelector('.add-error');
        if (!errEl) {
          errEl = document.createElement('div');
          errEl.className = 'add-error';
          form.insertBefore(errEl, save);
        }
        errEl.textContent = err.message || 'Failed to save.';
      }
    });
  }

  // Route to correct view
  if (isEditMode) renderForm();
  else renderOptions();
}

/* ============================================================
   CSV IMPORT (unchanged)
   ============================================================ */
function pickAndImportCsv() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.txt,text/csv';
  input.style.display = 'none';

  input.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    input.remove();
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (!rows.length) {
        showResultModal({
          success: 0, skipped: 0, failed: 0,
          errors: ['No valid rows found in file.']
        });
        return;
      }

      runImportWithProgress(rows);
    } catch (err) {
      console.error('[csv] read failed', err);
      showResultModal({
        success: 0, skipped: 0, failed: 1,
        errors: [err.message || 'Failed to read file.']
      });
    }
  });

  document.body.appendChild(input);
  input.click();
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    const parts = splitCsvLine(line);
    if (parts.length < 3) continue;

    rows.push({
      name:   parts[0]?.trim() ?? '',
      type:   parts[1]?.trim() ?? '',
      model:  parts[2]?.trim() ?? '',
      hin:    parts[3]?.trim() ?? '',
      mmsi:   parts[4]?.trim() ?? '',
      port:   parts[5]?.trim() ?? '',
      status: parts[6]?.trim() ?? ''
    });
  }

  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

async function runImportWithProgress(rows) {
  const { store } = await import('../store.js');
  const { importBoatsFromRows } = await import('../db.js');
  const { toast } = await import('../ui/toast.js');

  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop is-open';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet is-open';
  sheet.innerHTML = `
    <div class="confirm-handle"></div>
    <div class="confirm-title">Importing boats…</div>
    <div class="confirm-message" id="importProgress">Starting…</div>
    <div class="import-bar-wrap">
      <div class="import-bar" id="importBar"></div>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);

  const progressEl = sheet.querySelector('#importProgress');
  const barEl      = sheet.querySelector('#importBar');

  try {
    const userId = store.userProfile?.userId || 0;

    const result = await importBoatsFromRows(
      store.activeClientId,
      userId,
      rows,
      (done, skipped, total) => {
        const processed = done + skipped;
        const pct = Math.round((processed / total) * 100);
        progressEl.textContent = `${processed} of ${total}  ·  ${done} added, ${skipped} skipped`;
        barEl.style.width = pct + '%';
      }
    );

    progressEl.textContent = 'Done';
    barEl.style.width = '100%';

    await new Promise((r) => setTimeout(r, 300));

    backdrop.remove();
    sheet.remove();

    showResultModal(result);

    if (result.success > 0) {
      toast(`Imported ${result.success} boat${result.success === 1 ? '' : 's'}`,
            { kind: 'success' });
    }
  } catch (err) {
    console.error('[import] failed', err);
    backdrop.remove();
    sheet.remove();
    showResultModal({
      success: 0, skipped: 0, failed: 1,
      errors: [err.message || 'Import failed.']
    });
  }
}

function showResultModal({ success, skipped, failed, errors = [] }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet';
  sheet.innerHTML = `
    <div class="confirm-handle"></div>
    <div class="confirm-title">Import complete</div>

    <div class="import-stats">
      <div class="import-stat">
        <div class="import-stat-value ok">${success}</div>
        <div class="import-stat-label">Added</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value skip">${skipped}</div>
        <div class="import-stat-label">Skipped</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value fail">${failed}</div>
        <div class="import-stat-label">Failed</div>
      </div>
    </div>

    ${errors.length ? `
      <div class="import-errors">
        <div class="import-errors-title">Errors</div>
        ${errors.slice(0, 10).map(e => `<div class="import-error-line">• ${escapeHtml(e)}</div>`).join('')}
        ${errors.length > 10 ? `<div class="import-error-line">…and ${errors.length - 10} more</div>` : ''}
      </div>
    ` : ''}

    <div class="confirm-actions">
      <button class="confirm-btn confirm-btn--cancel" id="closeImportResult"
              style="flex:1;">
        Close
      </button>
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
  sheet.querySelector('#closeImportResult').addEventListener('click', close);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}