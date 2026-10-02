// js/screens/EquipmentHelp.js

export function showEquipmentHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">⚙️ Equipment</div>

      <p class="help-desc">
        Keep track of all equipment installed on your boat. From engines to electronics, maintain a complete inventory.
      </p>

      <div class="help-section-title">What can you track?</div>

      <div class="help-cat-grid">
        <div class="help-cat">⚙️ Engine</div>
        <div class="help-cat">🧭 Navigation</div>
        <div class="help-cat">📻 Communication</div>
        <div class="help-cat">🛟 Safety</div>
        <div class="help-cat">⚓ Ground Tackle</div>
        <div class="help-cat">🔋 Electrical</div>
        <div class="help-cat">🚽 Plumbing</div>
        <div class="help-cat">🌀 HVAC</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">How to add equipment?</div>

      ${step('1', 'Type', 'Select equipment type (Engine, Navigation, Safety, etc.)')}
      ${step('2', 'Manufacturer', 'Enter manufacturer name (Yanmar, Garmin, Icom, etc.)')}
      ${step('3', 'Location', 'Specify location (Engine Room, Flybridge, Pilothouse, etc.)')}
      ${step('4', 'Model', 'Add model number (optional but recommended)')}
      ${step('5', 'Notes', 'Add notes (serial number, installation date, warranty info)')}

      <div class="help-divider"></div>

      <div class="help-section-title">💡 Pro Tips</div>
      <div class="help-tips">• Include serial numbers for warranty claims

• Take photos of equipment nameplates

• Add purchase date and cost for insurance

• Link Inventory records to each equipment

• Update when equipment is serviced or replaced</div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="eqHelpGotIt">Got it</button>
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