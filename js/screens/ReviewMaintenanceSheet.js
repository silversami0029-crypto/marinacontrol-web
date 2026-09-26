// js/screens/ReviewMaintenanceSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showReviewMaintenanceSheet(item, { onChanged } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const today = new Date().toISOString().slice(0, 10);

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">Deferred Review</div>

    <div class="add-scroll">
      <div class="rm-info">
        <div class="rm-info-line"><b>Task:</b> ${escapeHtml(item.type || '')}</div>
        <div class="rm-info-line"><b>Reason:</b> ${escapeHtml(item.deferReason || 'N/A')}</div>
        <div class="rm-info-line"><b>Review Date:</b> ${escapeHtml(item.reviewDate || 'N/A')}</div>
      </div>

      <div class="add-section-title">Choose Action</div>

      <label class="rm-radio">
        <input type="radio" name="rm-action" value="COMPLETED">
        <span>Complete Task</span>
      </label>
      <label class="rm-radio">
        <input type="radio" name="rm-action" value="EXTENDED">
        <span>Extend Deferral</span>
      </label>
      <label class="rm-radio">
        <input type="radio" name="rm-action" value="ESCALATED">
        <span>Escalate</span>
      </label>
      <label class="rm-radio">
        <input type="radio" name="rm-action" value="CANCELLED">
        <span style="color:#FF4444;">Cancel Deferral</span>
      </label>

      <div id="rmExtendBox" style="display:none; margin-top:8px;">
        <label class="add-label" for="rm-newdate">New Review Date</label>
        <input class="add-input" id="rm-newdate" type="date" value="${today}">
      </div>
    </div>

    <div class="csv-info-actions">
      <button type="button" class="csv-btn csv-btn--cancel" id="rmCancel">Cancel</button>
      <button type="button" class="csv-btn csv-btn--choose" id="rmConfirm">Confirm</button>
    </div>
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
  sheet.querySelector('#rmCancel').addEventListener('click', close);

  const extendBox = sheet.querySelector('#rmExtendBox');
  sheet.querySelectorAll('input[name="rm-action"]').forEach(r => {
    r.addEventListener('change', () => {
      extendBox.style.display = r.value === 'EXTENDED' && r.checked ? 'block' : 'none';
    });
  });

  sheet.querySelector('#rmConfirm').addEventListener('click', async () => {
    const checked = sheet.querySelector('input[name="rm-action"]:checked');
    if (!checked) {
      toast('Choose an action', { kind: 'error' });
      return;
    }

    const action = checked.value;
    const newDate = sheet.querySelector('#rm-newdate').value;

    if (action === 'EXTENDED' && !newDate) {
      toast('Select a new review date', { kind: 'error' });
      return;
    }

    close();
    await applyReview(item, action, newDate, onChanged);
  });
}

async function applyReview(item, action, newDate, onChanged) {
  try {
    const now = Date.now();
    const userId = String(store.userProfile?.userId || 0);

    const updates = {
      reviewStatus: action,
      lastModified: now,
      lastModifiedBy: userId
    };

    if (action === 'COMPLETED') {
      updates.completed = true;
      updates.status = 'COMPLETED';
    } else if (action === 'EXTENDED') {
      updates.reviewDate = newDate;
      updates.status = 'DEFERRED';
      updates.deferredAt = now;
    } else if (action === 'ESCALATED') {
      updates.status = 'ESCALATED';
    } else if (action === 'CANCELLED') {
      updates.status = 'ACTIVE';
      updates.deferReason = null;
      updates.riskLevel = null;
      updates.mitigation = null;
      updates.reviewDate = null;
      updates.deferredBy = null;
      updates.deferredAt = 0;
    }

    await updateDoc(doc(db, 'maintenance', String(item._docId)), updates);

    const labels = {
      COMPLETED: 'Completed',
      EXTENDED: 'Deferral extended',
      ESCALATED: 'Escalated',
      CANCELLED: 'Deferral cancelled'
    };
    toast(labels[action] || 'Updated', { kind: 'success' });
    if (onChanged) onChanged();
  } catch (err) {
    console.error('[review] failed', err);
    toast('Failed to review', { kind: 'error' });
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}