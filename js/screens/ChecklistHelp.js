import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/ChecklistHelp.js

export function showChecklistHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("📋 Checklists")}</div>

      <p class="help-desc">${tr("View completion status of all checklists across your boats. Checklists are created and completed in the Android app — the web view is for management oversight.")}</p>

      <div class="help-section-title">${tr("What you can see")}</div>

      ${step('1', 'Progress', 'How many items are complete out of the total')}
      ${step('2', 'Results', 'Items passed vs. items that failed')}
      ${step('3', 'Who completed', 'Name of the crew member who finished the checklist')}
      ${step('4', 'Item detail', 'Tap a checklist to see the individual items and their results')}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("Status")}</div>
      <div class="help-tips">• <b>${tr("Pending")}</b>${tr("— checklist created, not yet started •")}<b>${tr("In Progress")}</b>${tr("— some items completed •")}<b>${tr("Completed")}</b>${tr("— all items processed")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.com")}</div>
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

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}