// js/screens/ChecklistScreen.js
import { store } from '../store.js';
import { showChecklistDetail } from './ChecklistDetailSheet.js';
import { showChecklistHelp } from './ChecklistHelp.js';
import {
  //collection, query, where, onSnapshot, getDocs
collection, query, where, onSnapshot

} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from '../firebase.js';

//let unsubscribe = null;
let unsubscribeChecklists = null;
let unsubscribeBoats = null;
let currentItems = [];
let currentBoats = [];
let isSearchOpen = false;
let filterMode = 'ALL';
let boatFilter = 0;

const STATUS_COLORS = {
  COMPLETED: '#4CAF50',
  IN_PROGRESS: '#FF9800',
  PENDING: '#2196F3',
  CANCELLED: '#737D89'
};

export function mountChecklistScreen() {
  const screen = document.getElementById('screen');
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const urlBoatId = Number(params.get('boatId') || 0);

  if (unsubscribeChecklists) {
  unsubscribeChecklists();
  unsubscribeChecklists = null;
}

if (unsubscribeBoats) {
  unsubscribeBoats();
  unsubscribeBoats = null;
}

  currentItems = [];
  currentBoats = [];
  filterMode = 'ALL';
  boatFilter = urlBoatId;
  isSearchOpen = false;

  screen.innerHTML = `
    <div class="eq-header" id="chHeader">
      <div class="eq-header-row">
        <button class="eq-icon-btn" id="chBack" aria-label="Back">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div class="eq-pill">Checklists</div>

        <button class="eq-icon-btn" id="chHelp" aria-label="Help">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <line x1="12" y1="11" x2="12" y2="16"/>
            <circle cx="12" cy="7.5" r="0.8" fill="currentColor"/>
          </svg>
        </button>

        <div class="eq-header-spacer"></div>

        <button class="eq-icon-btn" id="chSearchToggle" aria-label="Search">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="16.5" y1="16.5" x2="21" y2="21"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="boats-search-bar" id="chSearchBar" hidden>
      <input id="chSearchInput" type="text"
             placeholder="Search checklists..." autocomplete="off">
      <button type="button" class="search-cancel"
              id="chSearchCancel">Cancel</button>
    </div>

    <div class="ch-filters-row">
      <div class="dash-filters" id="chFilters">
        <button type="button" class="dash-filter is-active"
                data-ch-filter="ALL">All</button>
        <button type="button" class="dash-filter"
                data-ch-filter="IN_PROGRESS">In Progress</button>
        <button type="button" class="dash-filter"
                data-ch-filter="COMPLETED">Completed</button>
      </div>

      <select class="ch-boat-select" id="chBoatSelect">
        <option value="0">All boats</option>
      </select>
    </div>

    <div class="eq-list" id="chList">
      <div class="boats-loading">
        <div class="spinner-ring"></div>
      </div>
    </div>
  `;

 /* back arrow*/

 document.getElementById('chBack')?.addEventListener('click', () => history.back());

  document.getElementById('chHelp')
    ?.addEventListener('click', showChecklistHelp);

  document.getElementById('chSearchToggle')
    .addEventListener('click', () => {
      isSearchOpen = true;
      document.getElementById('chHeader').hidden = true;
      document.getElementById('chSearchBar').hidden = false;
      document.getElementById('chSearchInput').focus();
    });

  document.getElementById('chSearchCancel')
    .addEventListener('click', () => {
      isSearchOpen = false;
      document.getElementById('chSearchBar').hidden = true;
      document.getElementById('chHeader').hidden = false;
      document.getElementById('chSearchInput').value = '';
      renderList();
    });

  document.getElementById('chSearchInput')
    .addEventListener('input', renderList);

  screen.querySelectorAll('[data-ch-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterMode = btn.dataset.chFilter;

      screen.querySelectorAll('[data-ch-filter]').forEach(button => {
        button.classList.toggle(
          'is-active',
          button.dataset.chFilter === filterMode
        );
      });

      renderList();
    });
  });

  document.getElementById('chBoatSelect')
    .addEventListener('change', event => {
      boatFilter = Number(event.target.value) || 0;
      renderList();
    });

  subscribeToBoats();
subscribeToChecklists();
}

function subscribeToBoats() {
  const clientId = Number(store.activeClientId);
  if (!clientId) return;

  const boatQuery = query(
    collection(db, 'boats'),
    where('clientId', '==', clientId)
  );

  unsubscribeBoats = onSnapshot(boatQuery, snapshot => {
    currentBoats = snapshot.docs.map(document => {
      const data = document.data();

      return {
        id: Number(data.id || 0),
        name: data.name || data.boatName || `Boat ${data.id || ''}`
      };
    }).filter(boat => boat.id > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    populateBoatDropdown();
    renderList();
  }, error => {
    console.error('[checklist] boats listener failed', error);
  });
}

function subscribeToChecklists() {
  const clientId = Number(store.activeClientId);

  if (!clientId) {
    document.getElementById('chList').innerHTML =
      `<div class="boats-empty"><h2>No client assigned</h2></div>`;
    return;
  }

  const checklistQuery = query(
    collection(db, 'checklists'),
    where('clientId', '==', clientId)
  );

  unsubscribeChecklists = onSnapshot(
    checklistQuery,
    snapshot => {
      currentItems = snapshot.docs
        .map(document => {
          const data = document.data();

          return {
            _docId: document.id,
            id: Number(data.id || 0),
            clientId: Number(data.clientId || 0),
            boatId: Number(data.boatId || 0),
            name: data.name || '',
            type: data.type || '',
            status: (data.status || 'PENDING').toUpperCase(),
            totalItems: Number(data.totalItems || 0),
            completedItems: Number(data.completedItems || 0),
            passedItems: Number(data.passedItems || 0),
            failedItems: Number(data.failedItems || 0),
            photoCount: Number(data.photoCount || 0),
            maintenanceCreated: Number(
              data.maintenanceCreated || 0
            ),
            notes: data.notes || '',
            completedAt: Number(data.completedAt || 0),
            completedBy: data.completedBy || '',
            createdAt: Number(data.createdAt || 0)
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

     
      renderList();
    },
    error => {
      console.error('[checklist] listen failed', error);

      document.getElementById('chList').innerHTML = `
        <div class="boats-empty">
          <h2>Couldn't load checklists</h2>
          <p>${escapeHtml(
            error.message || 'Permission denied.'
          )}</p>
        </div>
      `;
    }
  );
}

function populateBoatDropdown() {
  const select = document.getElementById('chBoatSelect');
  if (!select) return;

  const previousValue = String(boatFilter || 0);

  select.innerHTML =
    '<option value="0">All boats</option>' +
    currentBoats.map(boat =>
      `<option value="${boat.id}">${escapeHtml(boat.name)}</option>`
    ).join('');

  if (currentBoats.some(boat => String(boat.id) === previousValue)) {
    select.value = previousValue;
  } else {
    boatFilter = 0;
    select.value = '0';
  }
}

function getVisible() {
  const searchText = (
    document.getElementById('chSearchInput')?.value || ''
  ).trim().toLowerCase();

  let list = currentItems;

  if (filterMode === 'IN_PROGRESS') {
    list = list.filter(
      checklist => checklist.status === 'IN_PROGRESS'
    );
  }

  if (filterMode === 'COMPLETED') {
    list = list.filter(
      checklist => checklist.status === 'COMPLETED'
    );
  }

  if (boatFilter > 0) {
    list = list.filter(
      checklist =>
        Number(checklist.boatId) === Number(boatFilter)
    );
  }

  if (searchText) {
    list = list.filter(checklist =>
      checklist.name.toLowerCase().includes(searchText) ||
      checklist.type.toLowerCase().includes(searchText) ||
      checklist.completedBy.toLowerCase().includes(searchText) ||
      getBoatName(checklist.boatId)
        .toLowerCase()
        .includes(searchText)
    );
  }

  return list;
}

function renderList() {
  const listElement = document.getElementById('chList');
  if (!listElement) return;

  const items = getVisible();

  if (!items.length) {
    const searchText = (
      document.getElementById('chSearchInput')?.value || ''
    ).trim();

    let message = 'No checklists';

    if (searchText) {
      message =
        `No checklists match "${escapeHtml(searchText)}"`;
    } else if (boatFilter > 0) {
      message = 'No checklists for this boat';
    } else if (filterMode === 'IN_PROGRESS') {
      message = 'No checklists in progress';
    } else if (filterMode === 'COMPLETED') {
      message = 'No completed checklists';
    }

    listElement.innerHTML = `
      <div class="boats-empty">
        <h2>${message}</h2>
      </div>
    `;
    return;
  }

  listElement.innerHTML = items
    .map(checklist => {
      const percentage = checklist.totalItems > 0
        ? Math.round(
            checklist.completedItems /
            checklist.totalItems *
            100
          )
        : 0;

      const statusColor =
        STATUS_COLORS[checklist.status] || '#737D89';

      const boatName = getBoatName(checklist.boatId);

      return `
        <div class="chk-row"
             data-chk-id="${checklist._docId}">
          <div class="chk-info">
            <div class="chk-line-1">
              <div class="chk-name">
                ${escapeHtml(
                  checklist.name || 'Untitled'
                )}
              </div>

              <div class="chk-status"
                   style="background:${statusColor};">
                ${escapeHtml(
                  checklist.status.replaceAll('_', ' ')
                )}
              </div>
            </div>

            <div class="chk-boat">
              ${
                boatName
                  ? `🚤 ${escapeHtml(boatName)}`
                  : '<span style="opacity:.5;">No boat</span>'
              }
            </div>

            <div class="chk-meta">
              ${escapeHtml(checklist.type)}
            </div>

            <div class="chk-progress">
              <div class="chk-progress-bar">
                <div class="chk-progress-fill"
                     style="width:${percentage}%;"></div>
              </div>

              <div class="chk-progress-label">
                ${checklist.completedItems}/${checklist.totalItems}
              </div>
            </div>

            <div class="chk-counters">
              <span class="chk-counter chk-passed">
                ✓ ${checklist.passedItems} passed
              </span>

              ${
                checklist.failedItems > 0
                  ? `
                    <span class="chk-counter chk-failed">
                      ✗ ${checklist.failedItems} failed
                    </span>
                  `
                  : ''
              }

              ${
                checklist.photoCount > 0
                  ? `
                    <span class="chk-counter">
                      📷 ${checklist.photoCount}
                    </span>
                  `
                  : ''
              }
            </div>

            ${
              checklist.completedBy
                ? `
                  <div class="chk-meta2">
                    Completed by
                    ${escapeHtml(checklist.completedBy)}
                  </div>
                `
                : ''
            }
          </div>

          <div class="eq-row-divider"></div>
        </div>
      `;
    })
    .join('');

  listElement.querySelectorAll('.chk-row').forEach(row => {
    const checklist = items.find(
      item => item._docId === row.dataset.chkId
    );

    if (!checklist) return;

    row.addEventListener('click', () => {
      showChecklistDetail(checklist);
    });
  });
}

function getBoatName(boatId) {
  const boat = currentBoats.find(
    item => Number(item.id) === Number(boatId)
  );

  return boat?.name || '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]
  );
}