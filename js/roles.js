import { store } from './store.js';

export const isDockMaster = () => String(store.activeRole || store.userProfile?.role || '').toLowerCase() === 'dockmaster';
export const dockMasterRouteAllowed = route => ['/dock-walk', '/berths', '/account'].includes(route);
export const roleLabel = role => role === 'dockmaster' ? 'Dock Master' : role;
