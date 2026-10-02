// js/screens/TaskDetailSheet.js

const PRIORITY_COLORS = {
  OVERDUE:  '#EF4444',
  CRITICAL: '#DC2626',
  MEDIUM:   '#F59E0B',
  LOW:      '#10B981'
};

export function showTaskDetail(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const color = PRIORITY_COLORS[String(item.priority || '').toUpperCase()] || PRIORITY_COLORS.MEDIUM;
  const dueLabel = item.dueDate ? formatDate(item.dueDate) : '—';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">${escapeHtml(item.title || 'Task')}</div>

    <div class="md-body">
      <div class="md-line"><span class="md-label">Priority:</span> <span class="md-value" style="color:${color};font-weight:600;">${escapeHtml(item.priority || 'MEDIUM')}</span></div>
      <div class="md-line"><span class="md-label">Status:</span> <span class="md-value">${escapeHtml(item.status || 'OPEN')}</span></div>
      <div class="md-line"><span class="md-label">Boat:</span> <span class="md-value">${escapeHtml(item.boatName || '—')}</span></div>
      <div class="md-line"><span class="md-label">Category:</span> <span class="md-value">${escapeHtml(item.category || '—')}</span></div>
      <div class="md-line"><span class="md-label">Due:</span> <span class="md-value">${escapeHtml(dueLabel)}</span></div>
      ${item.assignedTo ? `<div class="md-line"><span class="md-label">Assigned To:</span> <span class="md-value">${escapeHtml(item.assignedTo)}</span></div>` : ''}
      ${item.notes ? `<div class="md-spacer"></div><div class="md-line"><span class="md-label">Notes:</span> <span class="md-value">${escapeHtml(item.notes)}</span></div>` : ''}
    </div>

    <button type="button" class="md-close-btn" id="tkDetailClose">Close</button>
  `;

  document.getElementById('modalRoot').append(backdrop, sheet);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };

  backdrop.addEventListener('click', close);
  sheet.querySelector('#tkDetailClose').addEventListener('click', close);
}

function formatDate(s) {
  try {
    const d = new Date(s + 'T00:00:00');
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return s; }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}