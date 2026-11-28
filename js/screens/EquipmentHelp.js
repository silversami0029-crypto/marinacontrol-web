import { italianUI as itUI } from '../i18n.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
// js/screens/EquipmentHelp.js

export function showEquipmentHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">
      <div class="help-pill">${tr("⚙️ Equipment")}</div>

      <p class="help-desc">${tr("Keep equipment details together and assign specific jobs to your crew.")}</p>
      <div class="help-section-title">${tr("Responsible person or Assign work?")}</div>
      <p class="help-desc"><b>${tr("Set responsible person")}</b> — ${tr("Records who looks after the equipment. This alone does not create a Staff Work job or send an alert.")}</p>
      <p class="help-desc"><b>${tr("Assign work")}</b> — ${tr("Creates a specific job with instructions, a crew member and an optional due date. The linked Staff account receives the job and an in-app alert.")}</p>
      <div class="help-section-title">${tr("How to create and complete an equipment job")}</div>
      ${step('1', tr('Open the equipment menu'), tr('Select the three dots on the equipment record, then choose Assign work. You can also open View → Assign work / view tasks.'))}
      ${step('2', tr('Describe what needs doing'), tr('Use a clear title, such as Check galley unit power supply. In Instructions, explain what to check and what result to report.'))}
      ${step('3', tr('Choose the crew member'), tr('Select a crew member with a linked Staff sign-in. If none is available, open Staff Work → Crew account links first. Set a due date and priority if needed, then select Assign work.'))}
      ${step('4', tr('Staff carry out the job'), tr('The job appears in My Work for the assigned Staff member and in Staff Work for managers. Open it to read the instructions, start work, record an update or photo, and submit for review with a completion note.'))}
      ${step('5', tr('Manager reviews'), tr('Open Staff Work → Awaiting review. Read the updates and evidence, then approve or return the job for further work. Approval completes the task; equipment condition must be updated separately if it changes.'))}
      <p class="help-desc">${tr("The Assign work window inside Staff Work assigns existing tasks. Start a new equipment job from the equipment record. Check Existing equipment work before creating the same job again.")}</p>
      <div class="help-divider"></div>

      <div class="help-section-title">${tr("What can you track?")}</div>

      <div class="help-cat-grid">
        <div class="help-cat">${tr("⚙️ Engine")}</div>
        <div class="help-cat">${tr("🧭 Navigation")}</div>
        <div class="help-cat">${tr("📻 Communication")}</div>
        <div class="help-cat">${tr("🛟 Safety")}</div>
        <div class="help-cat">${tr("⚓ Ground Tackle")}</div>
        <div class="help-cat">${tr("🔋 Electrical")}</div>
        <div class="help-cat">${tr("🚽 Plumbing")}</div>
        <div class="help-cat">${tr("🌀 HVAC")}</div>
      </div>

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("How to add equipment?")}</div>

      ${step('1', itUI('Type'), itUI('Select equipment type (Engine, Navigation, Safety, etc.)'))}
      ${step('2', itUI('Manufacturer'), itUI('Enter manufacturer name (Yanmar, Garmin, Icom, etc.)'))}
      ${step('3', itUI('Location'), itUI('Specify location (Engine Room, Flybridge, Pilothouse, etc.)'))}
      ${step('4', itUI('Model'), itUI('Add model number (optional but recommended)'))}
      ${step('5', itUI('Notes'), itUI('Add notes (serial number, installation date, warranty info)'))}

      <div class="help-divider"></div>

      <div class="help-section-title">${tr("💡 Pro Tips")}</div>
      <div class="help-tips">${tr("• Include serial numbers for warranty claims • Take photos of equipment nameplates • Add purchase date and cost for insurance • Link Inventory records to each equipment • Update when equipment is serviced or replaced")}</div>

      <div class="help-footer">${tr("Need help? support@marinacontrol.co.uk")}</div>
    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="eqHelpGotIt">${tr("Got it")}</button>
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
  dialog.querySelector('#eqHelpGotIt').addEventListener('click', close);
}

function step(num, title, body) {
  return `
    <div class="help-step">
      <div class="help-step-num">${num}</div>
      <div class="help-step-text"><b>${title}</b> — ${body}</div>
    </div>
  `;
}