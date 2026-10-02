import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ImportCustomersSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { importCustomersFromRows } from '../db.js';

export function showImportCustomersSheet() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">${tr("Import from CSV")}</div>

    <div class="csv-info-scroll">
      <p class="csv-info-intro">${tr("Your CSV file should have a")}<b>${tr("header row")}</b>${tr("and")}<b>${tr("comma-separated columns")}</b>${tr("in this order:")}</p>

      <ul class="csv-info-list">
        <li><b>name</b>${tr("— Customer name")}<span class="csv-req">${tr("(required)")}</span></li>
        <li><b>email</b>${tr("— Email address")}</li>
        <li><b>phone</b>${tr("— Phone number")}</li>
        <li><b>notes</b>${tr("— Notes")}</li>
      </ul>

      <div class="csv-info-example-label">${tr("Example:")}</div>
      <pre class="csv-info-example">name,email,phone,notes
John Smith,john.smith@email.com,+44 7700 123456,Prefers email contact
Jane Doe,jane.doe@email.com,+44 7700 654321,VIP member</pre>
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="icCancel">${tr("Cancel")}</button>
      <button type="button" class="csv-btn csv-btn--choose" id="icChoose">${tr("Choose File")}</button>
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
  sheet.querySelector('#icCancel').addEventListener('click', close);
  sheet.querySelector('#icChoose').addEventListener('click', () => {
    close();
    pickAndImportCsv();
  });
}

/* ============================================================
   PICK + IMPORT
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
      console.error('[csv customers] read failed', err);
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
    if (parts.length < 1) continue;

    rows.push({
      name:  parts[0]?.trim() ?? '',
      email: parts[1]?.trim() ?? '',
      phone: parts[2]?.trim() ?? '',
      notes: parts[3]?.trim() ?? ''
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
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-backdrop is-open';

  const sheet = document.createElement('div');
  sheet.className = 'confirm-sheet is-open';
  sheet.innerHTML = `
    <div class="confirm-handle"></div>
    <div class="confirm-title">${tr("Importing customers…")}</div>
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

    const result = await importCustomersFromRows(
      store.activeClientId,
      userId,
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

    await new Promise((r) => setTimeout(r, 300));

    backdrop.remove();
    sheet.remove();

    showResultModal(result);

    if (result.success > 0) {
      toast(tr(`Imported ${result.success} customer${result.success === 1 ? '' : 's'}`),
            { kind: 'success' });
    }
  } catch (err) {
    console.error('[import customers] failed', err);
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