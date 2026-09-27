// js/screens/TaskHistorySheet.js
import { store } from '../store.js';
import {
  collection, query, where, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

export async function showTaskHistory(item) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet sheet--tall';

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title" style="text-align:center;">
      ${escapeHtml(item.title || 'Task')}
    </div>

    <div class="eq-hist-list" id="tkHistList">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>

    <button type="button" class="md-close-btn" id="tkHistClose">Close</button>
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
  sheet.querySelector('#tkHistClose').addEventListener('click', close);

  const clientId = Number(store.activeClientId);
  const boatId = Number(item.boatId);
  const itemId = Number(item.id);
  const listEl = sheet.querySelector('#tkHistList');

  if (!clientId || !itemId) {
    listEl.innerHTML = `<div class="eq-hist-empty">No history recorded yet</div>`;
    return;
  }

  try {
    const snap = await getDocs(query(
      collection(db, 'history'),
      where('clientId', '==', clientId),
      where('boatId', '==', boatId),
      where('entityType', '==', 'TASK'),
      where('entityId', '==', itemId)
    ));

    if (snap.empty) {
      listEl.innerHTML = `<div class="eq-hist-empty">No history recorded yet</div>`;
      return;
    }

    const rows = snap.docs
      .map(d => {
        const h = d.data();
        return {
          id: d.id,
          action: h.action || '',
          title: h.title || h.action || '',
          detail: h.detail || '',
          by: h.by || '',
          at: Number(h.at || 0)
        };
      })
      .sort((a, b) => b.at - a.at);

    listEl.innerHTML = rows.map(r => `
      <div class="eq-hist-row">
        <div class="eq-hist-dot"></div>
        <div class="eq-hist-info">
          <div class="eq-hist-action">${escapeHtml(r.title)}</div>
          ${r.detail ? `<div class="eq-hist-detail">${escapeHtml(r.detail)}</div>` : ''}
          <div class="eq-hist-meta">${escapeHtml(r.by)} · ${formatWhen(r.at)}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.warn('[task history] no history available', err?.code || err?.message || err);
    listEl.innerHTML = `<div class="eq-hist-empty">No history recorded yet</div>`;
  }
}

function formatWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return d.toLocaleDateString();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}