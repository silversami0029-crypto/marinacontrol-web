# ============================================================
#  setup.ps1 — Scaffold the Dubai Marina web app
#  Run from:  C:\Users\lbess\Documents\webapp
#  Command :  powershell -ExecutionPolicy Bypass -File setup.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Scaffolding in: $root" -ForegroundColor Cyan

# -------- folders --------
$folders = @(
  "css",
  "js",
  "js\models",
  "js\components",
  "js\screens",
  "assets",
  "assets\icons"
)
foreach ($f in $folders) {
  New-Item -ItemType Directory -Force -Path (Join-Path $root $f) | Out-Null
}

function Write-File($path, $content) {
  $full = Join-Path $root $path
  $content | Set-Content -Path $full -Encoding UTF8 -NoNewline
  Write-Host "  wrote $path" -ForegroundColor DarkGray
}

# ============================================================
#  css/theme.css
# ============================================================
Write-File "css\theme.css" @'
:root {
  --color-bg:              #151A20;
  --color-surface:         #1C222A;
  --color-text-primary:    #F1F3F5;
  --color-text-secondary:  #AEB6C1;
  --color-text-muted:      #737D89;
  --color-divider:         #2B323B;

  --color-accent:          #2E9BFF;
  --color-success:         #3DD68C;
  --color-star:            #F5C542;
  --color-avatar-bg:       #AEB6C1;

  --font-family: 'Roboto', system-ui, -apple-system, sans-serif;
  --fs-boat-name:    16px;
  --fs-row-meta:     13px;
  --fs-title:        20px;
  --fs-nav:          11px;

  --space-xs: 4px;  --space-sm: 8px;  --space-md: 12px;
  --space-lg: 16px; --space-xl: 24px;

  --row-min-h:      88px;
  --avatar-size:    46px;
  --icon-location:  17px;
  --icon-action:    22px;
  --kebab-size:     40px;
  --topbar-h:       64px;
  --bottomnav-h:    64px;

  --radius-circle:  50%;
  --radius-md:      10px;
}

*, *::before, *::after { box-sizing: border-box; }

html, body {
  margin: 0; padding: 0; height: 100%;
  background: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-family);
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}

button { font-family: inherit; cursor: pointer; border: none; background: none; padding: 0; }
a { color: inherit; text-decoration: none; }
svg { display: block; }
'@

# ============================================================
#  css/components.css
# ============================================================
Write-File "css\components.css" @'
/* ================= TOP BAR ================= */
.topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 12px;
  height: var(--topbar-h);
  padding: 0 12px;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-divider);
}
.topbar-menu, .topbar-bell {
  width: 40px; height: 40px;
  display: grid; place-items: center;
  color: var(--color-text-secondary);
  border-radius: 50%;
}
.topbar-menu:hover, .topbar-bell:hover { background: var(--color-surface); }

.topbar-brand { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.topbar-logo {
  width: 34px; height: 34px; border-radius: 50%;
  background: var(--color-surface);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.topbar-title {
  font-size: var(--fs-title); font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.topbar-subtitle {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--color-text-secondary);
  margin-top: 2px;
}
.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--color-success);
}

/* ================= SCREEN ================= */
.screen {
  min-height: calc(100vh - var(--topbar-h) - var(--bottomnav-h));
  padding-bottom: var(--bottomnav-h);
}

/* ================= BOTTOM NAV ================= */
.bottomnav {
  position: fixed; bottom: 0; left: 0; right: 0;
  height: var(--bottomnav-h);
  display: grid; grid-template-columns: repeat(5, 1fr);
  background: var(--color-bg);
  border-top: 1px solid var(--color-divider);
  z-index: 30;
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-item {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px;
  color: var(--color-text-muted);
  font-size: var(--fs-nav);
  transition: color .15s;
}
.nav-item.is-active { color: var(--color-accent); }

/* ================= BOAT ROW ================= */
.boat-row {
  position: relative;
  display: flex; align-items: center;
  min-height: var(--row-min-h);
  padding: 10px 4px;
  margin: 0 12px;
  gap: 0;
  cursor: pointer;
}
.boat-row:active { background: rgba(255,255,255,.02); }

.boat-check { margin-right: 8px; }

.boat-avatar {
  flex: 0 0 var(--avatar-size);
  width: var(--avatar-size); height: var(--avatar-size);
  border-radius: var(--radius-circle);
  background: var(--color-avatar-bg);
  color: var(--color-bg);
  display: grid; place-items: center;
  font-size: 13px; font-weight: 700;
  margin-right: 14px;
}

.boat-info { flex: 1; min-width: 0; }

.boat-name-line {
  display: flex; align-items: center; gap: 6px;
  min-width: 0;
}
.boat-name {
  font-size: var(--fs-boat-name); font-weight: 700;
  color: var(--color-text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.boat-star  { color: var(--color-star); font-size: 13px; }
.boat-status {
  font-size: 12px; font-weight: 700;
  letter-spacing: .3px; text-transform: uppercase;
  color: var(--color-text-secondary);
}

.boat-customer,
.boat-location {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--fs-row-meta);
  color: var(--color-text-secondary);
  margin-top: 5px;
}
.boat-location { margin-top: 6px; }

.boat-customer .icon { width: 15px; height: 15px; }
.boat-location .icon { width: var(--icon-location); height: var(--icon-location); }

.boat-icon-btn {
  width: 32px; height: 32px;
  display: grid; place-items: center;
  color: var(--color-text-secondary);
  margin-left: 4px;
}
.boat-icon-btn .icon { width: var(--icon-action); height: var(--icon-action); }

.boat-kebab {
  width: var(--kebab-size); height: var(--kebab-size);
  display: grid; place-items: center;
  color: var(--color-text-secondary);
  border-radius: 50%;
}
.boat-kebab:hover { background: var(--color-surface); }

.boat-divider {
  position: absolute; left: 0; right: 0; bottom: 0;
  height: 1px; background: var(--color-divider);
}

/* ================= FAB ================= */
.fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--bottomnav-h) + 16px);
  height: 48px; padding: 0 20px;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff; font-weight: 600; font-size: 15px;
  display: flex; align-items: center; gap: 8px;
  box-shadow: 0 6px 16px rgba(46,155,255,.35);
  z-index: 25;
}
'@

# ============================================================
#  css/screens.css
# ============================================================
Write-File "css\screens.css" @'
/* Boats screen header strip: "Boats  (i)  [search]" */
.boats-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px 4px;
}
.boats-header h1 {
  margin: 0; font-size: 22px; font-weight: 700;
  color: var(--color-text-primary);
}
.boats-header .info-btn,
.boats-header .search-btn {
  width: 36px; height: 36px;
  display: grid; place-items: center;
  color: var(--color-text-secondary);
  border-radius: 50%;
}
.boats-header .search-btn { margin-left: auto; }

/* Empty state */
.boats-empty {
  padding: 64px 24px; text-align: center;
  color: var(--color-text-secondary);
}
.boats-empty h2 {
  margin: 0 0 8px; font-size: 18px;
  color: var(--color-text-primary);
}
.boats-empty p { margin: 0; font-size: 14px; }

/* Search bar (hidden until search tapped) */
.boats-search {
  display: none;
  align-items: center; gap: 8px;
  padding: 8px 16px;
}
.boats-search.is-open { display: flex; }
.boats-search input {
  flex: 1;
  background: var(--color-surface);
  border: 1px solid var(--color-divider);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}
.boats-search input::placeholder { color: var(--color-text-muted); }
'@

# ============================================================
#  index.html
# ============================================================
Write-File "index.html" @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#151A20">
  <title>Dubai Marina</title>
  <link rel="stylesheet" href="css/theme.css">
  <link rel="stylesheet" href="css/components.css">
  <link rel="stylesheet" href="css/screens.css">
</head>
<body>

  <header id="topbar" class="topbar">
    <button class="topbar-menu" id="btnTopMenu" aria-label="Menu">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <div class="topbar-brand">
      <div class="topbar-logo" id="topbarLogo"></div>
      <div class="topbar-brand-text">
        <div class="topbar-title" id="topbarTitle">Dubai Marina</div>
        <div class="topbar-subtitle">
          <span class="status-dot"></span>
          <span id="topbarSync">Online · Synced just now</span>
        </div>
      </div>
    </div>

    <button class="topbar-bell" id="btnBell" aria-label="Notifications">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round">
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
      </svg>
    </button>
  </header>

  <main id="screen" class="screen"></main>

  <nav id="bottomnav" class="bottomnav">
    <button class="nav-item is-active" data-route="/boats">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round">
        <path d="M3 17h18M5 17V9l7-5 7 5v8M9 17v-5h6v5"/>
      </svg>
      <span>Boat</span>
    </button>
    <button class="nav-item" data-route="/dashboard">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span>Dashboard</span>
    </button>
    <button class="nav-item" data-route="/berths">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round">
        <path d="M3 8h18M3 12h18M3 16h18M5 8v12M19 8v12"/>
      </svg>
      <span>Berths</span>
    </button>
    <button class="nav-item" data-route="/fleet">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round">
        <path d="M4 7h16l-1.5 9h-13z"/><circle cx="8" cy="19" r="1.3"/>
        <circle cx="16" cy="19" r="1.3"/>
      </svg>
      <span>Fleet</span>
    </button>
    <button class="nav-item" data-route="/account">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
           stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21a8 8 0 0 1 16 0"/>
      </svg>
      <span>Account</span>
    </button>
  </nav>

  <div id="modalRoot"></div>

  <script type="module" src="js/router.js"></script>
</body>
</html>
'@

# ============================================================
#  js/firebase-config.js
# ============================================================
Write-File "js\firebase-config.js" @'
export const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
'@

# ============================================================
#  js/firebase.js
# ============================================================
Write-File "js\firebase.js" @'
import { firebaseConfig } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, query, where, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

export { collection, query, where, onSnapshot, onAuthStateChanged };
'@

# ============================================================
#  js/db.js
# ============================================================
Write-File "js\db.js" @'
import { db, collection, query, where, onSnapshot } from './firebase.js';
import { Boat } from './models/Boat.js';

/** Live listener — mirrors listenForBoatsFromFirestore() */
export function listenForBoats(clientId, callback) {
  const q = query(collection(db, 'boats'), where('clientId', '==', clientId));
  return onSnapshot(q, snap => {
    const boats = snap.docs.map(d => new Boat({ id: d.id, ...d.data() }));
    callback(boats);
  });
}

/** Fetch a single customer name — mirrors customerDao.getCustomerById() */
export async function getCustomerName(customerId) {
  // TODO: implement once we confirm the customers collection name
  return null;
}
'@

# ============================================================
#  js/store.js
# ============================================================
Write-File "js\store.js" @'
export const store = {
  boats:          [],
  boatsFull:      [],
  searchQuery:    '',
  activeClientId: 0,
  syncTime:       0,
  customerCache:  new Map(),

  listeners: new Set(),
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => fn(this)); }
};
'@

# ============================================================
#  js/utils.js
# ============================================================
Write-File "js\utils.js" @'
export function initials(text) {
  if (!text) return '?';
  return text.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');
}

export function formatSyncTime(timestamp) {
  if (!timestamp || timestamp <= 0) return 'Never';
  const diff = Date.now() - timestamp;

  if (diff < 60_000)     return 'Just now';
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return h === 1 ? '1 hour ago' : `${h} hours ago`;
  }
  const d = Math.floor(diff / 86_400_000);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

export function debounce(fn, ms = 150) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
'@

# ============================================================
#  js/models/Boat.js
# ============================================================
Write-File "js\models\Boat.js" @'
export class Boat {
  constructor(raw = {}) {
    this.id             = raw.id ?? 0;
    this.customerId     = raw.customerId ?? 0;
    this.assignedTo     = raw.assignedTo ?? 0;
    this.clientId       = raw.clientId ?? 0;
    this.lastModified   = raw.lastModified ?? 0;
    this.lastModifiedBy = raw.lastModifiedBy ?? null;
    this.syncedAt       = raw.syncedAt ?? 0;

    this.name           = raw.name ?? '';
    this.mmsi           = raw.mmsi ?? '';
    this.isSample       = raw.isSample ?? true;
    this.hin            = raw.hin ?? 'UNKNOWN-HIN';
    this.port           = raw.port ?? '';
    this.status         = raw.status ?? 'In Service';
    this.isActive       = raw.isActive ?? false;
    this.type           = raw.type ?? 'motor';
    this.engineType     = raw.engineType ?? 'Unknown';
    this.engineHours    = raw.engineHours ?? 0;

    this.voiceNotePath  = raw.voiceNotePath ?? null;
    this.photoPath      = raw.photoPath ?? null;

    this.length         = raw.length ?? 0;
    this.beam           = raw.beam ?? 0;
    this.draft          = raw.draft ?? 0;
    this.airDraft       = raw.airDraft ?? 0;

    this.customerName   = raw.customerName ?? null;
  }

  hasVoiceNote() { return !!this.voiceNotePath && this.voiceNotePath.length > 0; }
  hasPhoto()     { return !!this.photoPath     && this.photoPath.length     > 0; }

  initials() {
    if (!this.name) return '?';
    return this.name.length >= 2
      ? this.name.substring(0, 2).toUpperCase()
      : this.name.substring(0, 1).toUpperCase();
  }
}
'@

# ============================================================
#  js/components/TopBar.js
# ============================================================
Write-File "js\components\TopBar.js" @'
import { store } from '../store.js';
import { formatSyncTime } from '../utils.js';

const TITLES = {
  '/boats':     'Dubai Marina',
  '/dashboard': 'Dashboard',
  '/berths':    'Berths',
  '/fleet':     'Fleet',
  '/account':   'Account',
};

export function renderTopBar(route) {
  const title = TITLES[route] || 'Dubai Marina';
  document.getElementById('topbarTitle').textContent = title;

  const syncEl = document.getElementById('topbarSync');
  const syncText = store.syncTime
    ? `Online · Synced ${formatSyncTime(store.syncTime)}`
    : 'Online';
  syncEl.textContent = syncText;
}
'@

# ============================================================
#  js/components/BottomNav.js
# ============================================================
Write-File "js\components\BottomNav.js" @'
export function wireBottomNav() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      location.hash = '#' + btn.dataset.route;
    });
  });
}
'@

# ============================================================
#  js/components/BoatRow.js  (stub — filled in Step 3)
# ============================================================
Write-File "js\components\BoatRow.js" @'
export function renderBoatRow(boat) {
  return '';
}
'@

# ============================================================
#  js/screens/BoatsScreen.js  (stub — filled in Step 3)
# ============================================================
Write-File "js\screens\BoatsScreen.js" @'
export function mountBoatsScreen() {
  document.getElementById('screen').innerHTML =
    '<div class="boats-empty"><h2>Boats</h2><p>Coming in Step 3…</p></div>';
}
'@

# ============================================================
#  js/router.js
# ============================================================
Write-File "js\router.js" @'
import { renderTopBar } from './components/TopBar.js';
import { wireBottomNav } from './components/BottomNav.js';
import { mountBoatsScreen } from './screens/BoatsScreen.js';

const routes = {
  '/boats':     mountBoatsScreen,
  '/dashboard': () => renderStub('Dashboard'),
  '/berths':    () => renderStub('Berths'),
  '/fleet':     () => renderStub('Fleet'),
  '/account':   () => renderStub('Account'),
};

function renderStub(name) {
  document.getElementById('screen').innerHTML =
    `<div style="padding:32px;color:var(--color-text-secondary);
                 text-align:center;">${name} — coming soon</div>`;
}

function currentRoute() {
  const h = location.hash.replace(/^#/, '');
  return routes[h] ? h : '/boats';
}

function navigate() {
  const route = currentRoute();
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.route === route);
  });
  renderTopBar(route);
  routes[route]();
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', () => {
  wireBottomNav();
  if (!location.hash) location.hash = '#/boats';
  navigate();
});
'@

# ============================================================
#  package.json
# ============================================================
Write-File "package.json" @'
{
  "name": "dubai-marina-web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "npx --yes serve -l 3000 ."
  }
}
'@

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "  Done. Files created in: $root"          -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. cd $root"
Write-Host "  2. npm start"
Write-Host "  3. Open http://localhost:3000"
Write-Host ""