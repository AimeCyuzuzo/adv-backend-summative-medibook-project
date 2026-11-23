const Appointment = require('../models/Appointment');
const Waitlist = require('../queues/waitlist');
const BookingService = require('../services/booking.service');
const AppError = require('../utils/AppError');
const { audit } = require('../utils/auditLogger');

/**
 * SEND_CONFIRMATION — "sends" the confirmation SMS/email by writing it to the audit log.
 * Throws if the log write fails, so the worker retries the job.
 */
async function sendConfirmation({ appointment_id }) {
  const appt = await Appointment.findById(appointment_id);
  if (!appt) return { skipped: 'appointment not found' };
  if (appt.status !== 'BOOKED') return { skipped: 'appointment was cancelled before the message was sent' };

  const message =
    `Hello ${appt.patient_name}, your appointment ${appt.appt_ref} with ${appt.doctor_name} ` +
    `(${appt.specialty}, room ${appt.room}) on ${appt.appt_datetime} is confirmed. ` +
    `Amount paid: ${appt.amount_paid.toFixed(2)}.`;

  const written = await audit('NOTIFICATION_SENT', {
    channel: 'SMS/EMAIL',
    appointment_id: appt.appointment_id,
    patient_id: appt.patient_id,
    message,
  });
  if (!written) throw new Error('could not write notification to the audit log');
  return { sent: true };
}

/**
 * SLOT_FREED — a cancellation freed a slot: book the first patient on that doctor/day waitlist.
 *
 * The entry is moved atomically into `waitlist:processing` BEFORE booking, and only removed
 * once the booking has committed, so the patient can never vanish from both the queue and
 * the appointments table:
 *   - booked                       → confirm()    (removed from the waitlist)
 *   - slot no longer available     → putBack()    (back to the FRONT, keeps their place)
 *   - patient/doctor deleted       → deadLetter() (kept in waitlist:failed, next patient tried)
 *   - unexpected error (DB down)   → putBack() and rethrow → the job is retried
 *   - worker crashes mid-way       → recoverProcessing() on next start puts it back
 */
async function promoteFromWaitlist({ doctor_id, appt_datetime }) {
  const date = appt_datetime.slice(0, 10);

  // Loop only to skip entries that can never be booked; stops after one success or a retryable failure.
  for (;;) {
    const rawEntry = await Waitlist.claimNext(doctor_id, date);
    if (!rawEntry) return { promoted: false, reason: 'waitlist empty' };

    const entry = JSON.parse(rawEntry);
    try {
      const appointment = await BookingService.bookAppointment(
        { patient_id: entry.patient_id, doctor_id, appt_datetime },
        { source: 'WAITLIST' }
      );
      await Waitlist.confirm(rawEntry);
      await audit('WAITLIST_PROMOTED', {
        patient_id: entry.patient_id,
        doctor_id,
        appointment_id: appointment.appointment_id,
        appt_datetime: appointment.appt_datetime,
        waited_since: entry.joined_at,
      });
      return { promoted: true, appointment_id: appointment.appointment_id };
    } catch (err) {
      const failure = { patient_id: entry.patient_id, doctor_id, appt_datetime, reason: err.message };

      if (err instanceof AppError && err.statusCode === 404) {
        // Patient or doctor no longer exists — this entry can never be booked.
        await Waitlist.deadLetter(rawEntry, err.message);
        await audit('WAITLIST_PROMOTION_FAILED', { ...failure, outcome: 'moved to waitlist:failed' });
        continue; // offer the slot to the next patient in line
      }

      // Slot taken by someone else, day full, slot now in the past, DB/Redis error...
      // The patient keeps their place at the front of the line for the next cancellation.
      await Waitlist.putBack(rawEntry);
      await audit('WAITLIST_PROMOTION_FAILED', { ...failure, outcome: 'returned to front of waitlist' });

      if (err instanceof AppError) return { promoted: false, reason: err.message };
      throw err; // unexpected → let the worker retry the job
    }
  }
}

module.exports = {
  SEND_CONFIRMATION: sendConfirmation,
  SLOT_FREED: promoteFromWaitlist,
};
