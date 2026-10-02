import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/EquipmentHelp.js

export function showEquipmentHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("⚙️ Equipment")}</div>

      <p class="help-desc">${tr("Keep track of all equipment installed on your boat. From engines to electronics, maintain a complete inventory.")}</p>

      <div class="help-section-title">${tr("What can you track?")}</div>

      <div class="help-cat-grid">
        <div class="help-cat">${tr("⚙️ Engine")}</div>
        <div class="help-cat">${tr("🧭 Navigation")}</div>
        <div class="help-cat">${tr("📻 Communication")}</div>
        <div class="help-cat">${tr("🛟 Safety")}</div>
        <div class="help-cat">${tr("⚓ Ground Tackle")}</div>
        <div class="help-cat">${tr("🔋 Electrical")}</div>
        <div class="help-cat">${tr("🚽 Plumbing")}</div>
        <div class="help-cat">${tr("🌀 HVAC")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to add equipment?")}</div>

      ${step('1', 'Type', 'Select equipment type (Engine, Navigation, Safety, etc.)')}
      ${step('2', 'Manufacturer', 'Enter manufacturer name (Yanmar, Garmin, Icom, etc.)')}
      ${step('3', 'Location', 'Specify location (Engine Room, Flybridge, Pilothouse, etc.)')}
      ${step('4', 'Model', 'Add model number (optional but recommended)')}
      ${step('5', 'Notes', 'Add notes (serial number, installation date, warranty info)')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Include serial numbers for warranty claims • Take photos of equipment nameplates • Add purchase date and cost for insurance • Link Inventory records to each equipment • Update when equipment is serviced or replaced")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="eqHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#eqHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}