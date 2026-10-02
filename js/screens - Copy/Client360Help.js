// js/screens/Client360Help.js

export function showClient360Help() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">360° ⓘ Client View</div>

      <p class="help-desc">
        Get a complete overview of any client — all key information in one place.
      </p>

      <div class="help-section-title">What you'll see</div>

      ${step('1', 'Client Card', 'Client name, email, phone, and membership status.')}
      ${step('2', 'Action Banner', 'Alerts you to outstanding invoices, expiring documents, and safety items needing attention.')}
      ${step('3', 'Boat Card', 'Vessel name, HIN, and current service status (Active, Maintenance, Out of Service).')}
      ${step('4', 'Berth & Booking', 'Assigned berth, arrival date, and expected departure.')}
      ${step('5', 'Financial Snapshot', 'Outstanding balance, last payment, and account status at a glance.')}
      ${step('6', 'Recent Activity', 'Timeline of key events: invoice payments, berth assignments, document uploads, and maintenance completions.')}
      ${step('7', 'Quick Actions', 'One-tap access to: Message Client, Create Invoice, Move Berth, Add Note.')}

      <div class="help-divider"></div>

      <div class="help-section-title">Tips</div>
      <div class="help-tips">• Use the search icon to find any client by name or email
• Tap any card to view more details
• Red alert banner shows items needing immediate attention
• Swipe back to return to Fleet Dashboard</div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="c360HelpGotIt">Got it</button>
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
  dialog.querySelector('#c360HelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}