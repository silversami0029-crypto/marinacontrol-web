import { savedCurrency, decimalProduct, currencyTotals } from './BillingCurrency.js';

// A read-only illustration: one selected tariff applied to each test's total usage.
// Never writes utility readings, charges, invoices or billed markers.
export function calculatePedestalPreview(session, tariffs) {
  if (session?.mode !== 'TEST' || !session.state) throw new Error('A simulator test is required.');
  const lines = [];
  for (const [meterKey, utilityType, unit] of [['electricity','ELECTRICITY','kWh'],['water','WATER','L']]) {
    const meter = session.state[meterKey];
    if (meter?.value == null) continue;
    const quantity = meter.consumption;
    if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0 ||
        typeof meter.value !== 'number' || !Number.isFinite(meter.value) || meter.value < quantity) {
      throw new Error('Invalid test meter readings. Refresh the test.');
    }
    const tariff = tariffs[utilityType];
    if (!tariff) throw new Error(`No ${meterKey} tariff is configured for the preview date. Set it in Utility Rates.`);
    const mode = String(tariff.pricingMode || '').toUpperCase();
    if (!['METERED','INCLUDED'].includes(mode)) throw new Error('Unsupported utility pricing mode.');
    const currency = savedCurrency(tariff.currency);
    const tariffUnit = String(tariff.unit || '').trim().toUpperCase();
    const validUnit = utilityType === 'ELECTRICITY' ? tariffUnit === 'KWH' : ['L','M3','M³'].includes(tariffUnit);
    const rate = tariff.pricePerUnit;
    if (mode === 'METERED' && (!validUnit || typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0)) {
      throw new Error(`Invalid ${meterKey} tariff unit or rate.`);
    }
    const factor = utilityType === 'WATER' && ['M3','M³'].includes(tariffUnit) ? 1000 : 1;
    const billedQuantity = quantity / factor;
    // Decimal helper accepts up to 12 decimal places, matching existing billing arithmetic.
    const decimal = n => n.toFixed(12).replace(/\.?0+$/, '') || '0';
    const amount = mode === 'INCLUDED' ? 0 : Number(decimalProduct([decimal(billedQuantity),decimal(rate)],currency));
    if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER / 1000) throw new Error('Preview amount is too large.');
    lines.push({utilityType,unit,quantity,fromValue:meter.value-quantity,toValue:meter.value,
      meterId:meter.meterId,mode,currency,rate:mode === 'INCLUDED' ? 0 : rate,
      tariffUnit:factor === 1000 ? 'm³' : unit,billedQuantity,amount,effectiveFrom:tariff.effectiveFrom});
  }
  if (!lines.length) throw new Error('Send a first meter reading before previewing an invoice.');
  return {lines, totals:currencyTotals(lines), sessionId:session.sessionId, berthLabel:session.berthLabel};
}
