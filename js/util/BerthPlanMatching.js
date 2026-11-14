export const berthPlanLabelKey = value => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');

export function matchBerthPlan(records, labels, imageWidth, imageHeight) {
  const berths = new Map();
  const positions = new Map();

  for (const berth of records) {
    const name = berthPlanLabelKey(berth.berthNumber);
    if (!name) continue;
    const entries = berths.get(name) ?? [];
    entries.push(berth);
    berths.set(name, entries);
  }

  for (const label of labels) {
    const name = berthPlanLabelKey(label.text);
    if (!berths.has(name) || !Number.isFinite(label.x) || !Number.isFinite(label.y) ||
        label.x < 0 || label.y < 0 || label.x > imageWidth || label.y > imageHeight) continue;
    const entries = positions.get(name) ?? [];
    entries.push(label);
    positions.set(name, entries);
  }

  const matches = [];
  const review = [];
  for (const [name, entries] of berths) {
    const hits = positions.get(name) ?? [];
    if (entries.length !== 1 || hits.length !== 1) {
      review.push({name, reason: entries.length > 1 || hits.length > 1 ? 'duplicate' : 'not found'});
      continue;
    }
    matches.push({id: entries[0]._docId, x: hits[0].x / imageWidth, y: hits[0].y / imageHeight});
  }
  return {matches, review};
}
