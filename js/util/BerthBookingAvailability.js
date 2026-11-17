import { db } from '../firebase.js';
import {
  collection, getDocsFromServer, query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export async function hasOverlappingBooking(clientId, berthId, arrival, departure) {
  if (!Number.isFinite(Number(arrival)) || !Number.isFinite(Number(departure)) ||
      Number(arrival) <= 0 || Number(departure) <= Number(arrival)) {
    throw new Error('Booking dates are invalid.');
  }
  const bookings = await getDocsFromServer(query(collection(db, 'berth_bookings'),
    where('clientId', '==', Number(clientId)), where('berthId', '==', Number(berthId))));
  return bookings.docs.some(doc => {
    const booking = doc.data();
    const status = String(booking.status || '').toUpperCase();
    return !['DECLINED', 'CANCELLED', 'CHECKED_OUT'].includes(status) &&
      Number(booking.arrivalDate) < Number(departure) &&
      Number(booking.departureDate) > Number(arrival);
  });
}

// Call after reading the berth in this transaction and before any writes.
// Committing the booking and changing the same berth forces competing web
// transactions to retry the server query against the newly committed booking.
export async function reserveBerthDates(transaction, berthRef, booking) {
  if (await hasOverlappingBooking(booking.clientId, booking.berthId, booking.arrivalDate, booking.departureDate)) {
    throw new Error('This berth already has an overlapping booking. Choose another berth or change the dates.');
  }
  transaction.update(berthRef, { bookingScheduleUpdatedAt: serverTimestamp() });
}
