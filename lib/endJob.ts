import { arrayRemove, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { notify } from './notify';
import { fetchBookingDetails } from './bookingDetails';
import { bookingOrigin } from './bookingOrigin';
import { workingHoursVerdict } from './cleanerTraits';

/** The cleaner ending the job: who she is and the hours she works. */
export type EndJobCleaner = { uid: string; name: string; availability: unknown; availabilitySet: boolean };

/**
 * End a job: mark it done at the agreed amount, book the next visit of a
 * recurring one, free the cleaner's slot and tell the client ("done — rate").
 *
 * Lifted out of the profile's "סיום" so the home screen's "סיימת עבודה?" popup
 * (Ofek, 7.11.2026) closes a job exactly the same way. What follows the end on
 * the profile — the payment sheet — stays there. The website: lib/cleanerActions
 * endJob.
 */
export async function endJob(b: any, me: EndJobCleaner): Promise<{ actualHours: number; actualTotal: number; now: string } | null> {
  // Already closed — from the website, the other phone, an earlier answer to a
  // question still on screen: null, and nothing is written. Ending it again
  // rewrote its end time, asked the client for a review already given, and
  // sent the client "done" a second time.
  const cur = (await getDoc(doc(db, 'bookings', b.id))).data();
  if (!cur || !['active', 'confirmed', 'onway'].includes(String(cur.status))) return null;
  const now = new Date().toISOString();

  // השעות — הזמן שעבר בפועל, לידיעה בלבד (הכרטיס מראה התחלה/סיום/משך).
  // הסכום — מה שסוכם, גם כשהעבודה הסתיימה מוקדם (אופק, 7.11.2026): חיוב לפי
  // הדקות שעברו נתן "₪1" למנקה שסיימה אחרי כמה דקות. זמן נוסף לא נגבה מעצמו;
  // הוא יבוא כהארכה שהלקוח מאשר. אותו כלל באתר (lib/cleanerActions endJob).
  let actualHours = Number(b.hours) || 0;
  if (b.startedAt) {
    const diffHours = (new Date(now).getTime() - new Date(b.startedAt).getTime()) / 3600000;
    actualHours = Math.max(0, Math.round(diffHours * 10) / 10); // עיגול לעשירית
  }
  const actualTotal = Number(b.total) || 0;

  await updateDoc(doc(db, 'bookings', b.id), {
    status: 'done', finishedAt: now, actualHours, actualTotal,
    reviewRequired: true,
    reviewDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  // Auto-create next recurring booking
  if (b.recurring === 'weekly' || b.recurring === 'monthly') {
    try {
      const daysToAdd = b.recurring === 'weekly' ? 7 : 30;
      const currentDate = new Date(b.bookingDate || now);
      let nextDate = new Date(currentDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      // Closed late: the next visit is the first one still ahead. Born in the
      // past, the sweep expired it in silence and the series ended there.
      while (nextDate.getTime() < Date.now()) nextDate = new Date(nextDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      // On a day she works. Thirty days on is two weekdays on, so a monthly
      // visit came back on a day she may have off; a weekly one only moves
      // if she has changed her days since. Her next working day within the
      // week, or the plain date if none fits. (UTC day: the date string is
      // read and written as UTC here.)
      {
        const [sh = 8, sm = 0] = String(b.startTime || '08:00').split(':').map(Number);
        for (let i = 0; i < 7; i++) {
          const tryDate = new Date(nextDate.getTime() + i * 24 * 60 * 60 * 1000);
          const v = workingHoursVerdict(me.availability, tryDate.getUTCDay(), sh + sm / 60, Number(b.hours) || 2, me.availabilitySet);
          if (v.verdict === 'ok' || v.verdict === 'unset') { nextDate = tryDate; break; }
        }
      }
      const nextDateStr = nextDate.toISOString().split('T')[0];
      // The address and phone may not have been folded into this row yet.
      const det: any = (b.address && b.phone) ? {} : await fetchBookingDetails(b.id);
      const src: any = { ...det };
      for (const [k, v] of Object.entries(b)) if (v !== '' && v != null) src[k] = v;
      // A fixed id — one next visit per finished visit. Ending the same job
      // twice made two; the rules key the create on this id.
      const nextRef = doc(db, 'bookings', `${b.id}-next`);
      const nextBatch = writeBatch(db);
      nextBatch.set(nextRef, {
        cleanerId: me.uid,
        cleanerName: me.name,
        clientUid: b.clientUid,
        clientName: b.clientName,
        hours: b.hours,
        payment: b.payment,
        paymentStatus: `awaiting_${b.payment}`,
        addrCity: b.addrCity || '',
        addrPrivate: b.addrPrivate || false,
        // The parent's own total, null included — the rules compare the two.
        total: b.total ?? null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        bookingDate: nextDateStr,
        startTime: b.startTime || '',
        busyFrom: (() => { const [h=8,m=0] = (b.startTime||'08:00').split(':').map(Number); const d=new Date(nextDate); d.setHours(h,m,0,0); return d.toISOString(); })(),
        busyUntil: (() => { const [h=8,m=0] = (b.startTime||'08:00').split(':').map(Number); const d=new Date(nextDate); d.setHours(h+(b.hours||2),m,0,0); return d.toISOString(); })(),
        recurring: b.recurring,
        // החזרה יורשת את מקור ההזמנה המקורית. בלי זה נוצר מסמך בלי origin,
        // ו-occupiesCleanerTime קרא אותו כעבודה שהמנקה תפסה: השעה ננעלה
        // ליומן שלה, והסוויפ ביטל אותה בשם המנקה. האתר עושה את זה מאז
        // cleanerActions.ts; האפליקציה לא עודכנה.
        origin: bookingOrigin(b),
        serviceType: b.serviceType || '',
        pricePerHour: b.pricePerHour || (b.hours > 0 ? b.total / b.hours : 0),
        source: 'auto_recurring',
        parentBookingId: b.id,
      });
      // הכתובת בפרטים הפרטיים, באותה כתיבה.
      nextBatch.set(doc(db, 'bookings', nextRef.id, 'private', 'details'), {
        address: src.address || '', addrStreet: src.addrStreet || '', addrFloor: src.addrFloor || '', addrApt: src.addrApt || '',
        phone: src.phone || '',
      });
      await nextBatch.commit();
      // Notify client about next booking
      void notify({ event: 'recurring_created', bookingId: nextRef.id });
    } catch (_) {}
  }
  // הסר את חלון הזמן מ-busySlots של המנקה
  if (b.busyFrom && b.busyUntil) {
    await updateDoc(doc(db, 'users', me.uid), {
      busySlots: arrayRemove({ from: b.busyFrom, until: b.busyUntil }),
    }).catch(() => {});
  }
  // שליחה ללקוח — "הניקיון הסתיים", עם הבקשה לדרג באותה התראה.
  void notify({ event: 'ended', bookingId: b.id });
  return { actualHours, actualTotal, now };
}
