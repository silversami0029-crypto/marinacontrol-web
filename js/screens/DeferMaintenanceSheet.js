// js/screens/DeferMaintenanceSheet.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export function showDeferMaintenanceSheet(item, { onChanged } = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet';

  const isEditing = item.status === 'DEFERRED';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">
      ${isEditing ? 'Update Deferral' : 'Defer Maintenance'}
    </div>

    <form id="dfForm" class="add-form" novalidate>
      <div class="add-scroll">
        <label class="add-label" for="df-reason">Reason</label>
        <select class="add-input add-select" id="df-reason">
          <option value="Awaiting Parts">Awaiting Parts</option>
          <option value="Weather">Weather</option>
          <option value="Budget">Budget</option>
          <option value="Crew Availability">Crew Availability</option>
          <option value="Berth Occupied">Berth Occupied</option>
          <option value="Owner Request">Owner Request</option>
          <option value="Other">Other</option>
        </select>

        <label class="add-label" for="df-risk">Risk Level</label>
        <select class="add-input add-select" id="df-risk">
          <option value="Low">Low</option>
          <option value="Medium" selected>Medium</option>
          <option value="High">High</option>
        </select>

        <label class="add-label" for="df-mitigation">Mitigation</label>
        <textarea class="add-input" id="df-mitigation" rows="3"
                  placeholder="What is being done to manage the risk in the meantime?"></textarea>

        <label class="add-label" for="df-review">Review Date</label>
        <input class="add-input" id="df-review" type="date">
      </div>

      <button type="submit" class="add-save" id="df-save">Defer Task</button>
    </form>
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

  if (isEditing) {
    sheet.querySelector('#df-reason').value = item.deferReason || 'Other';
    sheet.querySelector('#df-risk').value = item.riskLevel || 'Medium';
    sheet.querySelector('#df-mitigation').value = item.mitigation || '';
    sheet.querySelector('#df-review').value = item.reviewDate || '';
    sheet.querySelector('#df-save').textContent = 'Update Deferral';
  } else {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    sheet.querySelector('#df-review').value = d.toISOString().slice(0, 10);
  }

  const form = sheet.querySelector('#dfForm');
  const save = sheet.querySelector('#df-save');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const reason     = sheet.querySelector('#df-reason').value;
    const riskLevel  = sheet.querySelector('#df-risk').value;
    const mitigation = sheet.querySelector('#df-mitigation').value.trim();
    const reviewDate = sheet.querySelector('#df-review').value;

    if (!reviewDate) {
      toast('Select a review date', { kind: 'error' });
      return;
    }

    save.disabled = true;
    save.textContent = 'Saving…';

    try {
      const now = Date.now();
      const userName = store.userProfile?.name || String(store.userProfile?.userId || '');
      const userId   = String(store.userProfile?.userId || 0);

      await updateDoc(doc(db, 'maintenance', String(item._docId)), {
        status: 'DEFERRED',
        completed: false,
        deferReason: reason,
        riskLevel,
        mitigation,
        reviewDate,
        deferredBy: userName,
        deferredAt: now,
        lastModified: now,
        lastModifiedBy: userId
      });

      close();
      toast(isEditing ? 'Deferral updated' : 'Task deferred', { kind: 'success' });
      if (onChanged) onChanged();
    } catch (err) {
      console.error('[defer] failed', err);
      save.disabled = false;
      save.textContent = isEditing ? 'Update Deferral' : 'Defer Task';
      toast('Failed to defer', { kind: 'error' });
    }
  });
}