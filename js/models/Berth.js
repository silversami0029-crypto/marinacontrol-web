// js/models/Berth.js
export class Berth {
  constructor(raw = {}) {
    this._docId         = raw._docId ?? null;

    this.id             = Number(raw.id ?? 0);
    this.clientId       = Number(raw.clientId ?? 0);
    this.dockName       = raw.dockName     || '';
    this.berthNumber    = raw.berthNumber  || '';
    this.length         = Number(raw.length ?? 0);
    this.width          = Number(raw.width  ?? 0);
    this.depth          = Number(raw.depth  ?? 0);
    this.maxAirDraft    = Number(raw.maxAirDraft ?? 0);
    this.hasElectric    = !!raw.hasElectric;
    this.hasWater       = !!raw.hasWater;
    this.status         = (raw.status || 'AVAILABLE').toUpperCase();

    this.boatId           = raw.boatId != null ? Number(raw.boatId) : null;
    this.assignedBoatName = raw.assignedBoatName || null;
    this.assignedDate     = raw.assignedDate     != null ? Number(raw.assignedDate)     : null;
    this.expectedEndDate  = raw.expectedEndDate  != null ? Number(raw.expectedEndDate)  : null;
    this.actualEndDate    = raw.actualEndDate    != null ? Number(raw.actualEndDate)    : null;

    this.lockedBy       = Number(raw.lockedBy ?? 0);
    this.lockedAt       = Number(raw.lockedAt ?? 0);

    this.photoPath      = raw.photoPath     || null;
    this.voiceNotePath  = raw.voiceNotePath || null;

    this.lastModified   = Number(raw.lastModified ?? 0);
    this.lastModifiedBy = raw.lastModifiedBy || '';
    this.syncedAt       = Number(raw.syncedAt ?? 0);
  }

  hasPhoto()     { return !!this.photoPath     && this.photoPath.length     > 0; }
  hasVoiceNote() { return !!this.voiceNotePath && this.voiceNotePath.length > 0; }
}