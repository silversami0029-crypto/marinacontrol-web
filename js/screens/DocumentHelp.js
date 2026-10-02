import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/DocumentHelp.js

export function showDocumentHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("📄 Import Documents")}</div>

      <p class="help-desc">${tr("Import your boat documents in bulk using a CSV file.")}</p>

      <div class="help-section-title">${tr("How to import")}</div>

      ${step('1', 'Template', 'Download the sample CSV template to see the correct format')}
      ${step('2', 'Fill in', 'Edit the CSV with your document details (name, type, expiry date, notes, file path)')}
      ${step('3', 'Select', 'Select the CSV file from your device to import')}
      ${step('4', 'Confirm', 'Review any errors and confirm the import')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("CSV Format Requirements")}</div>
      <div class="help-tips">${tr("• First row must be headers: Document Name, Document Type, Expiry Date, Notes, File Path • Document Type must match available types: Insurance Policy, Vessel Registration, Radio License, Safety Equipment Certificate, etc. • Expiry Date format: YYYY-MM-DD • File Path is optional (leave blank if no file)")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="docHelpGotIt">${tr("Got it")}</button>
    </div>
  `;

  document.getElementById('modalRoot').append(backdrop, dialog);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    dialog.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    dialog.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); dialog.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);
  dialog.querySelector('#docHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}