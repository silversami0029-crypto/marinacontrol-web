// js/screens/UserManagementHelp.js

export function showUserManagementHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">User Management</div>

      <p class="help-desc">
        Manage the people who can access your marina account and control the role assigned to each user.
      </p>

      <div class="help-section-title">How to manage users</div>

      ${step('1', 'Add users', 'Add users using the + Add User button. Enter their name, email, password and required role.')}
      ${step('2', 'Change role', 'Tap an existing user to change their role and adjust their level of access.')}
      ${step('3', 'Remove', 'Swipe a user left or right to remove them. You cannot delete your own account.')}
      ${step('4', 'Invite code', 'Use the Marina Invite Code when authorised users need to join the correct marina account. Tap Copy Code to copy it.')}

      <div class="help-divider"></div>

      <div class="help-section-title">User Roles</div>
      <div class="help-tips">• <b>Admin</b> — Full administrative access and user management.

• <b>Manager</b> — Management-level operational access.

• <b>Staff</b> — Day-to-day marina operational access.

• <b>Inspector</b> — Intended for inspection-related work.

• <b>Viewer</b> — Read-focused access.</div>

      <div class="help-note">
        <b>Important:</b> User Management is restricted to administrators. Only give access and invite codes to authorised marina personnel.
      </div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="userMgmtHelpGotIt">Got it</button>
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
  dialog.querySelector('#userMgmtHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}