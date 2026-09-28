// js/screens/ShiftScheduleScreen.js
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { showShiftHelp } from './ShiftHelp.js';
import { showShiftAssignSheet } from './ShiftAssignSheet.js';
import { confirmSheet } from '../ui/confirm.js';
import {
  collection, query, where, onSnapshot, getDocs, deleteDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

const ROLES = ['Dockhand', 'Office', 'Fuel Dock', 'Maintenance', 'Security', 'Manager'];
const SHIFT_TYPES = ['Morning', 'Afternoon', 'Night'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let unsubscribe = null;
let currentAssignments = [];
let weekStart = null;   // Date (Mon 00:00 local)
let crewCache = [];     // [{id, name, role}]

export async function mountShiftScheduleScreen() {
  const screen = document.getElementById('screen');

  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  currentAssignments = [];
  weekStart = getMonday(new Date());

  screen.innerHTML = `
    <div class="eq-header" id="shHeader">
      <div class="eq-header-row">
        <button class="eq-icon-btn" id="shBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="eq-pill">Shift Schedule</div>
        <button class="eq-icon-btn" id="shHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>
        <div class="eq-header-spacer"></div>
      </div>
    </div>

    <div class="sh-weeknav">
      <button class="sh-nav-btn" id="shPrev" aria-label="Previous week">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="sh-week-label" id="shWeekLabel"></div>
      <button class="sh-nav-btn" id="shNext" aria-label="Next week">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
      <button class="sh-nav-btn sh-today-btn" id="shToday" aria-label="Today">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
             stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
        </svg>
      </button>
    </div>

    <div class="sh-day-head">
      ${DAY_LABELS.map(d => `<div class="sh-day-head-cell">${d}</div>`).join('')}
    </div>

    <div class="sh-body" id="shBody">
      <div class="boats-loading"><div class="spinner-ring"></div></div>
    </div>
  `;

  document.getElementById('shBack').addEventListener('click', () => {
    location.hash = '#/boats';
  });

  const helpBtn = document.getElementById('shHelp');
  if (helpBtn) helpBtn.addEventListener('click', showShiftHelp);

  document.getElementById('shPrev').addEventListener('click', () => {
    weekStart.setDate(weekStart.getDate() - 7);
    refreshWeek();
  });
  document.getElementById('shNext').addEventListener('click', () => {
    weekStart.setDate(weekStart.getDate() + 7);
    refreshWeek();
  });
  document.getElementById('shToday').addEventListener('click', () => {
    weekStart = getMonday(new Date());
    refreshWeek();
  });

  // Load crew once
  try {
    const clientId = Number(store.activeClientId);
    const crewSnap = await getDocs(query(
      collection(db, 'crew'),
      where('clientId', '==', clientId)
    ));
    crewCache = crewSnap.docs
      .map(d => {
        const data = d.data();
        return {
          _docId: d.id,
          id: Number(data.id || 0),
          name: data.name || '',
          role: data.role || ''
        };
      })
      .filter(c => c.name && c.name.trim());
  } catch (err) {
    console.error('[shift] crew load failed', err);
  }

  subscribeToShifts();
  refreshWeek();
}

function getMonday(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();          // 0 = Sun
  const diff = (day === 0) ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function refreshWeek() {
  document.getElementById('shWeekLabel').textContent = formatWeekLabel();
  renderGrid();
}

function formatWeekLabel() {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-GB', fmt)} – ${end.toLocaleDateString('en-GB', fmt)}`;
}

function subscribeToShifts() {
  const clientId = Number(store.activeClientId);
  if (!clientId) return;

  const q = query(
    collection(db, 'shift_assignments'),
    where('clientId', '==', clientId)
  );

  unsubscribe = onSnapshot(q, (snap) => {
    currentAssignments = snap.docs.map(d => {
      const data = d.data();
      return {
        _docId: d.id,
        id: Number(data.id || 0),
        clientId: Number(data.clientId || 0),
        crewId: data.crewId != null ? Number(data.crewId) : null,
        crewName: data.crewName || '',
        date: Number(data.date || 0),
        shiftType: data.shiftType || '',
        role: data.role || '',
        notes: data.notes || '',
        createdAt: Number(data.createdAt || 0),
        updatedAt: Number(data.updatedAt || 0)
      };
    });
    renderGrid();
  }, (err) => {
    console.error('[shift] listen failed', err);
    const body = document.getElementById('shBody');
    if (body) {
      body.innerHTML = `<div class="boats-empty"><h2>Couldn't load shifts</h2><p>${escapeHtml(err.message || 'Permission denied.')}</p></div>`;
    }
  });
}

function renderGrid() {
  const body = document.getElementById('shBody');
  if (!body) return;

  const dayTimestamps = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dayTimestamps.push(startOfDay(d));
  }

  const rows = SHIFT_TYPES.map(shiftType => {
    const cells = dayTimestamps.map(ts => {
      const assignment = currentAssignments.find(a =>
        Number(a.date) === ts && a.shiftType === shiftType
      );
      if (assignment) {
        return `
          <button class="sh-cell is-assigned" data-ts="${ts}" data-shift="${shiftType}">
            <div class="sh-cell-name">${escapeHtml(assignment.crewName || '—')}</div>
            <div class="sh-cell-role">(${escapeHtml(assignment.role || '')})</div>
          </button>
        `;
      }
      return `
        <button class="sh-cell" data-ts="${ts}" data-shift="${shiftType}">
          <span class="sh-cell-empty">—</span>
        </button>
      `;
    }).join('');

    return `
      <div class="sh-row-wrap">
        <div class="sh-row-title">${shiftType}</div>
        <div class="sh-row">${cells}</div>
      </div>
    `;
  }).join('');

  body.innerHTML = `
    ${rows}
    <div class="sh-legend">
      <span class="sh-legend-swatch is-assigned"></span>
      <span class="sh-legend-label">Assigned</span>
      <span class="sh-legend-swatch"></span>
      <span class="sh-legend-label">Unassigned</span>
    </div>
  `;

  body.querySelectorAll('.sh-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const ts = Number(cell.dataset.ts);
      const shiftType = cell.dataset.shift;
      const existing = currentAssignments.find(a =>
        Number(a.date) === ts && a.shiftType === shiftType
      );
      openCell(ts, shiftType, existing);
    });
  });
}

async function openCell(ts, shiftType, existing) {
  if (existing) {
    const choice = await showCellMenu(existing, shiftType, ts);
    if (choice === 'change') {
      showShiftAssignSheet({
        date: ts,
        shiftType,
        crewList: crewCache,
        existing
      });
    } else if (choice === 'remove') {
      try {
        await deleteDoc(doc(db, 'shift_assignments', String(existing._docId)));
        toast('Assignment removed', { kind: 'success' });
      } catch (err) {
        console.error('[shift] remove failed', err);
        toast('Failed to remove', { kind: 'error' });
      }
    }
  } else {
    showShiftAssignSheet({
      date: ts,
      shiftType,
      crewList: crewCache
    });
  }
}

function showCellMenu(existing, shiftType, ts) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';

    const sheet = document.createElement('div');
    sheet.className = 'sheet';

    const dateLabel = new Date(ts).toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short'
    });

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-title" style="text-align:center;">${shiftType} · ${dateLabel}</div>

      <div class="sheet-item" id="shCellChange">
        <div class="sheet-item-icon">
          <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>
          </svg>
        </div>
        <div class="sheet-item-text"><div class="sheet-item-title">Change Assignment</div></div>
      </div>
      <div class="sheet-gap-8"></div>

      <div class="sheet-item sheet-item--danger" id="shCellRemove">
        <div class="sheet-item-icon">
          <svg class="sheet-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>
          </svg>
        </div>
        <div class="sheet-item-text"><div class="sheet-item-title">Remove Assignment</div></div>
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

    backdrop.addEventListener('click', () => { close(); resolve(null); });
    sheet.querySelector('#shCellChange').addEventListener('click', () => { close(); resolve('change'); });
    sheet.querySelector('#shCellRemove').addEventListener('click', () => { close(); resolve('remove'); });
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}