// js/screens/ShiftHelp.js

export function showShiftHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">🕒 Shift Schedule</div>

      <p class="help-desc">
        Manage staff shifts and assignments across your marina. Keep track of who is working, when, and where.
      </p>

      <div class="help-section-title">Shift Types</div>
      <div class="help-cat-grid">
        <div class="help-cat">🌅 Morning</div>
        <div class="help-cat">☀️ Afternoon</div>
        <div class="help-cat">🌙 Night</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">Staff Roles</div>
      <div class="help-cat-grid">
        <div class="help-cat">🪝 Dockhand</div>
        <div class="help-cat">📋 Office</div>
        <div class="help-cat">⛽ Fuel Dock</div>
        <div class="help-cat">🔧 Maintenance</div>
        <div class="help-cat">🛡️ Security</div>
        <div class="help-cat">👔 Manager</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">How to schedule a shift?</div>

      ${step('1', 'Select crew', 'Select a crew member from your list')}
      ${step('2', 'Shift type', 'Choose shift type (Morning / Afternoon / Night)')}
      ${step('3', 'Role', 'Assign a role (Dockhand, Office, Fuel Dock, etc.)')}
      ${step('4', 'Date', 'Pick the date for the shift')}
      ${step('5', 'Notes', 'Add notes (special instructions, location, etc.)')}

      <div class="help-divider"></div>

      <div class="help-section-title">💡 Pro Tips</div>
      <div class="help-tips">• Schedule morning shifts the day before

• Ensure night shifts have at least 2 staff members

• Use notes for specific boat assignments

• Review weekly schedule every Friday

• Keep a backup contact for each shift</div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="shHelpGotIt">Got it</button>
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