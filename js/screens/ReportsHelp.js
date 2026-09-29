// js/screens/ReportsHelp.js

// js/screens/ReportsHelp.js

export function showReportsHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">📊 Reports</div>

      <p class="help-desc">
        Generate and export reports to track your fleet's financial health, documents, and occupancy.
      </p>

      ${step('1', 'Unpaid Invoices', 'See all outstanding invoices, overdue amounts, and what each boat owes.')}
      ${step('2', 'Expiring Documents', 'Track certificates, insurance, and registrations before they expire.')}
      ${step('3', 'Berth Occupancy', 'View current berth usage, occupancy rates, and average stay duration.')}
      ${step('4', 'Revenue', 'Filter by category and date range. Tap the chart button for visual breakdown.')}

      <div class="help-divider"></div>

      <div class="rp-help-heading">📄 Exporting Reports</div>
      <div class="rp-help-export">
        Tap the Export button to generate a PDF report. You can then share it via email, messages, or save it to your device.
      </div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="rpHelpGotIt">Got it</button>
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
  dialog.querySelector('#rpHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}