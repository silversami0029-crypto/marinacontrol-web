import { italianUI as itUI } from '../i18n.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/DocumentHelp.js

export function showDocumentHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("📄 Documents")}</div>

      <p class="help-desc">${tr("Keep document records up to date and assign specific document jobs to your crew.")}</p>
      <div class="help-section-title">${tr("Responsibility, jobs and renewal")}</div>
      <p class="help-desc"><b>${tr("Set responsible person")}</b> — ${tr("Records who looks after this document. It does not create a job or send a Staff Work alert.")}</p>
      <p class="help-desc"><b>${tr("Assign work")}</b> — ${tr("Creates a job such as renewing insurance, obtaining a certificate or checking registration details. The linked Staff member receives the job and an in-app alert.")}</p>
      ${step('1', tr('Start from the document'), tr('Open its three-dot menu → Assign work, or open document details → Assign work / view tasks. The Assign work button inside Staff Work assigns existing tasks.'))}
      ${step('2', tr('Explain what needs doing'), tr('Enter a clear job title and instructions. For example: Renew insurance certificate; obtain the replacement and ask the manager to update the document record and expiry date.'))}
      ${step('3', tr('Choose linked crew'), tr('Choose a crew member with an active linked Staff sign-in. Set the optional due date and priority, then Assign work. If no linked account is available, use Staff Work → Crew account links first.'))}
      ${step('4', tr('Complete and submit'), tr('Staff open My Work, start the job, record updates or photo evidence, and submit for review with a completion note. Managers see the same job in Staff Work.'))}
      ${step('5', tr('Review and update the document'), tr('Managers review Staff Work → Awaiting review and approve or return the task. Use the document Edit action to update its details and Renew to update its expiry date. Approving a task does not renew a certificate, replace its file or change its expiry date automatically.'))}
      <p class="help-desc">${tr("Check Existing document work before creating the same job again. Staff Work provides the job instructions; it does not grant access to the document file.")}</p>
      <div class="help-divider"></div>
      <div class="help-section-title">${tr("Bulk import")}</div>
      <p class="help-desc">${tr("Import your boat documents in bulk using a CSV file.")}</p>

      <div class="help-section-title">${tr("How to import")}</div>

      ${step('1', itUI('Template'), itUI('Download the sample CSV template to see the correct format'))}
      ${step('2', itUI('Fill in'), itUI('Edit the CSV with your document details (name, type, expiry date, notes, file path)'))}
      ${step('3', itUI('Select'), itUI('Select the CSV file from your device to import'))}
      ${step('4', itUI('Confirm'), itUI('Review any errors and confirm the import'))}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("CSV Format Requirements")}</div>
      <div class="help-tips">${tr("• First row must be headers: Document Name, Document Type, Expiry Date, Notes, File Path • Document Type must match available types: Insurance Policy, Vessel Registration, Radio License, Safety Equipment Certificate, etc. • Expiry Date format: YYYY-MM-DD • File Path is optional (leave blank if no file)")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.co.uk")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="docHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#docHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}