// js/screens/DashboardScreen.js
// Portfolio Dashboard — mirrors PortfolioDashboardFragment.java

import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { getMyMarinas, getMarinaStats } from '../db.js';

let allMarinas = [];
let selectedCountry = null;
let selectedMarinaId = -1;

export async function mountDashboardScreen() {
  const screen = document.getElementById('screen');

  screen.innerHTML = `
    <div class="pf-wrap">
      <div class="pf-heading">PORTFOLIO OVERVIEW</div>
      <div class="pf-context" id="pfContext">Loading…</div>
      <div class="pf-divider"></div>

      <div class="pf-filters">
        <div class="pf-filter-col">
          <div class="pf-filter-label">Country</div>
          <button class="pf-filter-btn" id="pfCountryBtn">
            <span id="pfCountryText">All countries</span>
            <span class="pf-caret">⌄</span>
          </button>
        </div>

        <div class="pf-filter-col">
          <div class="pf-filter-label">Marina</div>
          <button class="pf-filter-btn" id="pfMarinaBtn">
            <span id="pfMarinaText">All marinas</span>
            <span class="pf-caret">⌄</span>
          </button>
        </div>
      </div>

      <div class="pf-card pf-card--big">
        <div class="pf-card-label">Berths occupied</div>
        <div class="pf-card-value" id="pfBerthsValue">0 / 0</div>
        <div class="pf-card-sub" id="pfBerthsSub">
          0% portfolio occupancy
        </div>

        <div class="pf-progress-track">
          <div
            class="pf-progress-fill"
            id="pfProgress"
            style="width: 0%">
          </div>
        </div>
      </div>

      <div class="pf-row-2">
        <div class="pf-card" id="pfTasksCard">
          <div class="pf-card-label">Open tasks</div>
          <div class="pf-card-value-sm" id="pfTasksValue">0</div>
          <div class="pf-card-sub" id="pfTasksSub">0 overdue</div>
        </div>

        <div class="pf-card" id="pfDockCard">
          <div class="pf-card-label">Dock Walk</div>
          <div class="pf-card-value-sm" id="pfDockValue">0</div>
          <div class="pf-card-sub">issues found</div>
        </div>
      </div>

      <div class="pf-comparison-head">
        <div class="pf-comparison-title">Marina comparison</div>
        <div class="pf-comparison-hint">Highest attention first</div>
      </div>

      <div class="pf-comparison-cols">
        <div class="pf-col-marina">Marina</div>
        <div class="pf-col-occ">Occupancy</div>
        <div class="pf-col-issues">Issues</div>
      </div>

      <div class="pf-comparison-list" id="pfComparisonList">
        <div class="boats-loading">
          <div class="spinner-ring"></div>
        </div>
      </div>

      <div class="pf-empty" id="pfEmpty" hidden>
        No marinas available for this scope.
      </div>
    </div>
  `;

  document
    .getElementById('pfCountryBtn')
    .addEventListener('click', showCountryMenu);

  document
    .getElementById('pfMarinaBtn')
    .addEventListener('click', showMarinaMenu);

  document
    .getElementById('pfTasksCard')
    .addEventListener('click', () => {
      toast('Maintenance is coming to the web app');
    });

  document
    .getElementById('pfDockCard')
    .addEventListener('click', () => {
      toast('Dock Walk is available in the Android app');
    });

  await loadData();
}

async function loadData() {
  const firebaseUid =
    store.authUser?.uid ||
    store.userProfile?.firebaseUid ||
    '';

  const userId = store.userProfile?.userId || 0;

  try {
    allMarinas = await getMyMarinas(firebaseUid, userId);

    renderContext();

    await Promise.all([
      renderComparison(),
      renderPortfolioStats()
    ]);
  } catch (err) {
    console.error('[dashboard] load failed', err);

    document.getElementById('pfComparisonList').innerHTML = `
      <div class="pf-empty">
        Couldn't load portfolio data.
      </div>
    `;
  }
}

/* ============================================================
   FILTERS
   ============================================================ */

function showCountryMenu() {
  const codes = new Set();

  allMarinas.forEach((marina) => {
    codes.add(marina.countryCode || 'UNASSIGNED');
  });

  const options = [
    'All countries',
    ...Array.from(codes).sort()
  ];

  const list = options.map((label, index) => ({
    label,
    value: index === 0 ? null : label
  }));

  showMenu(list, (value) => {
    selectedCountry = value;
    selectedMarinaId = -1;

    document.getElementById('pfCountryText').textContent =
      value || 'All countries';

    document.getElementById('pfMarinaText').textContent =
      'All marinas';

    renderContext();
    renderComparison();
    renderPortfolioStats();
  });
}

function showMarinaMenu() {
  const scoped = allMarinas.filter((marina) => {
    return (
      !selectedCountry ||
      (marina.countryCode || 'UNASSIGNED') === selectedCountry
    );
  });

  const options = [
    {
      label: 'All marinas',
      value: -1
    },
    ...scoped.map((marina) => ({
      label: marina.name,
      value: marina.id
    }))
  ];

  showMenu(options, (value) => {
    selectedMarinaId = value;

    const found = allMarinas.find(
      (marina) => marina.id === value
    );

    document.getElementById('pfMarinaText').textContent =
      found ? found.name : 'All marinas';

    renderContext();
    renderComparison();
    renderPortfolioStats();
  });
}

function showMenu(items, onPick) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';

  const sheet = document.createElement('div');
  sheet.className = 'sheet assign-sheet';

  sheet.innerHTML = `
    <div class="assign-handle"></div>
    <div class="assign-divider"></div>

    <div class="assign-list" id="pfMenuList">
      ${items.map((item, index) => `
        <button
          class="assign-row"
          data-index="${index}">
          <span class="assign-name">
            ${escapeHtml(item.label)}
          </span>
        </button>
      `).join('')}
    </div>

    <div class="assign-divider"></div>

    <button class="assign-cancel" id="pfMenuCancel">
      Cancel
    </button>
  `;

  document
    .getElementById('modalRoot')
    .append(backdrop, sheet);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  const close = () => {
    backdrop.classList.remove('is-open');
    sheet.classList.remove('is-open');

    setTimeout(() => {
      backdrop.remove();
      sheet.remove();
    }, 220);
  };

  backdrop.addEventListener('click', close);

  sheet
    .querySelector('#pfMenuCancel')
    .addEventListener('click', close);

  sheet.querySelectorAll('.assign-row').forEach((row) => {
    row.addEventListener('click', () => {
      const index = Number(row.dataset.index);
      const item = items[index];

      close();
      onPick(item.value);
    });
  });
}

/* ============================================================
   RENDER
   ============================================================ */

function getVisibleMarinas() {
  return allMarinas.filter((marina) => {
    if (
      selectedCountry &&
      (marina.countryCode || 'UNASSIGNED') !== selectedCountry
    ) {
      return false;
    }

    if (
      selectedMarinaId !== -1 &&
      marina.id !== selectedMarinaId
    ) {
      return false;
    }

    return true;
  });
}

function renderContext() {
  const visible = getVisibleMarinas();
  const element = document.getElementById('pfContext');

  if (selectedMarinaId !== -1 && visible.length === 1) {
    element.textContent =
      `${visible[0].name} • Individual marina`;

    return;
  }

  const scope = selectedCountry || 'All countries';

  element.textContent =
    `${scope} • ${visible.length} ` +
    `${visible.length === 1 ? 'marina' : 'marinas'}`;
}

async function renderPortfolioStats() {
  const visible = getVisibleMarinas();

  if (!visible.length) {
    document.getElementById('pfBerthsValue').textContent =
      '0 / 0';

    document.getElementById('pfBerthsSub').textContent =
      '0% portfolio occupancy';

    document.getElementById('pfProgress').style.width =
      '0%';

    return;
  }

  let totalBerths = 0;
  let occupiedBerths = 0;

  for (const marina of visible) {
    const stats = await getMarinaStats(marina.id);

    totalBerths += stats.total;
    occupiedBerths += stats.occupied;
  }

  const rate = totalBerths > 0
    ? Math.round((occupiedBerths * 100) / totalBerths)
    : 0;

  document.getElementById('pfBerthsValue').textContent =
    `${occupiedBerths} / ${totalBerths}`;

  document.getElementById('pfBerthsSub').textContent =
    `${rate}% portfolio occupancy`;

  document.getElementById('pfProgress').style.width =
    `${rate}%`;
}

async function renderComparison() {
  const visible = getVisibleMarinas();
  const listElement =
    document.getElementById('pfComparisonList');

  const emptyElement =
    document.getElementById('pfEmpty');

  if (!visible.length) {
    listElement.innerHTML = '';
    emptyElement.hidden = false;
    return;
  }

  emptyElement.hidden = true;

  const rows = await Promise.all(
    visible.map(async (marina) => {
      const stats = await getMarinaStats(marina.id);

      return {
        marina,
        stats,
        issues: 0
      };
    })
  );

  rows.sort((a, b) => {
    if (b.issues !== a.issues) {
      return b.issues - a.issues;
    }

    return a.marina.name.localeCompare(b.marina.name);
  });

  listElement.innerHTML = rows.map((row) => `
    <button
      class="pf-row"
      data-marina-id="${row.marina.id}">

      <span class="pf-row-name">
        ${escapeHtml(row.marina.name)}
      </span>

      <span class="pf-row-occ">
        ${row.stats.occupancyRate}%
      </span>

      <span class="pf-row-issues ${
        row.issues > 0 ? 'has-issues' : ''
      }">
        ${row.issues}
      </span>
    </button>

    <div class="pf-row-divider"></div>
  `).join('');

  listElement
    .querySelectorAll('.pf-row')
    .forEach((row) => {
      row.addEventListener('click', () => {
        const id = Number(row.dataset.marinaId);

        const marina = visible.find(
          (item) => item.id === id
        );

        if (marina) {
          toast(`${marina.name} — dashboard coming soon`);
        }
      });
    });
}

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character])
  );
}