// js/components/HelpDialog.js
// Boat help modal — mirrors dialog_boat_help.xml

export function showBoatHelp() {
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'help-dialog';

  dialog.innerHTML = `
    <div class="help-scroll">

      <div class="help-pill">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 17h18M5 17V9l7-5 7 5v8M9 17v-5h6v5"/>
        </svg>
        <span>My Boats</span>
      </div>

      <p class="help-desc">
        Your Boats screen lists all boats linked to your account.
        Tap a boat to open it, or tap + to add a new one.
      </p>

      <h3 class="help-section-title">How to Add a New Boat</h3>

      <div class="help-step">
        <div class="help-step-num">1</div>
        <div class="help-step-text">Tap the + button.</div>
      </div>

      <div class="help-step">
        <div class="help-step-num">2</div>
        <div class="help-step-text">
          Enter the boat name and tap Save. Other details are optional
          and can be added later.
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">3</div>
        <div class="help-step-text">
          After saving, use the three-dot menu to add photos, voice notes,
          edit details or delete the boat.
        </div>
      </div>

      <div class="help-divider"></div>

      <h3 class="help-section-title">Tips</h3>

      <div class="help-tips">
        • Add as much boat information as possible<br>
        • Use the three-dot menu to manage:<br>
        &nbsp;&nbsp;&nbsp;&nbsp;→ Voice notes<br>
        &nbsp;&nbsp;&nbsp;&nbsp;→ Pictures<br>
        &nbsp;&nbsp;&nbsp;&nbsp;→ Boat details<br>
        &nbsp;&nbsp;&nbsp;&nbsp;→ Delete boat
      </div>

      <div class="help-divider"></div>

      <h3 class="help-section-title">Bulk import format</h3>

      <div class="help-tips">
        • The csv is comma seperated<br>
        &nbsp;Header: name,type,model,hin,mmsi,port,status<br>
        &nbsp;Data: Boat1,Sport,270,AB12,123456789,Monaco,Active
      </div>

      <div class="help-divider"></div>

      <div class="help-footer">
        Need help? support@marinacontrol.com
      </div>

    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="helpGotIt">Got it</button>
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
    setTimeout(() => { backdrop.remove(); dialog.remove(); }, 200);
  };

  backdrop.addEventListener('click', close);
  dialog.querySelector('#helpGotIt').addEventListener('click', close);

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}