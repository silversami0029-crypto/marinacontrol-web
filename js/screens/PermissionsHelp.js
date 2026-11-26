import { italianUI as itUI } from '../i18n.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/PermissionsHelp.js

export function showPermissionsHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("Crew Roles")}</div>
      <p class="help-desc">${tr("Crew job roles describe what a person does, such as Dock Master, Technician, Captain or Engineer. They do not grant access to MarinaControl.")}</p>
      <div class="help-section-title">${tr("Assign a job role")}</div>
      ${step('1', tr('Choose a crew member'), tr('Find their name in Crew Roles.'))}
      ${step('2', tr('Select their job role'), tr('Choose the job they actually perform. Leave it unset if you do not know.'))}
      <div class="help-divider"></div>
      <p class="help-desc">${tr("Previous labels such as Admin are shown for review. They are not automatically changed into job titles.")}</p>
      <div class="help-section-title">${tr("Sign-in permissions")}</div>
      <p class="help-desc">${tr("An administrator manages sign-in accounts and access roles in User Management. A crew record does not automatically create a sign-in account, even when the email addresses match.")}</p>
      <div class="help-footer">${tr("Need help? support@marinacontrol.co.uk")}</div>
    </div>
    <div class="help-actions"><button type="button" class="help-gotit" id="pmHelpGotIt">${tr("Got it")}</button></div>
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