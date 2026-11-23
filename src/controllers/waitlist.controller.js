const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Waitlist = require('../queues/waitlist');
const AppError = require('../utils/AppError');
const { clinicNow } = require('../utils/clock');
const { parseId } = require('../validators/common');
const { validateWaitlistJoin, isValidDate } = require('../validators/waitlist.validator');

/**
 * POST /api/waitlist — join a doctor's waitlist for a day.
 * Offered in the 409 response when a slot or the whole day is fully booked.
 * When an appointment that day is cancelled, the worker books the first patient in line.
 */
async function joinWaitlist(req, res) {
  const { errors, data } = validateWaitlistJoin(req.body, clinicNow().slice(0, 10));
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const [doctor, patient] = await Promise.all([Doctor.findById(data.doctor_id), Patient.findById(data.patient_id)]);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  if (!patient) throw new AppError(404, 'Patient not found');

  const result = await Waitlist.join(data);
  if (!result.added) {
    throw new AppError(409, 'Patient is already on this waitlist', { position: result.position });
  }

  res.status(201).json({ data: { ...data, position: result.position } });
}

// GET /api/waitlist?doctor_id=1&date=2026-12-01 — view a waitlist in order.
async function getWaitlist(req, res) {
  const doctorId = parseId(req.query.doctor_id);
  const { date } = req.query;
  const errors = [];
  if (!doctorId) errors.push('doctor_id query parameter must be a positive integer');
  if (!isValidDate(date)) errors.push('date query parameter must be a valid date like "2026-12-01"');
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  res.json({ data: await Waitlist.list(doctorId, date) });
}

module.exports = { joinWaitlist, getWaitlist };
