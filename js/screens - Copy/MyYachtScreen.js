import { italianUI as itUI } from '../i18n.js';
import { store } from '../store.js';
import { onLogout } from './AccountScreen.js';
import { mountBoatDashboardScreen } from './BoatDashboardScreen.js';

const YACHT_LAYOUT = `
body.yacht-dashboard-workspace {
  width: min(100%, 980px) !important;
  max-width: 980px !important;
  min-width: 0 !important;
  margin: 0 auto !important;
  padding-top: 0;
}

#yachtNavigation {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border-bottom: 1px solid var(--color-divider);
}

#yachtNavigation .nav-item {
  min-height: 44px;
  padding: 8px 14px;
  border: 1px solid var(--color-divider);
  border-radius: 8px;
  color: var(--color-text-primary);
  text-decoration: none;
}

#yachtNavigation .nav-item.is-active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.yacht-dashboard-workspace #screen {
  padding-inline: clamp(12px, 3vw, 32px);
}

.yacht-dashboard-workspace .dash-tile {
  cursor: default;
}

.yacht-dashboard-workspace .dash-tile:active {
  transform: none;
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
`;

export function renderYachtNavigation(route) {
  const screen = document.getElementById('screen');
  let nav = document.getElementById('yachtNavigation');
  document.body.classList.toggle('yacht-dashboard-workspace', Boolean(route));
  if (!route) {
    nav?.remove();
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
  }

  nav.replaceChildren();
  for (const [path, label] of [['/my-yacht', 'Boat Dashboard'], ['/account', 'Account']]) {
    const link = document.createElement('a');
    link.href = '#' + path;
    link.textContent = itUI(label);
    link.className = 'nav-item';
    if (route === path) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
    nav.append(link);
  }

  const logout = document.createElement('button');
  logout.type = 'button';
  logout.className = 'nav-item';
  logout.textContent = itUI('Log out');
  logout.addEventListener('click', onLogout);
  nav.append(logout);
}

export function mountMyYachtScreen() {
  const screen = document.getElementById('screen');
  const yacht = store.assignedYacht;
  if (yacht) {
    mountBoatDashboardScreen(yacht);
    return;
  }

  screen.innerHTML = '<section class="boats-empty"><h2></h2><p role="alert"></p><button type="button"></button></section>';
  screen.querySelector('h2').textContent = itUI('My Yacht');
  screen.querySelector('p').textContent = itUI('Could not load your assigned yacht. Try again or contact your workspace administrator.');
  const retry = screen.querySelector('button');
  retry.textContent = itUI('Retry');
  retry.addEventListener('click', () => location.reload());
}
