// js/components/BerthHelpDialog.js
// Berth help modal — mirrors dialog_berth_help.xml

export function showBerthHelp() {
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
          <path d="M3 8h18M3 12h18M3 16h18M5 8v12M19 8v12"/>
        </svg>
        <span>Berths</span>
      </div>

      <p class="help-desc">
        Manage your marina berths — Dock Walk, assign boats, track occupancy,
        and maintain berth details.
      </p>

      <div class="help-step">
        <div class="help-step-num">1</div>
        <div class="help-step-text">
          Tap any berth to view options (assign boat, edit, delete, change status).
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">2</div>
        <div class="help-step-text">
          Long press a berth to quickly assign or release a boat.
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">3</div>
        <div class="help-step-text">
          Use the three-dot menu on each berth to edit, delete, or view details.
        </div>
      </div>

      <div class="help-step">
        <div class="help-step-num">4</div>
        <div class="help-step-text">
          Use the toolbar menu to start Dock Walk, import CSV, reset to default
          berths, or delete all berths.
        </div>
      </div>

      <div class="help-divider"></div>

      <h3 class="help-section-title">Tips</h3>

      <div class="help-tips">
        • Berth status colors:<br>
        &nbsp;&nbsp;&nbsp;&nbsp;🟢 Available<br>
        &nbsp;&nbsp;&nbsp;&nbsp;🔴 Occupied<br>
        &nbsp;&nbsp;&nbsp;&nbsp;🟠 Under Maintenance<br>
        • CSV import requires:<br>
        &nbsp;&nbsp;&nbsp;&nbsp;Dock Name, Berth Number<br>
        &nbsp;&nbsp;&nbsp;&nbsp;Length, Width, Depth<br>
        &nbsp;&nbsp;&nbsp;&nbsp;Has Electric, Has Water, Status
      </div>

      <div class="help-divider"></div>

      <div class="help-footer">
        Need help? support@marinacontrol.com
      </div>

    </div>

    <div class="help-actions">
      <button type="button" class="help-gotit" id="berthHelpGotIt">Got it</button>
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
  dialog.querySelector('#berthHelpGotIt').addEventListener('click', close);

  const onKey = (e) => {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}