const crypto = require('node:crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/transaction');
const { clinicNow } = require('../utils/clock');
const { audit } = require('../utils/auditLogger');
const { enqueueSafely, JOB_TYPES } = require('../queues/jobQueue');
const { validateSlot, calculateRefund, MAX_APPOINTMENTS_PER_DAY } = require('../utils/booking-rules');

// Booking and cancellation logic, shared by the HTTP controller AND the worker process
// (which books waitlisted patients). Keeping it in one place guarantees the worker
// follows exactly the same rules as the API. All SQL stays in the models.

// e.g. 'AP-3F9A1C2B' — random so refs can't be guessed or enumerated.
function generateApptRef() {
  return `AP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Books an appointment. Throws AppError (400/404/409/422) if a rule fails.
 *
 * How each rule is guaranteed:
 *  - future / working hours / 30-min boundary → validateSlot() before touching the DB
 *    (plus chk_appt_slot in the schema as a safety net)
 *  - max 12 per doctor per day → inside a transaction, the doctor's row is locked
 *    (FOR UPDATE) so concurrent bookings for that doctor count one at a time
 *  - no two patients in the same slot, even at the same instant → UNIQUE (doctor_id, active_slot);
 *    the losing INSERT gets ER_DUP_ENTRY → 409
 *
 * @param {{ patient_id: number, doctor_id: number, appt_datetime: string }} request
 * @param {{ source?: 'API'|'WAITLIST' }} [options]
 */
async function bookAppointment({ patient_id, doctor_id, appt_datetime }, { source = 'API' } = {}) {
  const now = clinicNow();
  const slot = validateSlot(appt_datetime, now);
  if (!slot.ok) throw new AppError(slot.status, slot.error);

  const apptDateTime = slot.value;
  const day = apptDateTime.slice(0, 10);

  // Offered in 409 responses: how to join the waitlist for this doctor/day (Part E).
  const waitlistOffer = {
    method: 'POST',
    href: '/api/waitlist',
    body: { patient_id, doctor_id, date: day },
  };

  let appointmentId;
  try {
    appointmentId = await withTransaction(async (conn) => {
      const doctor = await Doctor.lockById(conn, doctor_id);
      if (!doctor) throw new AppError(404, 'Doctor not found');

      const patient = await Patient.findById(patient_id, conn);
      if (!patient) throw new AppError(404, 'Patient not found');

      const booked = await Appointment.countBookedForDoctorOnDay(conn, doctor.doctor_id, day);
      if (booked >= MAX_APPOINTMENTS_PER_DAY) {
        throw new AppError(409, `Doctor is fully booked on ${day} (max ${MAX_APPOINTMENTS_PER_DAY} appointments per day)`, {
          reason: 'DAY_FULL',
          waitlist: waitlistOffer,
        });
      }

      return Appointment.create(conn, {
        appt_ref: generateApptRef(),
        patient_id: patient.patient_id,
        doctor_id: doctor.doctor_id,
        appt_datetime: apptDateTime,
        amount_paid: doctor.consultation_fee,
        booked_on: now,
      });
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' && err.message.includes('uq_doctor_slot')) {
      throw new AppError(409, 'This slot is already booked for this doctor', {
        reason: 'SLOT_TAKEN',
        waitlist: waitlistOffer,
      });
    }
    throw err;
  }

  const appointment = await Appointment.findById(appointmentId);

  // Side effects AFTER the commit. Neither can fail the booking:
  // audit() never rejects (Part D) and enqueueSafely() never throws (Part E).
  audit('APPOINTMENT_BOOKED', {
    appointment_id: appointment.appointment_id,
    appt_ref: appointment.appt_ref,
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
    amount_paid: appointment.amount_paid,
    source,
  });
  await enqueueSafely(JOB_TYPES.SEND_CONFIRMATION, { appointment_id: appointment.appointment_id });

  return appointment;
}

/**
 * Cancels an appointment and records its refund (one UPDATE in a transaction).
 * The row is kept for refund history; its slot becomes bookable again and the
 * waitlist is notified via a SLOT_FREED job for the worker.
 * @returns {Promise<{ appointment: object, refund: { amount: number, percent: number, hours_notice: number } }>}
 */
async function cancelAppointment(id) {
  const now = clinicNow();

  const result = await withTransaction(async (conn) => {
    const appt = await Appointment.lockById(conn, id);
    if (!appt) throw new AppError(404, 'Appointment not found');
    if (appt.status === 'CANCELLED') throw new AppError(409, 'Appointment is already cancelled');
    if (appt.appt_datetime <= now) throw new AppError(409, 'Appointment has already started or taken place');

    const refund = calculateRefund(appt.amount_paid, appt.appt_datetime, now);
    await Appointment.cancel(conn, id, { cancelled_at: now, refund_amount: refund.amount });
    return refund;
  });

  const appointment = await Appointment.findById(id);
  const refund = { amount: result.amount, percent: result.percent, hours_notice: result.hoursNotice };

  audit('APPOINTMENT_CANCELLED', {
    appointment_id: appointment.appointment_id,
    appt_ref: appointment.appt_ref,
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
    cancelled_at: appointment.cancelled_at,
    hours_notice: refund.hours_notice,
    refund_percent: refund.percent,
    refund_amount: refund.amount,
  });
  // Tell the worker a slot is free so it can promote the first waitlisted patient.
  await enqueueSafely(JOB_TYPES.SLOT_FREED, {
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
  });

  return { appointment, refund };
}

module.exports = { bookAppointment, cancelAppointment };
