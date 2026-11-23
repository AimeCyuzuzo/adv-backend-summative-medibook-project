const crypto = require('node:crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/transaction');
const { clinicNow } = require('../utils/clock');
const { audit } = require('../utils/auditLogger');
const { parseId } = require('../validators/common');
const { validateBooking } = require('../validators/appointment.validator');
const { validateSlot, calculateRefund, MAX_APPOINTMENTS_PER_DAY } = require('../utils/booking-rules');

// e.g. 'AP-3F9A1C2B' — random so refs can't be guessed or enumerated.
function generateApptRef() {
  return `AP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function getIdOrThrow(req) {
  const id = parseId(req.params.id);
  if (!id) throw new AppError(400, 'Appointment id must be a positive integer');
  return id;
}

// GET /api/appointments/:id
async function getAppointment(req, res) {
  const appointment = await Appointment.findById(getIdOrThrow(req));
  if (!appointment) throw new AppError(404, 'Appointment not found');
  res.json({ data: appointment });
}

/**
 * POST /api/appointments
 *
 * How each rule is guaranteed:
 *  - future / working hours / 30-min boundary → validateSlot() before touching the DB
 *    (plus chk_appt_slot in the schema as a safety net)
 *  - max 12 per doctor per day → inside a transaction, the doctor's row is locked
 *    (FOR UPDATE) so concurrent bookings for that doctor count one at a time
 *  - no two patients in the same slot, even at the same instant → UNIQUE (doctor_id, active_slot);
 *    the losing INSERT gets ER_DUP_ENTRY → 409
 */
async function bookAppointment(req, res) {
  const { errors, data } = validateBooking(req.body);
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const now = clinicNow();
  const slot = validateSlot(data.appt_datetime, now);
  if (!slot.ok) throw new AppError(slot.status, slot.error);

  const apptDateTime = slot.value;
  const day = apptDateTime.slice(0, 10);

  try {
    const appointmentId = await withTransaction(async (conn) => {
      const doctor = await Doctor.lockById(conn, data.doctor_id);
      if (!doctor) throw new AppError(404, 'Doctor not found');

      const patient = await Patient.findById(data.patient_id, conn);
      if (!patient) throw new AppError(404, 'Patient not found');

      const booked = await Appointment.countBookedForDoctorOnDay(conn, doctor.doctor_id, day);
      if (booked >= MAX_APPOINTMENTS_PER_DAY) {
        throw new AppError(409, `Doctor is fully booked on ${day} (max ${MAX_APPOINTMENTS_PER_DAY} appointments per day)`, {
          reason: 'DAY_FULL',
          waitlist_available: true, // Part E: patient can join the waitlist
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

    const appointment = await Appointment.findById(appointmentId);

    // Fire-and-forget (no await): the response doesn't wait for the disk write,
    // and audit() never rejects, so a logging failure can't fail this request.
    audit('APPOINTMENT_BOOKED', {
      appointment_id: appointment.appointment_id,
      appt_ref: appointment.appt_ref,
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appt_datetime: appointment.appt_datetime,
      amount_paid: appointment.amount_paid,
    });
    // TODO Part E: enqueue confirmation notification job
    res.status(201).location(`/api/appointments/${appointmentId}`).json({ data: appointment });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' && err.message.includes('uq_doctor_slot')) {
      throw new AppError(409, 'This slot is already booked for this doctor', {
        reason: 'SLOT_TAKEN',
        waitlist_available: true, // Part E: patient can join the waitlist
      });
    }
    throw err;
  }
}

/**
 * DELETE /api/appointments/:id — cancels the appointment.
 * The row is kept (status = CANCELLED) for refund history; its slot becomes bookable again.
 * Status change and refund are written by ONE UPDATE inside a transaction,
 * so they succeed or fail together.
 */
async function cancelAppointment(req, res) {
  const id = getIdOrThrow(req);
  const now = clinicNow();

  const refund = await withTransaction(async (conn) => {
    const appt = await Appointment.lockById(conn, id);
    if (!appt) throw new AppError(404, 'Appointment not found');
    if (appt.status === 'CANCELLED') throw new AppError(409, 'Appointment is already cancelled');
    if (appt.appt_datetime <= now) throw new AppError(409, 'Appointment has already started or taken place');

    const result = calculateRefund(appt.amount_paid, appt.appt_datetime, now);
    await Appointment.cancel(conn, id, { cancelled_at: now, refund_amount: result.amount });
    return result;
  });

  const appointment = await Appointment.findById(id);

  // Fire-and-forget, as for bookings — see audit() in src/utils/auditLogger.js.
  audit('APPOINTMENT_CANCELLED', {
    appointment_id: appointment.appointment_id,
    appt_ref: appointment.appt_ref,
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appt_datetime: appointment.appt_datetime,
    cancelled_at: appointment.cancelled_at,
    hours_notice: refund.hoursNotice,
    refund_percent: refund.percent,
    refund_amount: refund.amount,
  });
  // TODO Part E: notify the waitlist that this slot is free
  res.json({
    data: {
      appointment,
      refund: { amount: refund.amount, percent: refund.percent, hours_notice: refund.hoursNotice },
    },
  });
}

module.exports = { getAppointment, bookAppointment, cancelAppointment };
