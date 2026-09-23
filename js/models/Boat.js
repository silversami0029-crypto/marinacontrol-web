// js/models/Boat.js
export class Boat {
  constructor(raw = {}) {
    this._docId = raw._docId ?? null;   // Firestore document id (for writes)
    this.id             = Number(raw.id ?? 0);
    this.customerId     = Number(raw.customerId ?? 0);
    this.assignedTo     = Number(raw.assignedTo ?? 0);
    this.clientId       = Number(raw.clientId ?? 0);
    this.lastModified   = Number(raw.lastModified ?? 0);
    this.lastModifiedBy = raw.lastModifiedBy ?? null;
    this.syncedAt       = Number(raw.syncedAt ?? 0);

    this.name           = raw.name ?? '';
    this.mmsi           = raw.mmsi ?? '';
    this.isSample       = raw.isSample ?? true;
    this.hin            = raw.hin ?? 'UNKNOWN-HIN';
    this.port           = raw.port ?? '';
    this.status         = raw.status ?? 'In Service';
    this.isActive       = raw.isActive ?? false;
    this.type           = raw.type ?? 'motor';
    this.engineType     = raw.engineType ?? 'Unknown';
    this.engineHours    = Number(raw.engineHours ?? 0);

    this.voiceNotePath  = raw.voiceNotePath ?? null;
    this.photoPath      = raw.photoPath    ?? null;

    this.length         = Number(raw.length   ?? 0);
    this.beam           = Number(raw.beam     ?? 0);
    this.draft          = Number(raw.draft    ?? 0);
    this.airDraft       = Number(raw.airDraft ?? 0);

    this.customerName   = raw.customerName ?? null;
  }

  hasVoiceNote() { return !!this.voiceNotePath && this.voiceNotePath.length > 0; }
  hasPhoto()     { return !!this.photoPath     && this.photoPath.length     > 0; }

  initials() {
    if (!this.name) return '?';
    return this.name.length >= 2
      ? this.name.substring(0, 2).toUpperCase()
      : this.name.substring(0, 1).toUpperCase();
  }
}