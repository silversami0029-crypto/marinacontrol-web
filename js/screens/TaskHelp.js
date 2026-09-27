// js/screens/TaskHelp.js

export function showTaskHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">✓ Tasks</div>

      <p class="help-desc">
        Tasks are your boat's general operational to-do items — cleaning, crew, administrative, and general technical jobs that don't belong in another MarinaControl module.
      </p>

      <div class="help-section-title">How to use Tasks</div>

      ${step('1', 'Swipe to complete', 'Swipe a task card to mark it as completed.')}
      ${step('2', 'Open a task', 'Open a task to view or edit its details, or mark it as completed using the Complete switch.')}
      ${step('3', 'Day-to-day only', 'Use Tasks for day-to-day operational activities. Maintenance, Inventory, Safety and other specialist work should be managed in their own MarinaControl modules.')}

      <div class="help-divider"></div>

      <div class="help-section-title">Tips</div>
      <div class="help-tips">• Use the filter chips to view All, Open, Overdue or Completed
• Overdue tasks appear in red on the Boat Dashboard
• Open the kebab menu for View, Edit, Complete, Duplicate and more</div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="tkHelpGotIt">Got it</button>
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
  dialog.querySelector('#tkHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}