import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/MaintenanceHelp.js

export function showMaintenanceHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("🔧 Maintenance")}</div>

      <p class="help-desc">${tr("Keep your boat in top condition by tracking all Maintenance tasks. Never miss an important service again.")}</p>

      <div class="help-section-title">${tr("What can you track?")}</div>

      <div class="help-cat-grid">
        <div class="help-cat">${tr("⚙️ Engine Service")}</div>
        <div class="help-cat">${tr("🛢️ Oil Change")}</div>
        <div class="help-cat">${tr("🔧 Filter Replacement")}</div>
        <div class="help-cat">${tr("🔋 Battery Check")}</div>
        <div class="help-cat">${tr("🚤 Hull Cleaning")}</div>
        <div class="help-cat">${tr("🧰 HVAC Service")}</div>
        <div class="help-cat">${tr("⚓ Anchor Winch")}</div>
        <div class="help-cat">${tr("📡 Electronics")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to add Maintenance?")}</div>

      ${step('1', 'Type', 'Select Maintenance type (Engine Service, Oil Change, etc.)')}
      ${step('2', 'Date', 'Enter the service date (when work was done or scheduled)')}
      ${step('3', 'Notes', 'Add notes (what was done, parts replaced, mechanic name)')}
      ${step('4', 'Complete', 'Mark as completed when done (or leave unchecked for future tasks)')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Schedule regular engine Maintenance every 100-200 hours • Keep oil change records for warranty claims • Attach receipts to track Maintenance costs • Set reminders before peak boating season • Log completed work immediately to maintain accurate history")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="maintHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#maintHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}