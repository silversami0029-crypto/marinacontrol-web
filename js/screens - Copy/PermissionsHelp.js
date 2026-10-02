// js/screens/PermissionsHelp.js

export function showPermissionsHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">🔐 Permissions &amp; Roles</div>

      <p class="help-desc">
        Control what each crew member can see and do in the app. Assign roles to manage access levels.
      </p>

      <div class="help-section-title">Available Roles</div>

      <div class="pm-help-roles">
        <div class="pm-help-role">
          <div class="pm-help-role-name">👑 Admin</div>
          <div class="pm-help-role-body">Full access. Can add/remove crew, manage all settings, view all data, assign roles.</div>
        </div>

        <div class="pm-help-role">
          <div class="pm-help-role-name">👤 Staff</div>
          <div class="pm-help-role-body">Standard access. Can view and edit assigned tasks, complete checklists, add photos.</div>
        </div>

        <div class="pm-help-role">
          <div class="pm-help-role-name">🔍 Inspector</div>
          <div class="pm-help-role-body">Safety &amp; compliance focus. Can view all data, complete safety checklists, add inspection notes.</div>
        </div>

        <div class="pm-help-role">
          <div class="pm-help-role-name">👁️ View Only</div>
          <div class="pm-help-role-body">Read-only access. Can view information but cannot edit or delete anything.</div>
        </div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">How to assign a role?</div>

      ${step('1', 'Crew Management', 'Go to Crew Management screen')}
      ${step('2', 'Role dropdown', "Tap on the crew member's role dropdown")}
      ${step('3', 'Select', 'Select the new role from the list (Admin, Staff, Inspector, View Only)')}

      <div class="help-divider"></div>

      <div class="help-section-title">💡 Pro Tips</div>
      <div class="help-tips">• Only Admins can assign or change roles

• Staff can complete tasks but cannot change system settings

• Inspectors are ideal for safety compliance audits

• View Only is best for owners or external auditors

• Review roles quarterly as team responsibilities change</div>

      <div class="help-footer">Need help? support@marinacontrol.com</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="pmHelpGotIt">Got it</button>
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
  dialog.querySelector('#pmHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}