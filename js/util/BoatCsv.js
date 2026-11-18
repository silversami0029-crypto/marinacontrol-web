// Header-based CSV import. Existing seven-column templates remain supported.
const FIELDS = ['name', 'type', 'model', 'hin', 'mmsi', 'port', 'status',
  'length', 'beam', 'draft', 'airDraft', 'customerId', 'engineType', 'engineHours'];

export function captureBoatImportContext(store) {
  return { clientId: Number(store.activeClientId), uid: store.authUser?.uid };
}

export function isBoatImportContextCurrent(store, context) {
  return !!context?.uid && context.uid === store.authUser?.uid
    && Number.isSafeInteger(context.clientId) && context.clientId > 0
    && context.clientId === Number(store.activeClientId) && !store.marinaSwitching
    && ['admin', 'manager', 'staff', 'inspector'].includes(store.activeRole);
}

export function parseBoatCsv(text) {
  const records = [];
  let record = [], value = '', quoted = false, afterQuote = false;
  text = String(text).replace(/^\uFEFF/, '');
  const cell = () => { record.push(value.trim()); value = ''; afterQuote = false; };
  const row = () => { cell(); if (record.some(Boolean)) records.push(record); record = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else value += c;
    } else if (c === ',' ) cell();
    else if (c === '\n' || c === '\r') { row(); if (c === '\r' && text[i + 1] === '\n') i++; }
    else if (c === '"' && !value.trim() && !afterQuote) { value = ''; quoted = true; }
    else if ((afterQuote && !/\s/.test(c)) || c === '"') throw new Error('Invalid CSV quoting.');
    else if (!afterQuote) value += c;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  row();
  if (!records.length) throw new Error('CSV is empty.');
  const normalize = key => key.toLowerCase().replace(/[\s_-]/g, '').replace(/\(m\)$/, '');
  const headers = records.shift().map(normalize);
  if (!headers.includes('name')) throw new Error('CSV must have a name column.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');
  const known = new Map(FIELDS.map(key => [normalize(key), key]));
  const unknown = headers.filter(key => !known.has(key));
  if (unknown.length) throw new Error(`Unknown CSV columns: ${unknown.join(', ')}. Use the boat template.`);
  return records.map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Record ${index + 2}: column count does not match the header.`);
    return Object.fromEntries(cells.map((v, i) => [known.get(headers[i]), v]));
  });
}

export function boatImportDetails(row, customerIds) {
  const result = {};
  for (const key of ['length', 'beam', 'draft', 'airDraft', 'engineHours']) {
    const raw = String(row[key] ?? '').trim();
    const number = raw === '' ? 0 : Number(raw);
    if ((raw && !/^\d+(\.\d+)?$/.test(raw)) || !Number.isFinite(number) || number < 0)
      throw new Error(`${key} must be a non-negative number (dimensions in metres).`);
    result[key] = number;
  }
  const rawId = String(row.customerId ?? '').trim();
  const customerId = rawId === '' ? 0 : Number(rawId);
  if (!Number.isSafeInteger(customerId) || customerId < 0 || (rawId && !/^\d+$/.test(rawId)))
    throw new Error('customerId must be a whole customer ID.');
  if (customerId && !customerIds.has(customerId))
    throw new Error(`Customer ${customerId} was not found in this marina. Import or add the customer first.`);
  return { ...result, customerId, engineType: String(row.engineType || 'Unknown').trim() };
}
