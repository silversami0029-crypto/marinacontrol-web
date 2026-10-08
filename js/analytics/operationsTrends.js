import { utilitySegments } from './utilityConsumption.js';
const DAY = 86400000;
export function toMs(v) {
  if (v == null) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v === 'object' && Number.isFinite(v.seconds)) return v.seconds * 1000;
  if (typeof v === 'string' && !/^\d+$/.test(v)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 0;
    const n = Date.parse(v + 'T00:00:00Z');
    return Number.isFinite(n) && new Date(n).toISOString().slice(0,10) === v ? n : 0;
  }
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}
export function monthStart(time, offset = 0) {
  const d = new Date(time);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1);
}
const day = n => { const d = new Date(n); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
export function calculateTrends(clientId, start, records, options = {}) {
  const from = day(options.from ?? start), end = day(options.end ?? monthStart(start,6));
  start = monthStart(from);
  const last = new Date(end-1), first = new Date(start);
  const count = (last.getUTCFullYear()-first.getUTCFullYear())*12 + last.getUTCMonth()-first.getUTCMonth()+1;
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(end) || end <= from || count > 60) throw new Error('Invalid date range');
  const r = { months: Array.from({length:count}, (_,i) => monthStart(start,i)),
    booked: Array(count).fill(0), electricity: Array(count).fill(0), water: Array(count).fill(0),
    maintenance: Array(count).fill(0), paid: {}, electricityPairs: Array(count).fill(0), waterPairs: Array(count).fill(0),
    excludedBookings:0, excludedReadings:0, meterDrops:0, crossMonthPairs:0, excludedMaintenance:0, excludedInvoices:0 };
  const tenant = list => (list || []).filter(x => Number(x.clientId) === clientId);
  const idx = n => r.months.findIndex((m,i) => n >= from && n < end && n >= m && n < monthStart(start,i+1));
  const validBerths = new Set(tenant(records.berths).map(x => Number(x.id)));
  const occupied = new Set();
  for (const b of tenant(records.berth_bookings)) {
    if (!['CONFIRMED','CHECKED_IN','CHECKED_OUT'].includes(String(b.status).trim().toUpperCase())) continue;
    const a = toMs(b.arrivalDate), z = toMs(b.departureDate);
    if (a <= 0 || z <= a || !validBerths.has(Number(b.berthId))) { r.excludedBookings++; continue; }
    for (let t = Math.max(day(a), from), limit = Math.min(day(z), end); t < limit; t += DAY) {
      const key = b.berthId + ':' + t;
      if (!occupied.has(key)) { occupied.add(key); r.booked[idx(t)]++; }
    }
  }
  const utilities = utilitySegments(clientId, records.utility_readings);
  r.utilityIssues = utilities.issues;
  r.instantaneousReadings = utilities.instantaneous.filter(v=>idx(v.at)>=0);
  r.mixedModeReadings = utilities.issues.filter(v=>v.reason==='MIXED_MODES' && idx(v.at)>=0).length;
  for (const issue of utilities.issues) {
    if (idx(issue.at)<0) continue;
    if (issue.informational) continue;
    r.excludedReadings++;
    if (issue.reason==='METER_DROP') r.meterDrops++;
  }
  for (const segment of utilities.segments) {
    const i = idx(segment.at); if (i<0) continue;
    if (segment.from && monthStart(segment.at)!==monthStart(segment.from.at)) r.crossMonthPairs++;
    const metric = segment.type==='WATER' ? 'water' : 'electricity';
    r[metric][i] += segment.quantity;
    r[metric+'Pairs'][i]++;
  }
  for (const v of tenant(records.maintenance)) {
    const state = v.completed === true || String(v.status).toUpperCase() === 'COMPLETED' ? 'COMPLETED' : String(v.status).toUpperCase() === 'DEFERRED' ? 'DEFERRED' : 'OPEN';
    if (options.status && options.status !== 'ALL' && state !== options.status) continue;
    // Android stores the scheduled maintenance date as yyyy-MM-dd.
    const time = typeof v.date === 'string' ? toMs(v.date) : 0;
    if (time <= 0) { r.excludedMaintenance++; continue; }
    const i = idx(time); if (i >= 0) r.maintenance[i]++;
  }
  for (const v of tenant(records.invoices)) {
    if (String(v.status || '').trim().toUpperCase() !== 'PAID') continue;
    const time = toMs(v.issueDate), amount = v.amount == null || v.amount === '' ? NaN : Number(v.amount);
    if (time <= 0 || !Number.isFinite(amount) || amount < 0) { r.excludedInvoices++; continue; }
    const i = idx(time); if (i < 0) continue;
    const raw = String(v.currency || '').trim().toUpperCase();
    const currency = /^[A-Z]{3}$/.test(raw) ? raw : 'UNSPECIFIED';
    if (!r.paid[currency]) r.paid[currency] = Array(count).fill(0);
    r.paid[currency][i] += amount;
  }
  return r;
}
