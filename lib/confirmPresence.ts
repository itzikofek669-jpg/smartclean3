// Which booking the booking flow is already announcing on screen.
//
// Two different components watch for the same transition to `confirmed`, and
// each announced it: the booking flow swapped itself to its success screen,
// and the home screen opened a "booking confirmed" dialog on top of that. One
// event, two confirmations stacked, plus a "new message" alert for the
// automatic chat line the cleaner's confirmation sends — three interruptions
// for one thing happening.
//
// Same shape as lib/chatPresence: the component that is already showing the
// news claims it, and the global listener stands down for that booking.

let announcedBookingId: string | null = null;

export function setAnnouncedBooking(id: string | null) {
  announcedBookingId = id || null;
}

export function getAnnouncedBooking(): string | null {
  return announcedBookingId;
}
