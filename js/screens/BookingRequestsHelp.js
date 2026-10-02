import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/BookingRequestsHelp.js

export function showBookingRequestsHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("📅 Booking Requests")}</div>

      <p class="help-desc">${tr("Incoming berth booking requests for your marina. Review each one, check the boat and dates, then approve or decline.")}</p>

      <div class="help-section-title">${tr("What you'll see")}</div>

      ${step('1', 'Vessel', 'The boat name requested by the customer')}
      ${step('2', 'Sender', 'Who sent the request (WhatsApp, email or manual) and their phone number')}
      ${step('3', 'Dates', 'Requested arrival and departure dates')}
      ${step('4', 'Message', 'The original message with any special requirements')}
      ${step('5', 'Status', 'NEW, REVIEWING, APPROVED or DECLINED')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to handle a request")}</div>

      ${step('1', 'Open', 'Tap a card to see the full request')}
      ${step('2', 'Approve', 'Assign a compatible berth for the requested dates')}
      ${step('3', 'More', 'Edit the dates or decline the request')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Approving creates a berth booking automatically • The vessel is created in MarinaControl if not already registered • Only compatible berths for the vessel size are offered • Maintenance berths are never offered")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="bkrHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#bkrHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}