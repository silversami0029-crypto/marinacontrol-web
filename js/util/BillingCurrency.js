// Saved amounts retain their currency. A missing legacy currency means GBP.
const COUNTRIES = {};
for (const [currency, countries] of Object.entries({
  GBP: 'GB UK GG JE IM', EUR: 'AD AT AX BE BG BL CY DE EE ES FI FR GF GP GR HR IE IT LT LU LV MC ME MF MQ MT NL PM PT RE SI SK SM TF VA YT',
  USD: 'US AS BQ EC FM GU IO MH MP PA PR PW SV TC TL UM VG VI', AED: 'AE', TRY: 'TR',
  AUD: 'AU CC CX HM KI NF NR TV', NZD: 'NZ CK NU PN TK', XCD: 'AG AI DM GD KN LC MS VC',
  XOF: 'BF BJ CI GW ML NE SN TG', XAF: 'CF CG CM GA GQ TD', XPF: 'NC PF WF',
  ZAR: 'ZA LS NA', CHF: 'CH LI', DKK: 'DK FO GL', NOK: 'NO BV SJ', ILS: 'IL PS',
  CAD:'CA', BHD:'BH', JPY:'JP', KWD:'KW', OMR:'OM', QAR:'QA', SAR:'SA',
  AFN:'AF', ALL:'AL', DZD:'DZ', AOA:'AO', ARS:'AR', AMD:'AM', AWG:'AW', AZN:'AZ',
  BAM:'BA', BBD:'BB', BDT:'BD', BMD:'BM', BND:'BN', BOB:'BO', BRL:'BR', BSD:'BS',
  BTN:'BT', BWP:'BW', BYN:'BY', BZD:'BZ', CDF:'CD', CLP:'CL', CNY:'CN', COP:'CO',
  CRC:'CR', CUP:'CU', CVE:'CV', CZK:'CZ', DJF:'DJ', DOP:'DO', EGP:'EG', ERN:'ER',
  ETB:'ET', FJD:'FJ', FKP:'FK', GEL:'GE', GHS:'GH', GIP:'GI', GMD:'GM', GNF:'GN',
  GTQ:'GT', GYD:'GY', HKD:'HK', HNL:'HN', HTG:'HT', HUF:'HU', IDR:'ID', INR:'IN',
  IQD:'IQ', IRR:'IR', ISK:'IS', JMD:'JM', JOD:'JO', KES:'KE', KGS:'KG', KHR:'KH',
  KMF:'KM', KPW:'KP', KRW:'KR', KYD:'KY', KZT:'KZ', LAK:'LA', LBP:'LB', LKR:'LK',
  LRD:'LR', LYD:'LY', MAD:'MA EH', MDL:'MD', MGA:'MG', MKD:'MK', MMK:'MM', MNT:'MN',
  MOP:'MO', MRU:'MR', MUR:'MU', MVR:'MV', MWK:'MW', MXN:'MX', MYR:'MY', MZN:'MZ',
  NGN:'NG', NIO:'NI', NPR:'NP', PEN:'PE', PGK:'PG', PHP:'PH', PKR:'PK', PLN:'PL',
  PYG:'PY', RON:'RO', RSD:'RS', RUB:'RU', RWF:'RW', SBD:'SB', SCR:'SC', SDG:'SD',
  SEK:'SE', SGD:'SG', SHP:'SH', SLE:'SL', SOS:'SO', SRD:'SR', SSP:'SS', STN:'ST',
  SYP:'SY', SZL:'SZ', THB:'TH', TJS:'TJ', TMT:'TM', TND:'TN', TOP:'TO', TTD:'TT',
  TWD:'TW', TZS:'TZ', UAH:'UA', UGX:'UG', UYU:'UY', UZS:'UZ', VES:'VE', VND:'VN',
  VUV:'VU', WST:'WS', YER:'YE', ZMW:'ZM', ZWG:'ZW', BIF:'BI'
})) for (const country of countries.split(' ')) COUNTRIES[country] = currency;

export function currencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code) || !Intl.supportedValuesOf('currency').includes(code))
    throw new Error('Invalid billing currency');
  return code;
}

export function savedCurrency(value) {
  return value == null || String(value).trim() === '' ? 'GBP' : currencyCode(value);
}

export function countryCurrency(country) {
  const code = COUNTRIES[String(country || '').trim().toUpperCase()];
  if (!code) throw new Error('Set a valid two-letter country code for this marina before billing');
  return currencyCode(code);
}

export function currencyDigits(currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: savedCurrency(currency) })
    .resolvedOptions().maximumFractionDigits;
}

export function money(value, currency, locale = undefined) {
  const code = savedCurrency(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: code, currencyDisplay: 'code'
  }).format(Number(value || 0));
}

// Decimal arithmetic avoids binary rounding when calculating and saving stay prices.
function decimal(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,12})?$/.test(text)) throw new Error('Enter a non-negative decimal rate (up to 12 decimal places)');
  const [whole, fraction = ''] = text.split('.');
  return { units: BigInt(whole + fraction), scale: fraction.length };
}

export function decimalRate(value) {
  decimal(value);
  return String(value).trim();
}

export function decimalProduct(values, currency) {
  let units = 1n, scale = 0;
  for (const value of values) {
    const part = decimal(value);
    units *= part.units;
    scale += part.scale;
  }
  const digits = currencyDigits(currency);
  if (scale > digits) {
    const divisor = 10n ** BigInt(scale - digits);
    units = (units + divisor / 2n) / divisor;
  } else units *= 10n ** BigInt(digits - scale);
  const text = units.toString().padStart(digits + 1, '0');
  return digits ? text.slice(0, -digits) + '.' + text.slice(-digits) : text;
}

export function invoiceAmount(value, currency) {
  const part = decimal(value);
  const digits = currencyDigits(currency);
  if (part.scale > digits && part.units % (10n ** BigInt(part.scale - digits)) !== 0n)
    throw new Error(`Use at most ${digits} decimal places for ${savedCurrency(currency)}`);
  const result = Number(decimalProduct([value], currency));
  if (!Number.isFinite(result) || result > Number.MAX_SAFE_INTEGER / (10 ** digits))
    throw new Error('Invoice amount is too large');
  return result;
}

export function currencyTotals(invoices, predicate = () => true) {
  const totals = new Map();
  for (const invoice of invoices.filter(predicate)) {
    const currency = savedCurrency(invoice.currency);
    const digits = currencyDigits(currency);
    const text = decimalProduct([Number(invoice.amount || 0).toFixed(digits)], currency);
    const units = BigInt(text.replace('.', ''));
    totals.set(currency, (totals.get(currency) || 0n) + units);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, units]) => ({
    currency, amount: Number(units) / (10 ** currencyDigits(currency))
  }));
}

export function totalsText(invoices, predicate) {
  return currencyTotals(invoices, predicate).map(x => money(x.amount, x.currency)).join(' · ') || '—';
}
