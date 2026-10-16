import { store } from '../store.js';
import { t as tr, getLocale as uiLocale } from '../i18n.js';
import { wireBookingDatePicker } from '../ui/BookingDatePicker.js';
import { toast } from '../ui/toast.js';
import { money, savedCurrency } from '../util/BillingCurrency.js';
import { day, selectRate, captureTerms, stayDescription, nights } from '../util/BerthingCalculator.js';
import {
  checkBillingClient, marinaCurrency, loadBerthingRates, saveBerthingRate,
  listBerthingBookings, prepareStayPrice, saveStayPrice, recordAssignedStay
} from '../util/BillingData.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// Reuse the existing sheet, form, field, button and detail classes.
function openSheet(title, body, onClose) {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet billing-sheet';
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div style="position:relative;display:flex;align-items:center;min-height:48px;flex-shrink:0;">
      <div class="sheet-title" style="flex:1;margin:0;padding:12px 48px;text-align:center;">${escapeHtml(tr(title))}</div>
      <button type="button" data-billing-close aria-label="${tr('Close')}" style="position:absolute;inset-inline-end:0;top:2px;display:grid;place-items:center;width:44px;height:44px;padding:0;border:0;background:transparent;color:#F5F7F9;cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    ${body}`;
  document.getElementById('modalRoot').append(backdrop, sheet);
  const calendars = [...sheet.querySelectorAll('input[type="date"]')].map(input =>
    wireBookingDatePicker(input, {
      label: input.labels?.[0]?.textContent || tr('Select date'),
      locale: uiLocale()
    })
  );
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    calendars.forEach(calendar => calendar.close());
    onClose?.();
    backdrop.classList.remove('is-open'); sheet.classList.remove('is-open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 220);
  };
  backdrop.addEventListener('click', close);
  sheet.querySelectorAll('[data-billing-close]').forEach(button => button.addEventListener('click', close));
  requestAnimationFrame(() => { if (!closed) { backdrop.classList.add('is-open'); sheet.classList.add('is-open'); } });
  return { sheet, close, isOpen: () => !closed };
}

function showError(sheet, error) {
  console.error('[BERTHING_DEBUG] UI_FAILED', error);
  const el = sheet.querySelector('[data-billing-error]');
  el.hidden = false;
  el.textContent = error.code === 'permission-denied'
    ? 'Access to berthing data is blocked (PERMISSION_DENIED). Check this marina’s Firestore rules.'
    : error.message || 'Unable to complete this action';
}

export function showBerthingRates(berth) {
  const clientId = Number(store.activeClientId);
  const ui = openSheet('Berthing Rates', `
    <form class="add-form" novalidate>
      <div class="add-scroll">
        <div class="add-section-sub" data-currency>${tr('Loading…')}</div>
        <p class="add-section-sub">${tr('The arrival date selects the rate. A berth-specific rate takes priority over the marina default.')}</p>
        <label class="add-label" for="br-scope">${tr('Applies to')}</label>
        <select class="add-input add-select" id="br-scope">
          <option value="${Number(berth.id)}">${tr('This berth only')}</option>
          <option value="0">${tr('Marina default')}</option>
        </select>
        <label class="add-label" for="br-method">${tr('Charging method')}</label>
        <select class="add-input add-select" id="br-method">
          <option value="NIGHT">${tr('Fixed amount per night')}</option>
          <option value="METRE_NIGHT">${tr('Per metre of vessel length per night')}</option>
        </select>
        <label class="add-label" for="br-rate" data-rate-label>${tr('Rate')}</label>
        <input class="add-input" id="br-rate" type="number" min="0" step="any" inputmode="decimal" placeholder="${tr('Enter rate')}">
        <label class="add-label" for="br-date">${tr('Effective from')}</label>
        <input class="add-input" id="br-date" type="date" value="${day(Date.now())}">
        <div class="add-label">${tr('Saved rates')}</div>
        <div class="add-section-sub" data-saved-rates style="white-space:pre-wrap;">${tr('Loading…')}</div>
        <div class="add-error" data-billing-error role="alert" hidden></div>
        <button type="button" class="md-close-btn" data-retry hidden>${tr('Retry')}</button>
      </div>
      <button type="submit" class="add-save" disabled>${tr('Save Rate')}</button>
    </form>`);
  const { sheet } = ui;
  let currency;
  const save = sheet.querySelector('[type=submit]');
  const load = async () => {
    save.disabled = true;
    sheet.querySelector('[data-retry]').hidden = true;
    sheet.querySelector('[data-billing-error]').hidden = true;
    try {
      const [code, rates] = await Promise.all([marinaCurrency(clientId), loadBerthingRates(clientId)]);
      if (!ui.isOpen()) return;
      currency = code;
      sheet.querySelector('[data-currency]').textContent = `${tr('Berthing Rates')} · ${currency}`;
      sheet.querySelector('[data-rate-label]').textContent = `${tr('Rate')} (${currency})`;
      sheet.querySelector('[data-saved-rates]').textContent = rates
        .filter(r => Number(r.berthId) === 0 || Number(r.berthId) === Number(berth.id))
        .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate) || Number(b.createdAt) - Number(a.createdAt))
        .map(r => `${tr(Number(r.berthId) === 0 ? 'Marina default' : 'This berth')} · ${r.effectiveDate} · ${r.currency} ${r.rate}${r.mode === 'METRE_NIGHT' ? '/m/night' : '/night'}`)
        .join('\n') || tr('No berthing rate set');
      save.disabled = false;
    } catch (error) {
      if (!ui.isOpen()) return;
      showError(sheet, error);
      sheet.querySelector('[data-retry]').hidden = false;
      sheet.querySelector('[data-saved-rates]').textContent = tr('Saved rates could not be loaded.');
    }
  };
  sheet.querySelector('[data-retry]').addEventListener('click', load);
  sheet.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); save.disabled = true;
    try {
      checkBillingClient(clientId);
      await saveBerthingRate(clientId, {
        berthId: Number(sheet.querySelector('#br-scope').value),
        mode: sheet.querySelector('#br-method').value,
        rate: sheet.querySelector('#br-rate').value.trim(),
        effectiveDate: sheet.querySelector('#br-date').value, currency
      });
      if (!ui.isOpen()) return;
      sheet.querySelector('#br-rate').value = '';
      toast(tr('Berthing rate saved'), { kind: 'success' });
      await load();
    } catch (error) { if (ui.isOpen()) { showError(sheet, error); save.disabled = false; } }
  });
  load();
}

export async function showBerthingCharges(berth) {
  const clientId = Number(store.activeClientId);
  const ui = openSheet('Berthing Charges / Invoice', `
    <div class="add-form">
      <div class="add-scroll" data-stays>${tr('Loading…')}</div>
      <div class="add-error" data-billing-error role="alert" hidden></div>
    </div>`);
  try {
    const bookings = await listBerthingBookings(clientId, berth.id);
    if (!ui.isOpen()) return;
    const body = ui.sheet.querySelector('[data-stays]');
    body.textContent = '';
    for (const booking of bookings) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'sheet-item';
      button.textContent = `${booking.vesselName || tr('Vessel')} · ${day(booking.arrivalDate)} → ${day(booking.departureDate)} · ${tr(booking.status)}`;
      button.addEventListener('click', () => { ui.close(); showStayReview(berth, booking, clientId); });
      body.append(button);
    }
    if (Number(berth.boatId) > 0) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'view-berth-btn';
      button.textContent = tr('Add stay for currently assigned vessel');
      button.addEventListener('click', () => { ui.close(); showAssignedStay(berth, clientId); });
      body.append(button);
    } else if (!bookings.length) body.textContent = tr('Create a booking or assign a vessel first');
  } catch (error) { if (ui.isOpen()) showError(ui.sheet, error); }
}

async function showStayReview(berth, booking, clientId) {
  const ui = openSheet('Review berthing price', `
    <form class="add-form" novalidate>
      <div class="add-scroll">
        <div class="add-section-sub" data-price style="white-space:pre-wrap;">${tr('Loading…')}</div>
        <p class="add-section-sub">${tr('Utilities are separate. Confirm this is the agreed price. This does not send a WhatsApp quote or collect payment.')}</p>
        <div class="add-error" data-billing-error role="alert" hidden></div>
      </div>
      <button type="submit" class="add-save" disabled>${tr('Save agreed price / Create Invoice')}</button>
    </form>`);
  let prepared;
  const save = ui.sheet.querySelector('[type=submit]');
  try {
    prepared = await prepareStayPrice(clientId, booking);
    if (!ui.isOpen()) return;
    if (prepared.invoice) {
      ui.close();
      const { showInvoiceDetail } = await import('./InvoiceDetailSheet.js');
      showInvoiceDetail(prepared.invoice);
      return;
    }
    ui.sheet.querySelector('[data-price]').textContent = stayDescription(prepared.terms, berth.berthNumber);
    save.disabled = false;
  } catch (error) { if (ui.isOpen()) showError(ui.sheet, error); }
  ui.sheet.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault(); save.disabled = true;
    try {
      const saved = await saveStayPrice(clientId, prepared.booking, prepared.terms);
      checkBillingClient(clientId);
      if (!ui.isOpen()) return;
      ui.close();
      const { showAddInvoiceSheet } = await import('./AddInvoiceSheet.js');
      await showAddInvoiceSheet({
        clientId, boatId: saved.boatId, customerId: saved.customerId,
        category: 'BERTH', currency: prepared.terms.currency,
        amount: prepared.terms.amount, description: stayDescription(prepared.terms, berth.berthNumber),
        berthingBooking: saved
      });
    } catch (error) { if (ui.isOpen()) { showError(ui.sheet, error); save.disabled = false; } }
  });
}

function showAssignedStay(berth, clientId) {
  const ui = openSheet('Record assigned vessel stay', `
    <form class="add-form" novalidate>
      <div class="add-scroll">
        <label class="add-label" for="bs-arrival">${tr('Arrival')}</label>
        <input class="add-input" id="bs-arrival" type="date" value="${day(berth.assignedDate || Date.now())}">
        <label class="add-label" for="bs-departure">${tr('Departure')}</label>
        <input class="add-input" id="bs-departure" type="date" value="${day(berth.expectedEndDate || Date.now() + 86400000)}">
        <div class="add-error" data-billing-error role="alert" hidden></div>
      </div>
      <button type="submit" class="add-save">${tr('Record stay / Review price')}</button>
    </form>`);
  ui.sheet.querySelector('form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = ui.sheet.querySelector('[type=submit]'); button.disabled = true;
    try {
      const arrival = ui.sheet.querySelector('#bs-arrival').value;
      const departure = ui.sheet.querySelector('#bs-departure').value;
      nights(arrival, departure);
      const booking = await recordAssignedStay(clientId, berth, arrival, departure);
      if (!ui.isOpen()) return;
      ui.close(); showStayReview(berth, booking, clientId);
    } catch (error) { if (ui.isOpen()) { showError(ui.sheet, error); button.disabled = false; } }
  });
}

// Booking approval captures only a price explicitly reviewed by staff.
export async function reviewNewBookingPrice(booking, berth) {
  const clientId = Number(booking.clientId);
  const [rates, currency] = await Promise.all([loadBerthingRates(clientId), marinaCurrency(clientId)]);
  const rate = selectRate(rates, berth.id, day(booking.arrivalDate));
  if (rate && savedCurrency(rate.currency) !== currency)
    throw new Error(`Set a ${currency} berthing rate before pricing this new stay. The applicable saved rate is in ${savedCurrency(rate.currency)}.`);
  const terms = rate ? captureTerms(booking, rate) : null;
  return new Promise((resolve, reject) => {
    let accepted = false;
    const ui = openSheet('Review berthing price', `
      <form class="add-form">
        <div class="add-scroll">
          <div class="add-section-sub" style="white-space:pre-wrap;">${escapeHtml(terms
            ? stayDescription(terms, berth.berthNumber)
            : tr('No applicable berthing rate is set. You can save the booking without a stay price and review the price before invoicing.'))}</div>
          <p class="add-section-sub">${tr('Utilities are separate. Confirm this is the agreed price. This does not send a WhatsApp quote or collect payment.')}</p>
          <div class="add-error" data-billing-error role="alert" hidden></div>
        </div>
        <button type="submit" class="add-save">${tr(terms ? 'Save agreed price' : 'Save without price')}</button>
      </form>`, () => { if (!accepted) reject(new Error('Booking approval cancelled')); });
    ui.sheet.querySelector('form').addEventListener('submit', event => {
      event.preventDefault();
      try {
        checkBillingClient(clientId);
        accepted = true; ui.close(); resolve(terms ? JSON.stringify(terms) : null);
      } catch (error) { showError(ui.sheet, error); }
    });
  });
}

export function showUtilityInvoiceChoices(drafts) {
  const clientId = Number(store.activeClientId);
  const ui = openSheet('Choose invoice currency', `
    <div class="add-form">
      <div class="add-scroll" data-choices></div>
      <div class="add-error" data-billing-error role="alert" hidden></div>
    </div>`);
  const body = ui.sheet.querySelector('[data-choices]');
  for (const draft of drafts) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'sheet-item';
    button.textContent = money(draft.amount, draft.currency);
    button.addEventListener('click', async () => {
      try {
        checkBillingClient(clientId);
        ui.close();
        const { showAddInvoiceSheet } = await import('./AddInvoiceSheet.js');
        await showAddInvoiceSheet(draft);
      } catch (error) { toast(error.message, { kind: 'error' }); }
    });
    body.append(button);
  }
}
