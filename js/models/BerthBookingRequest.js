// js/models/BerthBookingRequest.js
export class BerthBookingRequest {
  constructor(raw = {}) {
    this._docId             = raw._docId ?? null;

    this.id                 = Number(raw.id ?? 0);
    this.requestUuid        = raw.requestUuid   || '';
    this.clientId           = Number(raw.clientId ?? 0);
    this.source             = raw.source        || 'WHATSAPP';

    this.senderName         = raw.senderName    || '';
    this.senderPhone        = raw.senderPhone   || '';

    this.vesselName         = raw.vesselName    || '';
    this.vesselLength       = raw.vesselLength    != null ? Number(raw.vesselLength)    : null;
    this.vesselBeam         = raw.vesselBeam      != null ? Number(raw.vesselBeam)      : null;
    this.vesselDraft        = raw.vesselDraft     != null ? Number(raw.vesselDraft)     : null;
    this.vesselAirDraft     = raw.vesselAirDraft  != null ? Number(raw.vesselAirDraft)  : null;

    this.arrivalDate        = raw.arrivalDate   != null ? Number(raw.arrivalDate)   : null;
    this.departureDate      = raw.departureDate != null ? Number(raw.departureDate) : null;
    this.requestedBerthId   = raw.requestedBerthId != null ? Number(raw.requestedBerthId) : null;

    this.message            = raw.message       || '';
    this.status             = (raw.status || 'NEW').toUpperCase();
    this.externalMessageId  = raw.externalMessageId || '';
    this.receivedAt         = Number(raw.receivedAt ?? 0);
  }
}