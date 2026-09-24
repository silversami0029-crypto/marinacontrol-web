// js/models/Marina.js
// Represents a client (marina) the user has access to via user_marina_memberships

export class Marina {
  constructor(raw = {}) {
    this.id              = Number(raw.id ?? 0);
    this.name            = raw.name || `Marina ${this.id}`;
    this.countryCode     = (raw.countryCode || '').toUpperCase() || null;
    this.slug            = raw.slug || '';
    this.isActive        = Number(raw.isActive ?? 0);
    this.organizationId  = Number(raw.organizationId ?? 0);
    this.role            = raw.role || 'staff';   // from membership
    this._membership     = raw._membership || null;
  }
}