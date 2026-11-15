import { italianUI as itUI } from '../i18n.js';
import { store } from '../store.js';
import { renderUserRow } from '../components/Drawer.js';
import { showAboutSheet } from './AboutSheet.js';
import { startHomeBanner } from './HomeBanner.js';
import { startWorkspaceClocks, workspaceClocksMarkup } from './WorkspaceClocks.js';
import { mountBoatDashboardScreen } from './BoatDashboardScreen.js';

const YACHT_LAYOUT = `
body.yacht-dashboard-workspace {
  --yacht-workspace-width: 980px;
  --yacht-sidebar-width: 0px;
  --yacht-workspace-gutter: 0px;
  --yacht-content-inset: max(var(--yacht-workspace-gutter), calc((100% - var(--yacht-sidebar-width) - var(--yacht-workspace-width)) / 2));
  width: min(100%, var(--yacht-workspace-width)) !important;
  max-width: var(--yacht-workspace-width) !important;
  min-width: 0 !important;
  margin: 0 auto !important;
  padding-top: 0;
}

#yachtNavigation {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding: 16px 16px 8px;
}

#yachtNavigation .nav-item {
  flex-direction: row;
  gap: 6px;
  min-height: 32px;
  padding: 5px 12px;
  border-radius: 999px;
  color: var(--color-text-primary);
  text-decoration: none;
}

#yachtNavigation .nav-item.is-active {
  background: var(--color-water-blue, #2196F3);
  color: var(--color-surface);
  font-weight: 600;
}

#yachtAccountLink {
  min-width: 0;
  max-width: 100%;
  color: inherit;
  text-decoration: none;
  border-radius: 14px;
}

#yachtAccountLink .drawer-user {
  margin: 0;
}

#yachtAccountLink[aria-current="page"] .drawer-user {
  border-color: var(--color-accent);
}

#yachtWorkspaceHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 6px 16px;
  border-bottom: 1px solid var(--color-divider);
}

.yacht-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  color: var(--color-text-primary);
  text-decoration: none;
  font-weight: 700;
}

.yacht-brand img {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.yacht-workspace-summary {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
  text-align: center;
}

.yacht-workspace-label {
  color: var(--color-text-primary);
  font-weight: 600;
  line-height: 1.25;
}

#yachtConnectionStatus {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-text-secondary);
}

#yachtConnectionStatus.is-offline .status-dot {
  background: var(--color-text-muted, #8b95a1);
}

.yacht-dashboard-workspace #screen {
  padding-inline: clamp(12px, 3vw, 32px);
}

.yacht-dashboard-workspace #screen .cm-fab {
  left: auto !important;
  right: calc(var(--yacht-content-inset) + 16px) !important;
  transform: none !important;
}

.yacht-dashboard-workspace .yacht-banner {
  align-self: stretch;
  width: 100%;
  max-width: none;
  margin-inline: 0;
  padding: 16px 0 0;
}

.yacht-dashboard-workspace .yacht-banner .mc-home-heading {
  margin-bottom: 12px;
}

.yacht-dashboard-workspace .dash-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
}

.yacht-dashboard-workspace .dash-tile {
  height: auto;
  min-height: 64px;
}

.yacht-dashboard-workspace .dash-tile-title,
.yacht-dashboard-workspace .dash-tile-count {
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (min-width: 1024px) {
  body.yacht-dashboard-workspace {
    --yacht-sidebar-width: var(--drawer-w, 280px);
    --yacht-workspace-gutter: 24px;
    width: min(var(--yacht-workspace-width), calc(100% - var(--yacht-sidebar-width) - 48px)) !important;
    margin-left: calc(var(--yacht-sidebar-width) + var(--yacht-content-inset)) !important;
    margin-right: var(--yacht-content-inset) !important;
  }

  #yachtNavigation {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--yacht-sidebar-width);
    z-index: 30;
    flex-flow: column nowrap;
    justify-content: flex-start;
    padding: 16px;
    border-right: 1px solid var(--color-divider);
    background: var(--color-surface);
    overflow: auto;
  }

  #yachtNavigation .nav-item {
    align-self: flex-start;
  }

  #yachtNavigation .nav-item:not(.is-active):hover {
    background: var(--color-bg);
  }

  #yachtWorkspaceHeader {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    padding-inline: clamp(12px, 3vw, 32px);
  }
}
`;

let unsubscribeYachtProfile;

function updateYachtProfile() {
  const link = document.getElementById('yachtAccountLink');
  if (link) link.innerHTML = renderUserRow();
}

function updateYachtConnectionStatus() {
  const status = document.getElementById('yachtConnectionStatus');
  if (!status) return;
  const online = navigator.onLine;
  status.classList.toggle('is-offline', !online);
  status.lastElementChild.textContent = itUI(online ? 'Online' : 'Offline');
}

export function renderYachtNavigation(route) {
  const screen = document.getElementById('screen');
  let nav = document.getElementById('yachtNavigation');
  document.body.classList.toggle('yacht-dashboard-workspace', Boolean(route));
  if (!route) {
    if (nav) {
      window.removeEventListener('online', updateYachtConnectionStatus);
      window.removeEventListener('offline', updateYachtConnectionStatus);
      unsubscribeYachtProfile?.();
      unsubscribeYachtProfile = null;
      nav.remove();
    }
    document.getElementById('yachtWorkspaceHeader')?.remove();
    return;
  }

  if (!document.getElementById('myYachtLayout')) {
    const styles = document.createElement('style');
    styles.id = 'myYachtLayout';
    styles.textContent = YACHT_LAYOUT;
    document.head.append(styles);
  }

  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'yachtNavigation';
    nav.setAttribute('aria-label', itUI('Yacht workspace'));
    screen.before(nav);
    unsubscribeYachtProfile = store.subscribe(updateYachtProfile);
    window.addEventListener('online', updateYachtConnectionStatus);
    window.addEventListener('offline', updateYachtConnectionStatus);
  }

  nav.replaceChildren();
  const links = [['/my-yacht', 'Home'], ['/my-yacht/details', 'Boat Details']];
  const activePath = route === '/account' || route === '/my-yacht/details' ? route : '/my-yacht';
  for (const [path, label] of links) {
    const link = document.createElement('a');
    link.href = '#' + path;
    if (path === '/my-yacht') {
      link.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></svg>';
    }
    link.append(document.createTextNode(itUI(label)));
    link.className = 'nav-item';
    if (path === activePath) {
      link.classList.add('is-active');
    }
    if (route === path) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }

  const about = document.createElement('button');
  about.type = 'button';
  about.className = 'nav-item';
  about.textContent = itUI('About');
  about.setAttribute('aria-haspopup', 'dialog');
  about.setAttribute('aria-expanded', 'false');
  about.addEventListener('click', () => {
    if (about.getAttribute('aria-expanded') === 'true') return;
    const previous = nav.querySelector('.nav-item.is-active');
    previous?.classList.remove('is-active');
    about.classList.add('is-active');
    about.setAttribute('aria-expanded', 'true');
    showAboutSheet({
      yacht: true,
      onClose: () => {
        about.classList.remove('is-active');
        about.setAttribute('aria-expanded', 'false');
        previous?.classList.add('is-active');
      }
    });
  });
  nav.append(about);

  const account = document.createElement('a');
  account.id = 'yachtAccountLink';
  account.href = '#/account';
  if (route === '/account') account.setAttribute('aria-current', 'page');
  nav.append(account);
  updateYachtProfile();

  if (!document.getElementById('yachtWorkspaceHeader')) {
    const header = document.createElement('header');
    header.id = 'yachtWorkspaceHeader';
    const brand = document.createElement('a');
    brand.className = 'yacht-brand';
    brand.href = '#/my-yacht';
    brand.innerHTML = '<img src="assets/icons/marina_logo.png" alt="">';
    brand.append(document.createTextNode('MarinaControl'));

    const summary = document.createElement('div');
    summary.className = 'yacht-workspace-summary';

    const label = document.createElement('span');
    label.className = 'yacht-workspace-label';
    label.textContent = itUI('Yacht Management');

    const status = document.createElement('div');
    status.id = 'yachtConnectionStatus';
    status.setAttribute('role', 'status');
    status.innerHTML = '<span class="status-dot" aria-hidden="true"></span><span></span>';
    summary.append(label, status);
    header.append(brand, summary);
    screen.before(header);
  }
  updateYachtConnectionStatus();
}

let stopBanner;
let stopClocks;

export function unmountMyYachtScreen() {
  stopBanner?.();
  stopClocks?.();
  stopBanner = null;
  stopClocks = null;
}

export function mountMyYachtScreen() {
  unmountMyYachtScreen();
  const screen = document.getElementById('screen');
  const yacht = store.assignedYacht;
  if (yacht) {
    mountBoatDashboardScreen(yacht);
    if (!document.getElementById('homeOverviewCss')) {
      const styles = document.createElement('link');
      styles.id = 'homeOverviewCss';
      styles.rel = 'stylesheet';
      styles.href = 'css/home.css?v=20261111-time-zones-2';
      document.head.append(styles);
    }

    const banner = document.createElement('div');
    banner.className = 'mc-home yacht-banner';
    banner.innerHTML = `<header class="mc-home-heading">
      ${workspaceClocksMarkup()}
      <span class="mc-home-eyebrow"></span>
      <p></p>
    </header>`;
    const header = banner.querySelector('header');
    header.querySelector('.mc-home-eyebrow').textContent = itUI('MarinaControl');
    header.querySelector('p').textContent = itUI('Your yacht at a glance');
    screen.prepend(banner);
    stopBanner = startHomeBanner(header);
    stopClocks = startWorkspaceClocks(header);
    return;
  }

  screen.innerHTML = '<section class="boats-empty"><h2></h2><p role="alert"></p><button type="button"></button></section>';
  screen.querySelector('h2').textContent = itUI('My Yacht');
  screen.querySelector('p').textContent = itUI('Could not load your assigned yacht. Try again or contact your workspace administrator.');
  const retry = screen.querySelector('button');
  retry.textContent = itUI('Retry');
  retry.addEventListener('click', () => location.reload());
}
