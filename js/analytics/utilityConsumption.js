const MODES = new Set(['CUMULATIVE', 'INTERVAL', 'INSTANTANEOUS']);

const number = value => value == null || value === '' ? NaN : Number(value);
const text = value => String(value || '').trim().toUpperCase();
const time = value => {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (value && Number.isFinite(value.seconds)) return value.seconds * 1000;
  return Number(value || 0);
};

function normalise(reading, index) {
  const type = text(reading.utilityType);
  const mode = text(reading.readingMode || 'CUMULATIVE');
  const rawUnit = text(reading.unit).replace('M³', 'M3');
  const rawValue = number(reading.value);
  const at = time(reading.recordedAt);
  const factor = type === 'WATER' && rawUnit === 'M3' && mode !== 'INSTANTANEOUS' ? 1000 : 1;
  const unit = mode === 'INSTANTANEOUS'
    ? (type === 'WATER' ? 'L/min' : 'kW')
    : (type === 'WATER' ? 'L' : 'kWh');
  const meter = reading.assetId == null || reading.assetId === ''
    ? `BERTH:${Number(reading.berthId || 0)}:${text(reading.readingType) || type}`
    : `ASSET:${reading.assetId}`;

  return {
    ...reading,
    _index: index,
    type, mode, at, unit, meter,
    value: rawValue,
    canonicalValue: rawValue * factor,
    voided: Boolean(reading.voidedAt || reading.deletedAt || reading.isVoided)
  };
}

/**
 * Converts raw readings into auditable consumption segments.
 * Cumulative readings are compared only with the previous cumulative reading
 * for the same meter. Interval entries count once. Instantaneous entries never
 * become consumption. Voided readings remain available to history but are not
 * calculated.
 */
export function utilitySegments(clientId, rawReadings = []) {
  const readings = rawReadings
    .filter(r => Number(r.clientId) === Number(clientId))
    .map(normalise)
    .sort((a, b) => a.at - b.at || a._index - b._index);
  const segments = [], issues = [], instantaneous = [], previous = new Map();
  const modesBySeries = new Map();

  for (const reading of readings) {
    const key = `${reading.type}:${reading.meter}`;
    if (!modesBySeries.has(key)) modesBySeries.set(key, new Set());
    if (!reading.voided && reading.mode !== 'INSTANTANEOUS') modesBySeries.get(key).add(reading.mode);

    if (reading.voided) continue;
    if (!['ELECTRICITY', 'WATER'].includes(reading.type) || !MODES.has(reading.mode) ||
        !Number.isFinite(reading.value) || reading.value < 0 || reading.at <= 0) {
      issues.push({ ...reading, reason: 'INVALID_READING' });
      continue;
    }

    if (reading.mode === 'INSTANTANEOUS') {
      instantaneous.push(reading);
      continue;
    }

    if (reading.mode === 'INTERVAL') {
      segments.push({
        key, type: reading.type, mode: reading.mode, unit: reading.unit,
        quantity: reading.canonicalValue, at: reading.at, from: null, to: reading
      });
      continue;
    }

    const prior = previous.get(key);
    previous.set(key, reading);
    if (!prior) continue; // first cumulative reading establishes the baseline
    if (reading.at === prior.at) {
      issues.push({ ...reading, reason: 'DUPLICATE_TIME', previous: prior });
      continue;
    }
    const quantity = reading.canonicalValue - prior.canonicalValue;
    if (quantity < 0) {
      issues.push({ ...reading, reason: 'METER_DROP', previous: prior });
      continue;
    }
    segments.push({
      key, type: reading.type, mode: reading.mode, unit: reading.unit,
      quantity, at: reading.at, from: prior, to: reading
    });
  }

  for (const [key, modes] of modesBySeries) {
    if (modes.size > 1) {
      const last = [...readings].reverse().find(r => `${r.type}:${r.meter}` === key && !r.voided);
      issues.push({ ...(last || {}), key, at: last?.at || 0, reason: 'MIXED_MODES', informational: true });
    }
  }

  return { readings, segments, issues, instantaneous };
}

export function utilityHistory(clientId, rawReadings = []) {
  const result = utilitySegments(clientId, rawReadings);
  const segmentByReading = new Map(result.segments.map(s => [s.to, s]));
  return {
    ...result,
    entries: [...result.readings].sort((a, b) => b.at - a.at || b._index - a._index).map(reading => ({
      ...reading,
      consumption: segmentByReading.get(reading)?.quantity ?? null,
      issue: result.issues.find(issue => issue._index === reading._index && issue.reason !== 'MIXED_MODES')?.reason || null
    }))
  };
}
