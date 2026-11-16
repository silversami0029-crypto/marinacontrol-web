import { t as tr } from '../i18n.js';

export function showChecklistHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog ot-help-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'checklistHelpTitle');

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill" id="checklistHelpTitle">${tr("Checklists")}</div>

      <p class="help-desc">${tr("Create and run boat checklists, track progress, and review completed checks.")}</p>

      <div class="help-section-title">${tr("Add Checklist")}</div>
      <p class="help-desc">${tr("Select + if you have permission to edit checklists.")}</p>
      ${entry(tr('Use App Template'), tr('Start with an editable departure checklist.'))}
      ${entry(tr('Import My Own'), tr('Upload a CSV or JSON file with your own checklist items.'))}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("Available Checklist Types")}</div>
      ${entry(tr('Departure'), tr('Pre-departure safety checks'))}
      ${entry(tr('Inventory'), tr('Equipment and supplies checks'))}
      ${entry(tr('Safety'), tr('Safety equipment inspections'))}
      ${entry(tr('Maintenance'), tr('Routine service checks'))}
      ${entry(tr('Custom'), tr('Checks tailored to your boat'))}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to use checklists")}</div>
      ${entry(tr('Results'), tr('Open a checklist and mark each item Pass or Fail.'))}
      ${entry(tr('Save progress'), tr('Save your results and return to the checklist later.'))}
      ${entry(tr('Complete checklist'), tr('Record a result for every mandatory item before completing.'))}
      ${entry(tr('History'), tr('Review completed checklists, their results, and who completed them.'))}

      <div class="help-footer">${tr("Need help? support@marinacontrol.co.uk")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="chkHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#chkHelpGotIt').addEventListener('click', close);
}

function entry(title, body) {
  return `
    <div class="help-step">
      <div class="help-step-text"><b>${title}</b><span>${body}</span></div>
    </div>
  `;
}
