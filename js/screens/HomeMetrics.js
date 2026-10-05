// Read-only marina overview calculations. Dates in safety records are epoch milliseconds.
export function liveRecord(item) {
  return String(item.status || '').toUpperCase() !== 'DELETED' && !item.deleted && !item.isDeleted;
}
export function pendingBooking(item) {
  return liveRecord(item) && !item.approvedBookingUuid &&
    ['NEW', 'REVIEWING', 'AWAITING_OWNER'].includes(String(item.status || 'NEW').toUpperCase());
}
export function openMaintenance(item) {
  return liveRecord(item) && !item.completed &&
    !['COMPLETED', 'DEFERRED', 'CANCELLED'].includes(String(item.status || 'ACTIVE').toUpperCase());
}
export function safetyAttention(item, now = Date.now()) {
  if (!liveRecord(item)) return false;
  const expiry = Number(item.expiryDate || 0);
  return expiry <= 0 || expiry <= now + 30 * 86400000;
}
