// Safety dates are local calendar dates, stored as millisecond timestamps.
export function calendarTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) throw new Error('Select a valid date');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    throw new Error('Select a valid date');
  return date.getTime();
}
export function localDateValue(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function calculateSafetyDates(item, purchaseValue, expiryValue = '') {
  const purchaseDate = calendarTimestamp(purchaseValue);
  const years = Number(item.validityYears || 0), months = Number(item.validityMonths || 0);
  if (![years, months].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1200))
    throw new Error('Check the item validity in Edit before setting dates');
  let expiryDate = expiryValue ? calendarTimestamp(expiryValue) : 0;
  if (!expiryDate && (years || months)) {
    // Clamp end-of-month dates rather than rolling February dates into March.
    const date = new Date(purchaseDate), day = date.getDate();
    date.setDate(1); date.setFullYear(date.getFullYear() + years);
    date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()));
    const yearDay = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + months);
    date.setDate(Math.min(yearDay, new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()));
    expiryDate = date.getTime();
  }
  if (expiryDate && expiryDate < purchaseDate) throw new Error('Expiry cannot be before purchase');
  const alertDays = Number(item.alertDaysBefore ?? 30);
  if (!Number.isFinite(alertDays) || alertDays < 0) throw new Error('Check the inspection alert period in Edit');
  return {purchaseDate, expiryDate, nextInspectionDate: expiryDate ? expiryDate - alertDays * 86400000 : 0};
}
