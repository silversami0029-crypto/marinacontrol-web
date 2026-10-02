// js/screens/ImportSafetySheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';

const CATEGORIES = [
  'Fire Safety', 'Life Saving', 'Navigation', 'Communication',
  'Pyrotechnics', 'First Aid', 'Safety Equipment', 'Emergency',
  'Pollution Prevention', 'Other'
];

const IMPORTANCE = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function showImportSafetySheet({ boatId, boatName }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Import Safety Items from CSV</div>

    <div class="csv-info-scroll">
      <p class="csv-info-intro">
        Your CSV file should have a <b>header row</b> and
        <b>comma-separated columns</b> in this order:
      </p>

      <ul class="csv-info-list">
        <li><b>Title</b> — e.g. SOLAS Red Parachute Flare <span class="csv-req">(required)</span></li>
        <li><b>Category</b> — e.g. Pyrotechnics <span class="csv-req">(required)</span></li>
        <li><b>Location</b> — e.g. Waterproof cockpit locker</li>
        <li><b>Importance</b> — CRITICAL / HIGH / MEDIUM / LOW</li>
        <li><b>Validity Years</b> — number</li>
        <li><b>Validity Months</b> — number</li>
        <li><b>Notes</b> — free text</li>
      </ul>

      <div class="csv-info-example-label">Example:</div>
      <pre class="csv-info-example">Title,Category,Location,Importance,Validity Years,Validity Months,Notes
SOLAS Red Parachute Flare,Pyrotechnics,Waterproof cockpit locker,CRITICAL,3,0,Check corrosion
Life Jacket Adult,Life Saving,Cabin locker,MEDIUM,0,60,Inflatable type</pre>
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="isCancel">Cancel</button>
      <button type="button" class="csv-btn csv-btn--choose" id="isChoose">Choose File</button>
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
  sheet.querySelector('#isCancel').addEventListener('click', close);
  sheet.querySelector('#isChoose').addEventListener('click', () => {
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
      console.error('[csv safety] read failed', err);
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
      title:          parts[0]?.trim() ?? '',
      category:       parts[1]?.trim() ?? '',
      location:       parts[2]?.trim() ?? '',
      importance:     (parts[3]?.trim() ?? '').toUpperCase() || 'MEDIUM',
      validityYears:  parts[4]?.trim() ?? '0',
      validityMonths: parts[5]?.trim() ?? '0',
      notes:          parts[6]?.trim() ?? ''
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
    <div class="confirm-title">Importing safety items…</div>
    <div class="confirm-message" id="importProgress">Starting…</div>
    <div class="import-bar-wrap">
      <div class="import-bar" id="importBar"></div>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);

  const progressEl = sheet.querySelector('#importProgress');
  const barEl      = sheet.querySelector('#importBar');

  let success = 0;
  let skipped = 0;
  const errors = [];

  const {
    collection, query, where, getDocs, doc, setDoc, serverTimestamp
  } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const { db } = await import('../firebase.js');

  const clientId = Number(store.activeClientId);
  const userId = String(store.userProfile?.userId || 0);

  try {
    // Load existing titles for this boat to detect duplicates
    const existingSnap = await getDocs(
      query(collection(db, 'safety_items'), where('clientId', '==', clientId))
    );
    const existingTitles = new Set();
    let maxId = 0;
    existingSnap.forEach(d => {
      const data = d.data();
      if (Number(data.boatId) === Number(boatId)) {
        const t = (data.title || '').trim().toLowerCase();
        if (t) existingTitles.add(t);
      }
      const v = Number(data.id || 0);
      if (v > maxId) maxId = v;
    });

    let nextId = maxId + 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNo = i + 2;

      try {
        const title = (row.title || '').trim();
        if (!title) { errors.push(`Line ${lineNo}: title required`); skipped++; continue; }
        if (title.length > 100) { errors.push(`Line ${lineNo}: title too long`); skipped++; continue; }

        const category = (row.category || '').trim();
        if (!category) { errors.push(`Line ${lineNo}: category required`); skipped++; continue; }
        if (!CATEGORIES.some(c => c.toLowerCase() === category.toLowerCase())) {
          errors.push(`Line ${lineNo}: invalid category "${category}"`);
          skipped++;
          continue;
        }
        const catMatch = CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase());

        const importance = (row.importance || 'MEDIUM').toUpperCase();
        if (!IMPORTANCE.includes(importance)) {
          errors.push(`Line ${lineNo}: invalid importance "${importance}"`);
          skipped++;
          continue;
        }

        const key = title.toLowerCase();
        if (existingTitles.has(key)) { skipped++; onProgress(success, skipped, rows.length, progressEl, barEl); continue; }

        const validityYears = Math.max(0, parseInt(row.validityYears, 10) || 0);
        const validityMonths = Math.max(0, parseInt(row.validityMonths, 10) || 0);

        const now = Date.now();
        const expiryMs = (validityYears || validityMonths)
          ? (() => {
              const d = new Date(now);
              d.setFullYear(d.getFullYear() + validityYears);
              d.setMonth(d.getMonth() + validityMonths);
              return d.getTime();
            })()
          : 0;

        const alertDays = 30;
        const nextInspectionMs = expiryMs ? expiryMs - alertDays * 24 * 60 * 60 * 1000 : 0;

        const cloudId = (crypto.randomUUID ? crypto.randomUUID() : `s-${now}-${nextId}`);

        await setDoc(doc(db, 'safety_items', cloudId), {
          id: nextId,
          clientId,
          boatId: Number(boatId),
          boatName: boatName || '',
          title,
          category: catMatch,
          location: (row.location || '').trim(),
          importance,
          status: 'ACTIVE',
          expiryDate: expiryMs,
          nextInspectionDate: nextInspectionMs,
          lastInspectedDate: 0,
          purchaseDate: now,
          alertDaysBefore: alertDays,
          validityYears,
          validityMonths,
          notes: (row.notes || '').trim(),
          photoPath: null,
          serialNumber: null,
          supplierInfo: null,
          templateId: 'CUSTOM_IMPORT',
          templateItemId: '',
          createdAt: now,
          updatedAt: now,
          lastModified: now,
          lastModifiedBy: userId,
          syncTime: serverTimestamp(),
          syncedAt: 0
        });

        existingTitles.add(key);
        nextId++;
        success++;
      } catch (err) {
        console.error('[import safety] row failed', err);
        errors.push(`Line ${lineNo}: ${err.message || 'write failed'}`);
      }

      onProgress(success, skipped, rows.length, progressEl, barEl);
    }

    progressEl.textContent = 'Done';
    barEl.style.width = '100%';
    await new Promise(r => setTimeout(r, 300));

    backdrop.remove();
    sheet.remove();

    showResultModal({ success, skipped, failed: errors.length, errors });

    if (success > 0) {
      toast(`Imported ${success} safety item${success === 1 ? '' : 's'}`, { kind: 'success' });
    }
  } catch (err) {
    console.error('[import safety] failed', err);
    backdrop.remove();
    sheet.remove();
    showResultModal({ success: 0, skipped: 0, failed: 1, errors: [err.message || 'Import failed.'] });
  }
}

function onProgress(done, skipped, total, progressEl, barEl) {
  const processed = done + skipped;
  const pct = total ? Math.round((processed / total) * 100) : 0;
  progressEl.textContent = `${processed} of ${total}  ·  ${done} added, ${skipped} skipped`;
  barEl.style.width = pct + '%';
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
      <button class="confirm-btn confirm-btn--cancel" id="closeImportResult" style="flex:1;">
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