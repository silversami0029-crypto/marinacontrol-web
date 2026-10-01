// js/router.js
import { store } from './store.js';
import { renderTopBar } from './components/TopBar.js';
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
import { listenForCustomers } from './db.js';
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

const PROTECTED = ['/boats', '/dashboard', '/berths', '/fleet', '/account','/user-management','/customer-directory','/client-360','/notifications'];

const routes = {
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
  document.getElementById('bottomnav').style.display  = on ? '' : 'none';
}

function currentRoute() {
  const hash = location.hash.replace(/^#/, '');
  const path = hash.split('?')[0];
  return routes[path] ? path : '/boats';
}

function navigate() {
  const route = currentRoute();
  const authed = !!store.authUser;

  if (!authed && PROTECTED.includes(route)) {
    location.hash = '#/login';
    return;
  }
  if (authed && route === '/login') {
    location.hash = '#/boats';
    return;
  }

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

// ---------- Auth bootstrap ----------
let customerUnsubscribe = null;

async function bootstrapUser(firebaseUser) {
  if (customerUnsubscribe) {
    try { customerUnsubscribe(); } catch (e) {}
    customerUnsubscribe = null;
  }

  if (!firebaseUser) {
    store.authUser = null;
    store.userProfile = null;
    store.customers = [];
    return;
  }

  store.authUser = firebaseUser;

  if (!store.userProfile || store.userProfile.firebaseUid !== firebaseUser.uid) {
    try {
      const profile = await loadUserProfile(firebaseUser);
      store.userProfile = profile;
      store.activeClientId = profile?.clientId || 0;
    } catch (e) {
      console.error('Failed to load user profile', e);
      store.userProfile = null;
    }
  }

  // Start the live customer listener
  if (store.activeClientId > 0) {
    customerUnsubscribe = listenForCustomers(store.activeClientId, (customers) => {
      store.customers = customers;
    });
  }
}

watchAuth(async (firebaseUser) => {
  await bootstrapUser(firebaseUser);
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
