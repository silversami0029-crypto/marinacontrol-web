import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ShiftHelp.js

export function showShiftHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("🕒 Shift Schedule")}</div>

      <p class="help-desc">${tr("Manage staff shifts and assignments across your marina. Keep track of who is working, when, and where.")}</p>

      <div class="help-section-title">${tr("Shift Types")}</div>
      <div class="help-cat-grid">
        <div class="help-cat">${tr("🌅 Morning")}</div>
        <div class="help-cat">${tr("☀️ Afternoon")}</div>
        <div class="help-cat">${tr("🌙 Night")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("Staff Roles")}</div>
      <div class="help-cat-grid">
        <div class="help-cat">${tr("🪝 Dockhand")}</div>
        <div class="help-cat">${tr("📋 Office")}</div>
        <div class="help-cat">${tr("⛽ Fuel Dock")}</div>
        <div class="help-cat">${tr("🔧 Maintenance")}</div>
        <div class="help-cat">${tr("🛡️ Security")}</div>
        <div class="help-cat">${tr("👔 Manager")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to schedule a shift?")}</div>

      ${step('1', 'Select crew', 'Select a crew member from your list')}
      ${step('2', 'Shift type', 'Choose shift type (Morning / Afternoon / Night)')}
      ${step('3', 'Role', 'Assign a role (Dockhand, Office, Fuel Dock, etc.)')}
      ${step('4', 'Date', 'Pick the date for the shift')}
      ${step('5', 'Notes', 'Add notes (special instructions, location, etc.)')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Schedule morning shifts the day before • Ensure night shifts have at least 2 staff members • Use notes for specific boat assignments • Review weekly schedule every Friday • Keep a backup contact for each shift")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="shHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#shHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}