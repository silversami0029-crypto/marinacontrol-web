import { decimalProduct, decimalRate, savedCurrency } from './BillingCurrency.js';

export function day(timestamp, zone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const date = new Date(Number(timestamp));
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid stay date');
  const fixed = /^GMT([+-])(\d{1,2}):(\d{2})$/.exec(zone);
  if (fixed) {
    const hours = Number(fixed[2]), minutes = Number(fixed[3]);
    if (hours > 23 || minutes > 59) throw new Error('Invalid saved stay timezone');
    const offset = (hours * 60 + minutes) * 60000 * (fixed[1] === '+' ? 1 : -1);
    return new Date(date.getTime() + offset).toISOString().slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateNumber(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Select valid stay dates');
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value)
    throw new Error('Select valid stay dates');
  return ms;
}

export function nights(arrival, departure) {
  const count = (dateNumber(departure) - dateNumber(arrival)) / 86400000;
  if (!Number.isInteger(count) || count < 1) throw new Error('Departure must be after arrival');
  return count;
}

export function stayAmount(terms) {
  const count = nights(terms.arrival, terms.departure);
  if (!['NIGHT', 'METRE_NIGHT'].includes(terms.mode)) throw new Error('Invalid charging method');
  const values = [String(count), decimalRate(terms.rate)];
  if (terms.mode === 'METRE_NIGHT') {
    if (!(Number(terms.length) > 0)) throw new Error('Vessel length is required for a per-metre rate');
    values.push(decimalRate(terms.length));
  }
  return decimalProduct(values, terms.currency);
}

export function captureTerms(booking, rate) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const terms = {
    version: 2, currency: savedCurrency(rate.currency),
    arrival: day(booking.arrivalDate, zone), departure: day(booking.departureDate, zone),
    mode: rate.mode, rate: decimalRate(rate.rate), length: String(Number(booking.vesselLength || 0)),
    zone, rateId: rate.rateId
  };
  terms.amount = stayAmount(terms);
  return terms;
}

export function parseTerms(json) {
  const terms = typeof json === 'string' ? JSON.parse(json) : { ...json };
  if (![1, 2].includes(terms?.version) || !terms.currency || !terms.zone || !terms.rateId)
    throw new Error('Saved stay price is missing or invalid');
  terms.currency = savedCurrency(terms.currency);
  // Validate the saved timezone as well as the decimal calculation.
  day(Date.now(), terms.zone);
  if (Number(stayAmount(terms)) !== Number(terms.amount)) throw new Error('Saved stay price does not match its calculation');
  return terms;
}

export function termsMatch(terms, booking) {
  return terms.arrival === day(booking.arrivalDate, terms.zone)
    && terms.departure === day(booking.departureDate, terms.zone);
}

export function termsForDates(terms, booking) {
  const result = { ...terms, arrival: day(booking.arrivalDate, terms.zone), departure: day(booking.departureDate, terms.zone) };
  result.amount = stayAmount(result);
  return result;
}

export function selectRate(rates, berthId, arrival) {
  return rates.filter(r => (Number(r.berthId) === Number(berthId) || Number(r.berthId) === 0)
    && r.effectiveDate <= arrival).sort((a, b) =>
    Number(Number(b.berthId) === Number(berthId)) - Number(Number(a.berthId) === Number(berthId))
    || b.effectiveDate.localeCompare(a.effectiveDate) || Number(b.createdAt) - Number(a.createdAt))[0] || null;
}

export function stayDescription(terms, berth) {
  return `Berthing — ${berth}\n${terms.arrival} to ${terms.departure} (departure day excluded)\n`
    + `${nights(terms.arrival, terms.departure)} nights × `
    + (terms.mode === 'METRE_NIGHT' ? `${terms.length} m × ` : '')
    + `${terms.currency} ${terms.rate}${terms.mode === 'METRE_NIGHT' ? '/m/night' : '/night'} = ${terms.currency} ${terms.amount}`;
}
