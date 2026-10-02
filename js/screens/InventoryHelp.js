import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/InventoryHelp.js

export function showInventoryHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("📦 Inventory")}</div>

      <p class="help-desc">${tr("Track all your boat's supplies, spare parts, and consumables in one place. Never run out of essentials again.")}</p>

      <div class="help-section-title">${tr("What can you track?")}</div>

      <div class="help-cat-grid">
        <div class="help-cat">${tr("🔧 Spare Parts")}</div>
        <div class="help-cat">${tr("🛢️ Consumables")}</div>
        <div class="help-cat">${tr("🧴 Cleaning Supplies")}</div>
        <div class="help-cat">${tr("🛟 Safety Gear")}</div>
        <div class="help-cat">${tr("🔨 Tools")}</div>
        <div class="help-cat">${tr("🍽️ Galley Items")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to add inventory?")}</div>

      ${step('1', 'Item name', "Enter item name (e.g., 'Oil Filter', 'Diesel', 'Life Jacket')")}
      ${step('2', 'Type', 'Select type (Spare Parts, Consumables, Safety Gear, etc.)')}
      ${step('3', 'Location', 'Specify location (Engine Room, Galley, Bow Locker, etc.)')}
      ${step('4', 'Quantity', 'Set quantity (how many you have on board)')}
      ${step('5', 'Notes', 'Add notes (part number, supplier, reorder reminder)')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Update quantities after each trip to avoid shortages • Set low quantity alerts for critical spares • Store part numbers in notes for easy reordering • Track inventory across different storage locations • Take photos of items for quick identification")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="invHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#invHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}