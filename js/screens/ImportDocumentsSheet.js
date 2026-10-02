import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ImportDocumentsSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { importDocumentsFromRows } from '../db.js';

export function showImportDocumentsSheet({ boatId, boatName }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${tr("Import Documents from CSV")}</div>

    <div class="csv-info-scroll">
      <p class="csv-info-intro">${tr("Your CSV file should have a")}<b>${tr("header row")}</b>${tr("and")}<b>${tr("comma-separated columns")}</b>${tr("in this order:")}</p>

      <ul class="csv-info-list">
        <li><b>${tr("Document Name")}</b>${tr("— e.g. Insurance Certificate")}<span class="csv-req">${tr("(required)")}</span></li>
        <li><b>${tr("Document Type")}</b>${tr("— e.g. Insurance Policy")}<span class="csv-req">${tr("(required)")}</span></li>
        <li><b>${tr("Expiry Date")}</b>${tr("— YYYY-MM-DD (optional)")}</li>
        <li><b>${tr("Notes")}</b>${tr("— free text (optional)")}</li>
        <li><b>${tr("File Path")}</b>${tr("— Android file URI (optional, ignored on web)")}</li>
      </ul>

      <div class="csv-info-example-label">${tr("Example:")}</div>
      <pre class="csv-info-example">Document Name,Document Type,Expiry Date,Notes,File Path
Insurance Certificate,Insurance Policy,2025-12-31,Annual policy,/storage/insurance.pdf
Engine Manual,Maintenance Contract,2026-06-15,Volvo Penta D4,/storage/engine_manual.pdf
Boat Registration,Vessel Registration,2026-06-15,,/storage/registration.pdf</pre>
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="idCancel">${tr("Cancel")}</button>
      <button type="button" class="csv-btn csv-btn--choose" id="idChoose">${tr("Choose File")}</button>
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
  sheet.querySelector('#idCancel').addEventListener('click', close);
  sheet.querySelector('#idChoose').addEventListener('click', () => {
    close();
    pickAndImportCsv({ boatId, boatName });
  });
}

function pickAndImportCsv({ boatId, boatName }) {
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
        showResultModal({ success: 0, skipped: 0, failed: 0, errors: ['No valid rows found.'] });
        return;
      }

      runImportWithProgress({ boatId, boatName, rows });
    } catch (err) {
      console.error('[csv documents] read failed', err);
      showResultModal({ success: 0, skipped: 0, failed: 1, errors: [err.message || 'Failed to read file.'] });
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
    rows.push({
      name:   parts[0]?.trim() ?? '',
      type:   parts[1]?.trim() ?? '',
      expiry: parts[2]?.trim() ?? '',
      notes:  parts[3]?.trim() ?? '',
      file:   parts[4]?.trim() ?? ''
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

async function runImportWithProgress({ boatId, boatName, rows }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop is-open';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet is-open';
  sheet.innerHTML = `
    <div class="confirm-handle"></div>
    <div class="confirm-title">${tr("Importing documents…")}</div>
    <div class="confirm-message" id="importProgress">${tr("Starting…")}</div>
    <div class="import-bar-wrap">
      <div class="import-bar" id="importBar"></div>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);

  const progressEl = sheet.querySelector('#importProgress');
  const barEl      = sheet.querySelector('#importBar');

  try {
    const userId = store.userProfile?.userId || 0;

    const result = await importDocumentsFromRows(
      store.activeClientId,
      userId,
      boatId,
      rows,
      (done, skipped, total) => {
        const processed = done + skipped;
        const pct = total ? Math.round((processed / total) * 100) : 0;
        progressEl.textContent = `${processed} of ${total}  ·  ${done} added, ${skipped} skipped`;
        barEl.style.width = pct + '%';
      }
    );

    progressEl.textContent = tr('Done');
    barEl.style.width = '100%';

    await new Promise(r => setTimeout(r, 300));

    backdrop.remove();
    sheet.remove();

    showResultModal(result);

    if (result.success > 0) {
      toast(tr(`Imported ${result.success} document${result.success === 1 ? '' : 's'}`), { kind: 'success' });
    }
  } catch (err) {
    console.error('[import documents] failed', err);
    backdrop.remove();
    sheet.remove();
    showResultModal({ success: 0, skipped: 0, failed: 1, errors: [err.message || 'Import failed.'] });
  }
}

function showResultModal({ success, skipped, failed, errors = [] }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet';
  sheet.innerHTML = `
    <div class="confirm-handle"></div>
    <div class="confirm-title">${tr("Import complete")}</div>

    <div class="import-stats">
      <div class="import-stat">
        <div class="import-stat-value ok">${success}</div>
        <div class="import-stat-label">${tr("Added")}</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value skip">${skipped}</div>
        <div class="import-stat-label">${tr("Skipped")}</div>
      </div>
      <div class="import-stat">
        <div class="import-stat-value fail">${failed}</div>
        <div class="import-stat-label">${tr("Failed")}</div>
      </div>
    </div>

    ${errors.length ? `
      <div class="import-errors">
        <div class="import-errors-title">${tr("Errors")}</div>
        ${errors.slice(0, 10).map(e => `<div class="import-error-line">• ${escapeHtml(e)}</div>`).join('')}
        ${errors.length > 10 ? `<div class="import-error-line">…and ${errors.length - 10} more</div>` : ''}
      </div>
    ` : ''}

    <div class="confirm-actions">
      <button class="confirm-btn confirm-btn--cancel" id="closeImportResult" style="flex:1;">${tr("Close")}</button>
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