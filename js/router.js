import { mountHomeScreen, unmountHomeScreen } from './screens/HomeScreen.js';
import { mountPedestalFoundationScreen } from './screens/PedestalFoundationScreen.js';
import { mountOperationsTrendsScreen } from './screens/OperationsTrendsScreen.js';
import { initLanguage } from './i18n.js';
// js/router.js
import { store } from './store.js';
import { renderTopBar, resetTopBarNotifications } from './components/TopBar.js';
import { wireBottomNav } from './components/BottomNav.js';
import { mountBoatsScreen } from './screens/BoatsScreen.js';
import { mountLoginScreen } from './screens/LoginScreen.js';
import { watchAuth, loadUserProfile } from './auth.js';
import { mountReportsScreen } from './screens/ReportsScreen.js';
import { mountInvoiceScreen } from './screens/InvoiceScreen.js';
import { mountChecklistScreen } from './screens/ChecklistScreen.js';
import { mountShiftScheduleScreen } from './screens/ShiftScheduleScreen.js';
import { mountDashboardScreen } from './screens/DashboardScreen.js';
import { mountAccountScreen } from './screens/AccountScreen.js';
import { mountBerthsScreen } from './screens/BerthsScreen.js';
import { listenForCustomers, getMyMarinas } from './db.js';
import { mountBookingRequestsScreen } from './screens/BookingRequestsScreen.js';
import { initDrawer } from './components/Drawer.js';
import { mountBoatDashboardScreen } from './screens/BoatDashboardScreen.js';
import { mountUserManagementScreen } from './screens/UserManagementScreen.js';
import { mountCustomerDirectoryScreen } from './screens/CustomerDirectoryScreen.js';
import { mountMaintenanceScreen } from './screens/MaintenanceScreen.js';
import { mountClient360Screen } from './screens/Client360Screen.js';
import { mountCrewManagementScreen } from './screens/CrewManagementScreen.js';
import { mountDocumentScreen } from './screens/DocumentScreen.js';
import { mountSafetyScreen } from './screens/SafetyScreen.js';
import { mountEquipmentScreen } from './screens/EquipmentScreen.js';
import { mountInventoryScreen } from './screens/InventoryScreen.js';
import { mountPermissionsScreen } from './screens/PermissionsScreen.js';
import { mountTaskScreen } from './screens/TaskScreen.js';
import { mountFleetScreen } from './screens/FleetScreen.js';
import { mountNotificationsScreen } from './screens/NotificationsScreen.js';

initLanguage();

const PROTECTED = ['/home', '/boats', '/dashboard', '/berths', '/fleet', '/account','/user-management','/customer-directory','/client-360','/notifications'];

const routes = {
  '/home':             mountHomeScreen,
  '/login':            mountLoginScreen,
  '/boats':            mountBoatsScreen,
  '/dashboard':        mountDashboardScreen,
  '/boat-dashboard':   mountBoatDashboardScreen,
  '/berths':           mountBerthsScreen,
  '/booking-requests': mountBookingRequestsScreen,
  '/user-management':  mountUserManagementScreen,
  '/permissions': mountPermissionsScreen,
 '/customer-directory': mountCustomerDirectoryScreen,
'/maintenance': mountMaintenanceScreen,
  '/client-360': mountClient360Screen,
 '/crew': mountCrewManagementScreen,
  '/reports': mountReportsScreen,
  '/operations-trends': mountOperationsTrendsScreen,
  '/pedestal-simulator': mountPedestalFoundationScreen,
  '/checklists': mountChecklistScreen,
  '/invoices': mountInvoiceScreen,
  '/shift-schedule': mountShiftScheduleScreen,
  '/documents': mountDocumentScreen,
  '/tasks': mountTaskScreen,
  '/inventory': mountInventoryScreen,
  '/equipment': mountEquipmentScreen,
  '/safety': mountSafetyScreen,
  '/notifications': mountNotificationsScreen,
   '/fleet':  mountFleetScreen,
  '/account': mountAccountScreen,
 
};

function renderStub(name) {
  showChrome(true);
  document.getElementById('screen').innerHTML =
    `<div style="padding:32px;color:var(--color-text-secondary);
                 text-align:center;">${name} — coming soon</div>`;
}

function showChrome(on) {
  document.getElementById('topbar').style.display     = on ? '' : 'none';
  /*document.getElementById('bottomnav').style.display  = on ? '' : 'none';*/
}

function currentRoute() {
  const hash = location.hash.replace(/^#/, '');
  const path = hash.split('?')[0];
  return routes[path] ? path : '/home';
}

function navigate() {
  const route = currentRoute();
  if (!authReady) return;
  const authed = !!store.authUser && !!store.activeMarina;

  if (!authed && route !== '/login') {
    location.hash = '#/login';
    return;
  }
  if (authed && route === '/login') {
    location.hash = '#/home';
    return;
  }

  unmountHomeScreen();
  showChrome(route !== '/login');

  const isBoatDashboard = route === '/dashboard' && location.hash.includes('boatId=');
  const highlightRoute  = isBoatDashboard ? '/boats' : route;

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.route === highlightRoute);
  });

  if (route !== '/login') renderTopBar(route);

  document.getElementById('screen')?.classList.remove('rp-screen');

  routes[route]();
}

// ---------- Marina session ----------
let customerUnsubscribe = null;
let authReady = false;
let sessionGeneration = 0;
let baseProfile = null;

function selectionKey(uid) { return `marinacontrol.activeMarina.${uid}`; }
function clearMarinaData() {
  store.boats = [];
  store.boatsFull = [];
  store.customers = [];
  store.customerCache.clear();
  store.notifications = [];
  store.activeBoatId = 0;
  store.searchQuery = '';
  store.syncTime = 0;
}
function stopCustomers() {
  customerUnsubscribe?.();
  customerUnsubscribe = null;
}
function applyMarina(marina) {
  stopCustomers();
  clearMarinaData();
  store.activeMarina = marina;
  store.activeClientId = Number(marina?.id || 0);
  store.activeRole = marina?.role || '';
  // Existing screens using userProfile.role also see the selected role.
  store.userProfile = baseProfile ? { ...baseProfile, role: store.activeRole } : null;
  if (!marina) return;
  const generation = sessionGeneration;
  const clientId = store.activeClientId;
  customerUnsubscribe = listenForCustomers(clientId, customers => {
    if (generation !== sessionGeneration || clientId !== store.activeClientId) return;
    store.customers = customers;
    store.emit();
  });
}

export async function switchMarina(clientId, destinationRoute = null) {
  if (!authReady || !store.authUser || store.marinaSwitching) return;
  store.marinaSwitching = true;
  renderTopBar(currentRoute());
  const generation = sessionGeneration;
  const uid = store.authUser.uid;
  try {
    const marinas = (await getMyMarinas(uid, baseProfile?.userId || 0))
      .filter(m => Number(m.isActive) === 1);
    if (generation !== sessionGeneration) return;
    store.marinas = marinas;
    const selected = marinas.find(m => Number(m.id) === Number(clientId));
    const current = marinas.find(m => Number(m.id) === store.activeClientId);
    const fallback = marinas.find(m => Number(m.id) === Number(baseProfile?.clientId));
    if (destinationRoute && !selected) throw new Error('This marina is no longer accessible. Please refresh the portfolio.');
    const target = selected || current || fallback;
    if (!target) throw new Error('No accessible marina is available. Please sign in again.');
    // Persist before any state change. A storage error leaves the current session intact.
    localStorage.setItem(selectionKey(uid), String(target.id));
    if (Number(target.id) === store.activeClientId && target.role === store.activeRole) {
      if (destinationRoute && routes[destinationRoute]) location.hash = `#${destinationRoute}`;
      return;
    }
    stopCustomers();
    // Reload tears down every screen listener, pending view and module-local cache.
    // Strip record IDs that belong to the old marina.
    const route = destinationRoute && routes[destinationRoute] ? destinationRoute
      : currentRoute() === '/boat-dashboard' ? '/boats' : currentRoute();
    history.replaceState(null, '', `${location.pathname}${location.search}#${route}`);
    location.reload();
  } finally {
    if (generation === sessionGeneration) {
      store.marinaSwitching = false;
      renderTopBar(currentRoute());
    }
  }
}

async function bootstrapUser(firebaseUser) {
  const generation = ++sessionGeneration;
  authReady = false;
  unmountHomeScreen();
  resetTopBarNotifications();
  stopCustomers();
  baseProfile = null;
  store.authUser = null;
  store.userProfile = null;
  store.marinas = [];
  store.marinaSwitching = false;
  applyMarina(null);
  document.getElementById('screen').textContent = 'Loading…';
  if (!firebaseUser) { authReady = true; return; }
  try {
    const profile = await loadUserProfile(firebaseUser);
    if (!profile) throw new Error('User profile unavailable');
    const marinas = (await getMyMarinas(firebaseUser.uid, profile.userId))
      .filter(m => Number(m.isActive) === 1);
    if (generation !== sessionGeneration) return;
    let remembered = 0;
    try { remembered = Number(localStorage.getItem(selectionKey(firebaseUser.uid)) || 0); }
    catch (error) { console.warn('Marina preference unavailable', error); }
    const marina = marinas.find(m => Number(m.id) === remembered)
      || marinas.find(m => Number(m.id) === Number(profile.clientId));
    if (!marina) throw new Error('No accessible marina is available');
    baseProfile = profile;
    store.authUser = firebaseUser;
    store.marinas = marinas;
    applyMarina(marina);
    try { localStorage.setItem(selectionKey(firebaseUser.uid), String(marina.id)); }
    catch (error) { console.warn('Marina preference could not be saved', error); }
  } catch (error) {
    if (generation !== sessionGeneration) return;
    console.error('Marina session bootstrap failed', error);
    store.authUser = null;
    applyMarina(null);
  } finally {
    if (generation === sessionGeneration) authReady = true;
  }
}

watchAuth(async firebaseUser => {
  await bootstrapUser(firebaseUser);
  if (!authReady) return;
  if (!location.hash) location.hash = '#/login';
  navigate();
});

window.addEventListener('hashchange', navigate);

window.addEventListener('DOMContentLoaded', () => {
  wireBottomNav();
  initDrawer();
  if (!location.hash) location.hash = '#/login';
});

// Fallback if module loads after DOMContentLoaded
if (document.readyState !== 'loading') {
  wireBottomNav();
  initDrawer();
}
