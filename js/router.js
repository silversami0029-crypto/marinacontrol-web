import {sessionTimeout} from './util/SessionTimeout.js';
import {mountDockWalkReviewScreen,unmountDockWalkReviewScreen} from './screens/DockWalkReviewScreen.js';
import { mountStaffWorkScreen, unmountStaffWorkScreen } from './screens/StaffWorkScreen.js';
import { isDockMaster, dockMasterRouteAllowed, isStaffWorkUser, staffWorkRouteAllowed } from './roles.js';
import { mountDockWalkScreen, unmountDockWalkScreen } from './screens/DockWalkScreen.js';
import { italianUI as itUI } from './i18n.js';
import { mountUSafeScreen, unmountUSafeScreen } from './screens/USafeScreen.js';
import { mountYardStorageScreen, unmountYardStorageScreen } from './screens/YardStorageScreen.js';
import { mountProceduresScreen, unmountProceduresScreen } from './screens/ProceduresScreen.js';
import { mountEditCustomerScreen, unmountEditCustomerScreen } from './screens/EditCustomerScreen.js';
import { mountHomeScreen, unmountHomeScreen } from './screens/HomeScreen.js';
import { mountPedestalFoundationScreen } from './screens/PedestalFoundationScreen.js';
import { mountOperationsTrendsScreen } from './screens/OperationsTrendsScreen.js';
import { initLanguage } from './i18n.js';
// js/router.js
import { store } from './store.js';
import { renderTopBar, resetTopBarNotifications } from './components/TopBar.js';
import { wireBottomNav } from './components/BottomNav.js';
import { mountAssignedYachtBoats, mountBoatsScreen, unmountAssignedYachtBoats } from './screens/BoatsScreen.js';
import { mountLoginScreen } from './screens/LoginScreen.js';
import { watchAuth, loadUserProfile, reportSessionError, getCurrentAuthUser } from './auth.js';
import { mountReportsScreen } from './screens/ReportsScreen.js';
import { mountInvoiceScreen, unmountInvoiceScreen } from './screens/InvoiceScreen.js';
import { mountChecklistScreen, unmountChecklistScreen } from './screens/ChecklistScreen.js';
import { mountShiftScheduleScreen, unmountShiftScheduleScreen } from './screens/ShiftScheduleScreen.js';
import { mountDashboardScreen } from './screens/DashboardScreen.js';
import { mountAccountScreen } from './screens/AccountScreen.js';
import { mountBerthsScreen, unmountBerthsScreen } from './screens/BerthsScreen.js';
import { listenForCustomers, getMyMarinas, resolveAssignedYacht } from './db.js';
import { mountBookingRequestsScreen, unmountBookingRequestsScreen } from './screens/BookingRequestsScreen.js';
import { initDrawer, syncDrawerLayout } from './components/Drawer.js';
import { mountMyYachtScreen, renderYachtNavigation } from './screens/MyYachtScreen.js';
import { mountBoatDashboardScreen } from './screens/BoatDashboardScreen.js';
import { mountUserManagementScreen } from './screens/UserManagementScreen.js';
import { mountCustomerDirectoryScreen, unmountCustomerDirectoryScreen } from './screens/CustomerDirectoryScreen.js';
import { mountMaintenanceScreen, unmountMaintenanceScreen } from './screens/MaintenanceScreen.js';
import { mountClient360Screen } from './screens/Client360Screen.js';
import { mountCrewManagementScreen, unmountCrewManagementScreen } from './screens/CrewManagementScreen.js';
import { mountDocumentScreen, unmountDocumentScreen } from './screens/DocumentScreen.js';
import { mountSafetyScreen, unmountSafetyScreen } from './screens/SafetyScreen.js';
import { mountEquipmentScreen, unmountEquipmentScreen } from './screens/EquipmentScreen.js';
import { mountInventoryScreen, unmountInventoryScreen } from './screens/InventoryScreen.js';
import { mountPermissionsScreen, unmountPermissionsScreen } from './screens/PermissionsScreen.js';
import { mountTaskScreen, unmountTaskScreen } from './screens/TaskScreen.js';
import { mountFleetScreen } from './screens/FleetScreen.js';
import { mountNotificationsScreen } from './screens/NotificationsScreen.js';

initLanguage();

const PROTECTED = ['/procedures', '/home', '/boats', '/dashboard', '/berths', '/fleet', '/account','/user-management','/customer-directory','/edit-customer','/client-360','/notifications'];

const yachtToolCleanup = {
  '/maintenance': unmountMaintenanceScreen,
  '/equipment': unmountEquipmentScreen,
  '/inventory': unmountInventoryScreen,
  '/safety': unmountSafetyScreen,
  '/tasks': unmountTaskScreen,
  '/documents': unmountDocumentScreen,
  '/checklists': unmountChecklistScreen,
  '/crew': unmountCrewManagementScreen,
};
const screenCleanup = {
  '/my-work': unmountStaffWorkScreen,
  '/staff-work': unmountStaffWorkScreen,
  '/dock-walk-review': unmountDockWalkReviewScreen,
  ...yachtToolCleanup,
  '/my-yacht/details': unmountAssignedYachtBoats,
  '/boats': unmountAssignedYachtBoats,
  '/berths': unmountBerthsScreen,
  '/booking-requests': unmountBookingRequestsScreen,
  '/invoices': unmountInvoiceScreen,
  '/permissions': unmountPermissionsScreen,
  '/shift-schedule': unmountShiftScheduleScreen,
};
let unmountCurrentTool = null;

function leaveToolScreen() {
  unmountCurrentTool?.();
  unmountCurrentTool = null;
}

const routes = {
  '/my-work': mountStaffWorkScreen,
  '/staff-work': mountStaffWorkScreen,
  '/dock-walk-review': mountDockWalkReviewScreen,
  '/usafe': mountUSafeScreen,
  '/home':             mountHomeScreen,
  '/my-yacht':         mountMyYachtScreen,
  '/my-yacht/details': mountAssignedYachtBoats,
  '/login':            mountLoginScreen,
  '/boats':            mountBoatsScreen,
  '/dashboard':        mountDashboardScreen,
  '/boat-dashboard':   mountBoatDashboardScreen,
  '/berths':           mountBerthsScreen,
  '/dock-walk':        mountDockWalkScreen,
  '/yard-storage':     mountYardStorageScreen,
  '/booking-requests': mountBookingRequestsScreen,
  '/user-management':  mountUserManagementScreen,
  '/permissions': mountPermissionsScreen,
 '/customer-directory': mountCustomerDirectoryScreen,
 '/edit-customer': mountEditCustomerScreen,
'/maintenance': mountMaintenanceScreen,
  '/client-360': mountClient360Screen,
 '/crew': mountCrewManagementScreen,
  '/reports': mountReportsScreen,
  '/operations-trends': mountOperationsTrendsScreen,
  '/pedestal-simulator': mountPedestalFoundationScreen,
  '/checklists': mountChecklistScreen,
  '/invoices': mountInvoiceScreen,
  '/shift-schedule': mountShiftScheduleScreen,
  '/procedures': mountProceduresScreen,
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
                 text-align:center;">${name} ${itUI("— coming soon")}</div>`;
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
  if (authed && isDockMaster() && !dockMasterRouteAllowed(route)) {
    location.hash = '#/dock-walk';
    return;
  }
  if (authed && isStaffWorkUser() && !staffWorkRouteAllowed(route)) { location.hash = '#/my-work'; return; }
  if (authed && ['/staff-work','/dock-walk-review'].includes(route) && !['admin','manager'].includes(store.activeRole)) { location.hash = isStaffWorkUser() ? '#/my-work' : '#/home'; return; }
  if (authed && route === '/user-management' && store.activeRole !== 'admin') { location.hash = '#/home'; return; }
  const yachtMode = authed && store.activeMarina.clientType === 'yacht_operator';
  if (yachtMode) {
    const yachtPage = route === '/account' || route === '/my-yacht/details';
    let destination = yachtPage ? `#${route}` : '#/my-yacht';
    if (store.assignedYacht && Object.hasOwn(yachtToolCleanup, route)) {
      destination = `#${route}?boatId=${store.assignedYacht.id}`;
    }
    if (location.hash !== destination) {
      location.hash = destination;
      return;
    }
  }
  if (authed && !yachtMode && (route === '/login' || route === '/my-yacht' || route === '/my-yacht/details')) {
    location.hash = '#/home';
    return;
  }

  unmountDockWalkScreen();
  unmountUSafeScreen();
  unmountYardStorageScreen();
  unmountProceduresScreen();
  unmountHomeScreen();
  unmountCustomerDirectoryScreen();
  unmountEditCustomerScreen();
  if (yachtMode) syncDrawerLayout();
  showChrome(route !== '/login' && !yachtMode);
  renderYachtNavigation(yachtMode ? route : null);
  document.querySelectorAll('.nav-item[data-route]').forEach(button => {
    button.style.display = (isDockMaster() && !dockMasterRouteAllowed(button.dataset.route)) || (isStaffWorkUser() && !staffWorkRouteAllowed(button.dataset.route)) ? 'none' : '';
  });

  const isBoatDashboard = route === '/dashboard' && location.hash.includes('boatId=');
  const highlightRoute  = route === '/dock-walk' ? '/berths' : isBoatDashboard ? '/boats' : route === '/edit-customer' ? '/customer-directory' : route;

  document.querySelectorAll('.nav-item[data-route]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.route === highlightRoute);
  });

  if (route !== '/login' && !yachtMode) renderTopBar(route);

  document.getElementById('screen')?.classList.remove('rp-screen');

  if (unmountCurrentTool) document.getElementById('modalRoot')?.replaceChildren();
  leaveToolScreen();
  unmountCurrentTool = screenCleanup[route] ?? null;
  routes[route]();
}

// ---------- Marina session ----------
let customerUnsubscribe = null;
let authReady = false;
let sessionGeneration = 0;
let baseProfile = null;

function selectionKey(uid) { return `marinacontrol.activeMarina.${uid}`; }
function clearMarinaData() {
  // Never retain another marina's or signed-out user's open details.
  document.getElementById('modalRoot')?.replaceChildren();
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
function applyMarina(marina, yacht = null) {
  stopCustomers();
  clearMarinaData();
  store.activeMarina = marina;
  store.assignedYacht = yacht;
  store.activeClientId = Number(marina?.id || 0);
  store.activeRole = marina?.role || '';
  // Existing screens using userProfile.role also see the selected role.
  store.userProfile = baseProfile ? { ...baseProfile, role: store.activeRole } : null;
  if (!marina || isDockMaster() || isStaffWorkUser()) return;
  if (marina.clientType === 'yacht_operator') {
    if (yacht) {
      store.boats = [yacht];
      store.boatsFull = [yacht];
      store.activeBoatId = yacht.id;
    }
    return;
  }
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
      : currentRoute() === '/boat-dashboard' ? '/boats' : currentRoute() === '/edit-customer' ? '/customer-directory' : currentRoute();
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
  leaveToolScreen();
  unmountDockWalkScreen();
  unmountUSafeScreen();
  unmountYardStorageScreen();
  unmountProceduresScreen();
  unmountHomeScreen();
  unmountCustomerDirectoryScreen();
  unmountEditCustomerScreen();
  resetTopBarNotifications();
  stopCustomers();
  baseProfile = null;
  store.authUser = null;
  store.userProfile = null;
  store.marinas = [];
  store.marinaSwitching = false;
  applyMarina(null);
  renderYachtNavigation(null);
  document.getElementById('screen').textContent = itUI('Loading…');
  if (!firebaseUser) { authReady = true; return; }
  try {
    const profile = await loadUserProfile(firebaseUser);
    if (!profile) throw new Error('User profile unavailable');
    const marinas = (await sessionTimeout(getMyMarinas(firebaseUser.uid, profile.userId)))
      .filter(m => Number(m.isActive) === 1);
    if (generation !== sessionGeneration) return;
    let remembered = 0;
    try { remembered = Number(localStorage.getItem(selectionKey(firebaseUser.uid)) || 0); }
    catch (error) { console.warn('Marina preference unavailable', error); }
    const marina = marinas.find(m => Number(m.id) === remembered)
      || marinas.find(m => Number(m.id) === Number(profile.clientId));
    if (!marina) throw new Error('No accessible marina is available');
    let yacht = null;
    if (marina.clientType === 'yacht_operator') {
      try {
        yacht = await sessionTimeout(resolveAssignedYacht(firebaseUser.uid, profile.userId, Number(marina.id)));
      } catch (error) {
        console.warn('Assigned yacht could not be loaded', error);
      }
      if (generation !== sessionGeneration) return;
    }
    baseProfile = profile;
    store.authUser = firebaseUser;
    store.marinas = marinas;
    applyMarina(marina, yacht);
    try { localStorage.setItem(selectionKey(firebaseUser.uid), String(marina.id)); }
    catch (error) { console.warn('Marina preference could not be saved', error); }
  } catch (error) {
    if (generation !== sessionGeneration) return;
    console.error('Marina session bootstrap failed', error);
    reportSessionError(error);
    store.authUser = null;
    applyMarina(null);
  } finally {
    if (generation === sessionGeneration) authReady = true;
  }
}

let applicationSession=null;
async function finishSignIn(firebaseUser,error=null){
  const key=firebaseUser?.uid||'';
  if(error)reportSessionError(error);
  if(firebaseUser&&authReady&&store.authUser?.uid===key&&store.activeMarina){navigate();return;}
  if(!applicationSession||applicationSession.key!==key){
    const job={key,promise:null};
    job.promise=bootstrapUser(firebaseUser).finally(()=>{if(applicationSession===job)applicationSession=null;});applicationSession=job;
  }
  await applicationSession.promise;
  if(!authReady)return;initDrawer();if(!location.hash)location.hash='#/login';navigate();
}
watchAuth((firebaseUser,error)=>{finishSignIn(firebaseUser,error).catch(error=>{reportSessionError(error);console.error('Sign-in could not finish',error);});});
window.addEventListener('marina:login-complete',()=>{finishSignIn(getCurrentAuthUser()).catch(reportSessionError);});

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
