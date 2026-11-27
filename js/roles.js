import { store } from './store.js';

export const isDockMaster = () => String(store.activeRole || store.userProfile?.role || '').toLowerCase() === 'dockmaster';
export const dockMasterRouteAllowed = route => ['/dock-walk', '/berths', '/account'].includes(route);
export const roleLabel = role => role === 'dockmaster' ? 'Dock Master' : role === 'staff' ? 'Staff (My Work)' : role === 'inspector' ? 'Inspector' : role;

export const isStaffWorkUser = () => store.activeRole === 'staff' && store.activeMarina?.clientType !== 'yacht_operator';
export const staffWorkRouteAllowed = route => ['/my-work', '/notifications', '/account'].includes(route);

export const isInspectorUser = () => store.activeRole === 'inspector' && store.activeMarina?.clientType !== 'yacht_operator';
export const inspectorRouteAllowed = route => ['/my-inspections','/notifications','/procedures','/account'].includes(route);
