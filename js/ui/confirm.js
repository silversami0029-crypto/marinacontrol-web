// js/ui/confirm.js
// Delete confirmation bottom sheet — mirrors bottomsheet_delete_boat_confirmation.xml

const WARN_ICON = `
<svg viewBox="0 0 24 24" width="24" height="24" fill="none"
     stroke="#FFFFFF" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 6h18"/>
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
  <line x1="10" y1="11" x2="10" y2="17"/>
  <line x1="14" y1="11" x2="14" y2="17"/>
</svg>`;

const TRASH_ICON = `
<svg viewBox="0 0 24 24" width="16" height="16" fill="none"
     stroke="#FFFFFF" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 6h18"/>
  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
</svg>`;

/**
 * Show a confirmation sheet.
 * @param {Object} opts
 * @param {string} opts.title       e.g. "Delete boat"
 * @param {string} opts.message     e.g. "This vessel will be permanently removed."
 * @param {string} [opts.confirmText='Delete']
 * @param {string} [opts.cancelText='Cancel']
 * @returns {Promise<boolean>}      true if confirmed, false if cancelled
 */
export function confirmSheet(opts) {
  const {
    title       = 'Are you sure?',
    message     = '',
    confirmText = 'Delete',
    cancelText  = 'Cancel',
    action = 'delete'
  } = opts;

  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-backdrop';

    const sheet = document.createElement('div');
    sheet.className = 'confirm-sheet';
    const archiveAction = action === 'archive' || action === 'restore';
    if (archiveAction) sheet.classList.add('confirm-sheet--archive');
    const actionIcon = archiveAction ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16v13H4zM3 3h18v5H3z"/><path d="${action === 'restore' ? 'M12 17v-6m-3 3 3-3 3 3' : 'M9 12h6'}"/></svg>` : null;
    sheet.innerHTML = `
      <div class="confirm-handle"></div>

      <div class="confirm-warn-circle">${actionIcon || WARN_ICON}</div>

      <div class="confirm-title">${escapeHtml(title)}</div>
      <div class="confirm-message">${escapeHtml(message)}</div>

      <div class="confirm-actions">
        <button class="confirm-btn confirm-btn--cancel" type="button">
          ${escapeHtml(cancelText)}
        </button>
        <button class="confirm-btn confirm-btn--confirm" type="button">
          ${actionIcon || TRASH_ICON}<span>${escapeHtml(confirmText)}</span>
        </button>
      </div>
    `;

    document.getElementById('modalRoot').append(backdrop, sheet);

    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });

    let settled = false;
    function close(result) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      backdrop.classList.remove('is-open');
      sheet.classList.remove('is-open');
      setTimeout(() => {
        backdrop.remove();
        sheet.remove();
      }, 220);
      resolve(result);
    }

    const onKey = event => { if (event.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', title);
    sheet.querySelector('.confirm-btn--cancel').focus();

    sheet.querySelector('.confirm-btn--cancel').addEventListener('click', () => close(false));
    sheet.querySelector('.confirm-btn--confirm').addEventListener('click', () => close(true));
    backdrop.addEventListener('click', () => close(false));
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}