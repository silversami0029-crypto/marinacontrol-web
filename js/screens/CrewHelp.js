import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/CrewHelp.js

export function showCrewHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("👥 Import Crew")}</div>

      <p class="help-desc">${tr("Import your boat crew members in bulk using a CSV file.")}</p>

      <div class="help-section-title">${tr("How to import")}</div>

      ${step('1', 'Template', 'Download the sample CSV template to see the correct format')}
      ${step('2', 'Fill in', 'Edit the CSV with crew details (name, email, role, role details)')}
      ${step('3', 'Select', 'Select the CSV file from your device to import')}
      ${step('4', 'Confirm', 'Review any errors and confirm the import')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("CSV Format Requirements")}</div>
      <div class="help-tips">${tr("• First row must be headers: Name, Email, Role, Role Details • Name and Email are required fields • Role Examples: Captain, Engineer, Deckhand, Steward, Chef • Role Details (optional): Additional notes or certifications")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="crewHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#crewHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}