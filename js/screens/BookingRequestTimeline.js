import { t, getLocale } from '../i18n.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bookingEventTime(value) {
  const n = typeof value?.toMillis === 'function' ? value.toMillis()
    : value?.seconds != null ? Number(value.seconds) * 1000 : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
export function bookingTimelineEvents(r) {
  const events = [];
  const add = (label, time, detail = '') => events.push({label, time:bookingEventTime(time), detail});
  add('Enquiry received', r.receivedAt);
  const p = r.dateProposal;
  if (p) {
    const date = n => bookingEventTime(n) ? new Date(bookingEventTime(n)).toLocaleDateString(getLocale(), {day:'2-digit',month:'short',year:'numeric'}) : t('Not specified');
    add('Alternative dates proposed', p.createdAt, `${date(p.arrivalDate)} → ${date(p.departureDate)}`);
    if (p.delivery) add('Proposal message', p.deliveryUpdatedAt, t(p.delivery));
  }
  if (r.latestOwnerReply?.text) add('Owner reply received', r.latestOwnerReply.receivedAt,
    r.latestOwnerReply.reviewRequired ? t('Staff review required') : '');
  if (p?.recordedAt && ['ACCEPTED','REJECTED','WITHDRAWN'].includes(p.state)) {
    add(p.state === 'ACCEPTED' ? 'Date acceptance recorded' : p.state === 'REJECTED' ? 'Alternative dates rejected' : 'Date proposal withdrawn', p.recordedAt,
      p.state === 'ACCEPTED' ? t('Dates accepted — booking approval is separate') : '');
  }
  if (r.status === 'APPROVED') add(r.approvedBookingUuid ? 'Booking approved' : 'Request approved', r.approvedAt);
  if (r.status === 'DECLINED') add('Request declined', r.declinedAt);
  if (r.whatsappConfirmationStatus) add('WhatsApp update', r.whatsappConfirmationSentAt || r.whatsappConfirmationUpdatedAt || r.whatsappConfirmationAttemptedAt, t(r.whatsappConfirmationStatus));
  // Preserve workflow order: an absent timestamp is never invented from lastModified.
  return events;
}
export function renderBookingTimeline(r) {
  return `<section class="bkr-timeline"><h3>${esc(t('Booking journey'))}</h3><ol>${bookingTimelineEvents(r).map(e => `<li><div><strong>${esc(t(e.label))}</strong>${e.time ? `<time datetime="${new Date(e.time).toISOString()}">${esc(new Date(e.time).toLocaleString(getLocale(), {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}))}</time>` : ''}</div>${e.detail ? `<p>${esc(e.detail)}</p>` : ''}</li>`).join('')}</ol><details><summary>${esc(t('About this timeline'))}</summary><p>${esc(t('Shows the current request and latest recorded proposal and reply. Earlier changes may not be retained. Sent does not mean delivered or read.'))}</p></details></section>`;
}
