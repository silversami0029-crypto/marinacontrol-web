import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/SafetyHelp.js

export function showSafetyHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("🛟 Safety")}</div>

      <p class="help-desc">${tr("Track all safety equipment on your boat. Get expiry alerts and inspection reminders to keep everyone safe.")}</p>

      <div class="help-section-title">${tr("Safety Categories")}</div>

      <div class="help-cat-grid">
        <div class="help-cat">${tr("🧨 Pyrotechnics")}</div>
        <div class="help-cat">${tr("🔥 Fire")}</div>
        <div class="help-cat">${tr("🚑 Medical")}</div>
        <div class="help-cat">${tr("🧭 Navigation")}</div>
        <div class="help-cat">${tr("📡 Communication")}</div>
        <div class="help-cat">${tr("🛟 Life Rafts")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("Importance Levels")}</div>

      <div class="help-importance">
        <div class="help-imp-label" style="color:#D32F2F;">${tr("🔴 CRITICAL")}</div>
        <div class="help-imp-body">${tr("Life rafts, EPIRB, fire extinguishers")}</div>

        <div class="help-imp-label" style="color:#FF9800;">${tr("🟠 HIGH")}</div>
        <div class="help-imp-body">${tr("Flares, life jackets, first aid kits")}</div>

        <div class="help-imp-label" style="color:#FFC107;">${tr("🟡 MEDIUM")}</div>
        <div class="help-imp-body">${tr("Fire blankets, signaling mirrors")}</div>

        <div class="help-imp-label" style="color:#4CAF50;">${tr("🟢 LOW")}</div>
        <div class="help-imp-body">${tr("Whistles, emergency blankets")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to add safety items?")}</div>

      ${step('1', 'Category', 'Select category (Pyrotechnics, Fire, Medical, etc.)')}
      ${step('2', 'Title & location', 'Add title and location on the boat')}
      ${step('3', 'Importance', 'Set importance (CRITICAL, HIGH, MEDIUM, LOW)')}
      ${step('4', 'Expiry', 'Enter the expiry date directly')}
      ${step('5', 'Details', 'Add supplier info, serial number, and photo')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Check flare expiry dates annually (typically 3 years) • Inspect fire extinguishers monthly • Log inspection dates for insurance compliance • Take photos of expiry stamps • Manually set expiry dates when adding items • CRITICAL items alert 90 days before expiry • HIGH items alert 60 days before expiry")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="safetyHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#safetyHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}