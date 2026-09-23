// js/store.js
export const store = {
  // Auth
  authUser:       null,   // Firebase user object
  userProfile:    null,   // { userId, name, email, role, clientId, firebaseUid }

  // Data
  boats:          [],
  boatsFull:      [],
  searchQuery:    '',
  activeClientId: 0,
  syncTime:       0,
  customers:     [],          // array of customer objects
  customerCache:  new Map(),

  // Subscribers (screens re-render on emit)
  listeners: new Set(),
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { this.listeners.forEach(fn => fn(this)); }
};