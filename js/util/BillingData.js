import {createYardInvoiceThroughBilling} from './YardInvoiceBilling.js';
import { db } from '../firebase.js';
import { store } from '../store.js';
import {
  collection, doc, getDocFromServer, getDocsFromServer, query, where,
  runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { countryCurrency, currencyCode, decimalRate, savedCurrency, invoiceAmount } from './BillingCurrency.js';
import { day, captureTerms, parseTerms, selectRate, termsForDates, termsMatch, nights } from './BerthingCalculator.js';

const ELIGIBLE = new Set(['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']);
export function checkBillingClient(clientId) {
  if (!(Number(clientId) > 0) || Number(store.activeClientId) !== Number(clientId))
    throw new Error('Active marina changed. Close and reopen this screen.');
}

async function debug(operation, clientId, action) {
  const started = performance.now();
  console.debug('[BERTHING_DEBUG] START', { operation, clientId });
  try {
    const result = await action();
    console.debug('[BERTHING_DEBUG] SUCCESS', { operation, clientId, elapsedMs: Math.round(performance.now() - started) });
    return result;
  } catch (error) {
    console.error('[BERTHING_DEBUG] FAILED', { operation, clientId, code: error.code, elapsedMs: Math.round(performance.now() - started) }, error);
    throw error;
  }
}

export async function marinaCurrency(clientId) {
  checkBillingClient(clientId);
  const snap = await getDocFromServer(doc(db, 'clients', String(clientId)));
  checkBillingClient(clientId);
  if (!snap.exists()) throw new Error('Marina record not found');
  return countryCurrency(snap.data().countryCode || snap.data().country_code);
}

export async function loadBerthingRates(clientId) {
  checkBillingClient(clientId);
  return debug('LOAD_RATES', clientId, async () => {
    const snap = await getDocsFromServer(query(collection(db, 'berthing_rates'), where('clientId', '==', Number(clientId))));
    checkBillingClient(clientId);
    return snap.docs.map(d => {
      const rate = d.data();
      if (rate.rateId !== d.id || Number(rate.clientId) !== Number(clientId)
          || !['NIGHT', 'METRE_NIGHT'].includes(rate.mode) || !/^\d{4}-\d{2}-\d{2}$/.test(rate.effectiveDate))
        throw new Error('Invalid berthing rate record');
      return { ...rate, currency: savedCurrency(rate.currency), rate: decimalRate(rate.rate) };
    });
  });
}

export async function saveBerthingRate(clientId, fields) {
  checkBillingClient(clientId);
  const rateId = crypto.randomUUID();
  const currency = await marinaCurrency(clientId);
  if (fields.currency !== currency) throw new Error('Marina currency changed. Reopen rates.');
  nights(fields.effectiveDate, day(Date.parse(fields.effectiveDate + 'T00:00:00Z') + 86400000, 'UTC'));
  const rate = {
    rateId, clientId: Number(clientId), berthId: Number(fields.berthId),
    mode: fields.mode, rate: decimalRate(fields.rate), currency,
    effectiveDate: fields.effectiveDate, createdAt: Date.now()
  };
  if (!Number.isSafeInteger(rate.berthId) || rate.berthId < 0 || !['NIGHT', 'METRE_NIGHT'].includes(rate.mode))
    throw new Error('Invalid berthing rate');
  await debug('SAVE_RATE', clientId, () => runTransaction(db, async tx => {
    checkBillingClient(clientId);
    const ref = doc(db, 'berthing_rates', rateId);
    const prior = await tx.get(ref);
    if (prior.exists()) throw new Error('Rate identity already exists. Retry.');
    tx.set(ref, rate);
  }));
}

export async function listBerthingBookings(clientId, berthId) {
  checkBillingClient(clientId);
  const snap = await getDocsFromServer(query(collection(db, 'berth_bookings'), where('clientId', '==', Number(clientId))));
  checkBillingClient(clientId);
  return snap.docs.map(d => ({ ...d.data(), _docId: d.id }))
    .filter(b => Number(b.berthId) === Number(berthId) && ELIGIBLE.has(b.status))
    .sort((a, b) => Number(b.arrivalDate) - Number(a.arrivalDate));
}

export function claimRef(clientId, uuid) {
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(String(uuid || ''))) throw new Error('Invalid booking identity');
  return doc(db, 'berthing_invoices', `${clientId}_${uuid}`);
}

export async function prepareStayPrice(clientId, booking) {
  checkBillingClient(clientId);
  const uuid = booking.bookingUuid;
  const [live, claim] = await Promise.all([
    getDocFromServer(doc(db, 'berth_bookings', uuid)), getDocFromServer(claimRef(clientId, uuid))
  ]);
  checkBillingClient(clientId);
  if (!live.exists() || Number(live.data().clientId) !== Number(clientId)) throw new Error('Booking no longer exists at this marina');
  if (claim.exists()) {
    const invoiceDocId = claim.data().invoiceDocId;
    if (!invoiceDocId) throw new Error('This stay is already invoiced. Review it in Invoices.');
    const invoice = await getDocFromServer(doc(db, 'invoices', invoiceDocId));
    checkBillingClient(clientId);
    if (!invoice.exists() || Number(invoice.data().clientId) !== Number(clientId))
      throw new Error('This stay is already invoiced, but its invoice could not be loaded. Review Invoices.');
    return { invoice: { ...invoice.data(), _docId: invoice.id }, booking: live.data() };
  }
  const current = { ...live.data(), _docId: live.id };
  if (!ELIGIBLE.has(current.status)) throw new Error('Only confirmed or checked-in/out stays can be invoiced');
  let terms;
  if (current.berthingTerms) terms = termsForDates(parseTerms(current.berthingTerms), current);
  else {
    const [rates, currency] = await Promise.all([loadBerthingRates(clientId), marinaCurrency(clientId)]);
    const rate = selectRate(rates, current.berthId, day(current.arrivalDate));
    if (!rate) throw new Error('No applicable berthing rate. Set a rate effective on or before arrival.');
    if (rate.currency !== currency) throw new Error(`The applicable rate is in ${rate.currency}. Set a ${currency} rate before pricing this stay. Existing amounts are not converted.`);
    terms = captureTerms(current, rate);
  }
  return { booking: current, terms };
}

export async function saveStayPrice(clientId, booking, terms) {
  const json = JSON.stringify(terms);
  parseTerms(json);
  await debug('SAVE_STAY_PRICE', clientId, () => runTransaction(db, async tx => {
    checkBillingClient(clientId);
    const ref = doc(db, 'berth_bookings', booking.bookingUuid);
    const [live, claim] = await Promise.all([tx.get(ref), tx.get(claimRef(clientId, booking.bookingUuid))]);
    if (claim.exists()) throw new Error('This stay is already invoiced. Reopen its invoice.');
    if (!live.exists() || !sameStay(live.data(), booking, clientId)
        || (live.data().berthingTerms || null) !== (booking.berthingTerms || null))
      throw new Error('Booking changed. Reopen berthing charges.');
    if (!termsMatch(terms, live.data())) throw new Error('Stay dates changed');
    tx.update(ref, { berthingTerms: json, lastModified: Date.now(), lastModifiedBy: String(store.userProfile?.userId || 0), syncTime: serverTimestamp() });
  }));
  return { ...booking, berthingTerms: json };
}

function sameStay(live, expected, clientId) {
  return Number(live.clientId) === Number(clientId) && ELIGIBLE.has(live.status)
    && live.bookingUuid === expected.bookingUuid && Number(live.berthId) === Number(expected.berthId)
    && Number(live.boatId) === Number(expected.boatId)
    && Number(live.arrivalDate) === Number(expected.arrivalDate)
    && Number(live.departureDate) === Number(expected.departureDate);
}

// Use the same UUID v3 identity as Android UUID.nameUUIDFromBytes for a vessel assignment.
export function assignmentUuid(text) {
  const bytes = new TextEncoder().encode(text);
  const size = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(size);
  buffer.set(bytes); buffer[bytes.length] = 128;
  const view = new DataView(buffer.buffer);
  view.setUint32(size - 8, bytes.length * 8, true);
  const shifts = [7,12,17,22, 5,9,14,20, 4,11,16,23, 6,10,15,21];
  let state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let offset = 0; offset < size; offset += 64) {
    let [a,b,c,d] = state;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (b & c) | (~b & d); g = i; }
      else if (i < 32) { f = (d & b) | (~d & c); g = (5*i+1)%16; }
      else if (i < 48) { f = b ^ c ^ d; g = (3*i+5)%16; }
      else { f = c ^ (b | ~d); g = (7*i)%16; }
      const sum = (a + f + Math.floor(Math.abs(Math.sin(i+1))*4294967296) + view.getUint32(offset+g*4,true)) | 0;
      const shift = shifts[Math.floor(i/16)*4+i%4];
      const next = (b + ((sum << shift) | (sum >>> (32-shift)))) | 0;
      a=d; d=c; c=b; b=next;
    }
    state = state.map((value, i) => (value + [a,b,c,d][i]) | 0);
  }
  const out = new Uint8Array(16), result = new DataView(out.buffer);
  state.forEach((value,i) => result.setInt32(i*4,value,true));
  out[6] = (out[6]&15)|48; out[8] = (out[8]&63)|128;
  const hex = [...out].map(b => b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function recordAssignedStay(clientId, berth, arrival, departure) {
  checkBillingClient(clientId);
  nights(arrival, departure);
  if (!Number(berth.boatId) || !Number(berth.assignedDate)) throw new Error('Assign a vessel with an assignment date before recording a stay');
  const uuid = assignmentUuid(`WALK_IN:${clientId}:${berth.id}:${berth.boatId}:${berth.assignedDate}`);
  const existing = await listBerthingBookings(clientId, berth.id);
  const start = new Date(arrival + 'T00:00:00').getTime(), end = new Date(departure + 'T00:00:00').getTime();
  if (existing.some(b => b.status !== 'CHECKED_OUT' && Number(b.arrivalDate) < end && Number(b.departureDate) > start))
    throw new Error('An existing booking overlaps this stay. Select that booking instead.');
  const boats = await getDocsFromServer(query(collection(db, 'boats'), where('clientId', '==', Number(clientId))));
  const boat = boats.docs.find(d => Number(d.data().id) === Number(berth.boatId))?.data();
  if (!boat) throw new Error('Assigned vessel not found');
  let berthRef;
  if (berth._docId) berthRef = doc(db, 'berths', berth._docId);
  else {
    const berths = await getDocsFromServer(query(collection(db, 'berths'), where('clientId', '==', Number(clientId)), where('id', '==', Number(berth.id))));
    if (berths.size !== 1) throw new Error('Berth identity is ambiguous');
    berthRef = berths.docs[0].ref;
  }
  const now = Date.now();
  const booking = {
    bookingUuid: uuid, clientId: Number(clientId), berthId: Number(berth.id), boatId: Number(boat.id),
    customerId: Number(boat.customerId || 0), vesselName: boat.name || '', vesselLength: Number(boat.length || 0),
    vesselBeam: Number(boat.beam || 0), vesselDraft: Number(boat.draft || 0), arrivalDate: start, departureDate: end,
    status: 'CHECKED_IN', source: 'WALK_IN', createdAt: now, lastModified: now,
    lastModifiedBy: String(store.userProfile?.userId || 0), syncedAt: 0, berthingTerms: null
  };
  await debug('CREATE_WALK_IN', clientId, () => runTransaction(db, async tx => {
    checkBillingClient(clientId);
    const ref = doc(db, 'berth_bookings', uuid);
    const [live, prior] = await Promise.all([tx.get(berthRef), tx.get(ref)]);
    if (prior.exists()) throw new Error('This assignment already has a stay. Reopen berthing charges.');
    if (!live.exists() || Number(live.data().clientId) !== Number(clientId)
        || Number(live.data().boatId) !== Number(berth.boatId) || Number(live.data().assignedDate) !== Number(berth.assignedDate))
      throw new Error('Berth assignment changed. Reopen berth details.');
    tx.set(ref, { ...booking, syncTime: serverTimestamp() });
  }));
  return { ...booking, _docId: uuid };
}

// A single transaction claims the stay/utility charges and creates the invoice.
export async function createBillingInvoice(clientId, fields, opts = {}) {
  checkBillingClient(clientId);
  if(opts.yardPackageInvoice)return createYardInvoiceThroughBilling(clientId,fields,opts);
  const invoices = await getDocsFromServer(query(collection(db, 'invoices'), where('clientId', '==', Number(clientId))));
  let max = 0;
  invoices.forEach(d => { const id = Number(d.data().id); if (Number.isInteger(id) && id > max && id < 2147483647) max = id; });
  const id = max + 1;
  if (id >= 2147483647) throw new Error('Invoice ID limit reached');
  const invoiceRef = doc(db, 'invoices', `${clientId}_${id}`);
  const chargeIds = [...new Set(opts.utilityChargeDocIds || [])];
  if (chargeIds.length > 450) throw new Error('Too many utility charges for one invoice');
  const currency = currencyCode(fields.currency);
  const amount = invoiceAmount(String(fields.amount), currency);
  const now = Date.now();
  const data = { ...fields, id, clientId: Number(clientId), currency, amount, createdAt: now, lastModified: now, syncedAt: 0 };
  await debug('CREATE_INVOICE', clientId, () => runTransaction(db, async tx => {
    checkBillingClient(clientId);
    const prior = await tx.get(invoiceRef);
    if (prior.exists()) throw new Error('Another invoice was just created. Press Save again.');
    const chargeRefs = chargeIds.map(key => doc(db, 'utility_charges', key));
    const charges = await Promise.all(chargeRefs.map(ref => tx.get(ref)));
    for (const charge of charges) {
      const c = charge.data();
      if (!charge.exists() || Number(c.clientId) !== Number(clientId) || Number(c.boatId) !== Number(fields.boatId)
          || c.billed === true || savedCurrency(c.currency) !== currency)
        throw new Error('Utility charges changed or were already invoiced. Reopen the utility invoice.');
    }
    if (charges.length) {
      const sum = charges.reduce((total, snap) => total + Number(snap.data().amount || 0), 0);
      const expected = Number(sum.toFixed(new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits));
      if (expected !== amount) throw new Error('Utility amount changed. Reopen the utility invoice.');
    }
    let claim;
    if (opts.berthingBooking) {
      const expected = opts.berthingBooking;
      const bookingRef = doc(db, 'berth_bookings', expected.bookingUuid);
      claim = claimRef(clientId, expected.bookingUuid);
      const [live, billed] = await Promise.all([tx.get(bookingRef), tx.get(claim)]);
      if (billed.exists()) throw new Error('This stay is already invoiced. Open the existing invoice.');
      if (!live.exists() || !sameStay(live.data(), expected, clientId)
          || Number(live.data().boatId) !== Number(fields.boatId)
          || live.data().berthingTerms !== expected.berthingTerms)
        throw new Error('Booking dates or price changed. Reopen berthing charges.');
      const terms = parseTerms(live.data().berthingTerms);
      if (!termsMatch(terms, live.data()) || terms.currency !== currency || Number(terms.amount) !== amount)
        throw new Error('Stay amount does not match the agreed price');
      data.berthingBookingUuid = expected.bookingUuid;
      data.berthingTerms = expected.berthingTerms;
      data.category = 'BERTH';
      data.invoiceDocId = invoiceRef.id;
    }
    tx.set(invoiceRef, { ...data, syncTime: serverTimestamp() });
    if (claim) tx.set(claim, { ...data, syncTime: serverTimestamp() });
    charges.forEach((charge, index) => tx.update(chargeRefs[index], {
      billed: true, invoiceId: id, invoiceDocId: invoiceRef.id, billedAt: now, currency
    }));
  }));
  return { ...data, _docId: invoiceRef.id };
}
