// Date-only deadlines use calendar days, not elapsed 24-hour periods (DST-safe).
export function dateOnlyDaysUntil(value, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match || Number.isNaN(now.getTime())) return null;
  const [, year, month, day] = match.map(Number);
  const target = new Date(Date.UTC(year, month - 1, day));
  if (target.getUTCFullYear() !== year || target.getUTCMonth() !== month - 1 || target.getUTCDate() !== day) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return (target.getTime() - today) / 86400000;
}
