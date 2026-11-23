const Doctor = require('../models/Doctor');
const AppError = require('../utils/AppError');
const { parseId } = require('../validators/common');
const { validateDoctor } = require('../validators/doctor.validator');
const { clinicNow } = require('../utils/clock');
const { MAX_APPOINTMENTS_PER_DAY } = require('../utils/booking-rules');

const STATS_DAYS = 7;

// Controllers hold the request logic. They call model functions and never touch SQL.
// Express 5 forwards errors thrown in async handlers to the central error handler.

function getIdOrThrow(req) {
  const id = parseId(req.params.id);
  if (!id) throw new AppError(400, 'Doctor id must be a positive integer');
  return id;
}

// GET /api/doctors
async function listDoctors(req, res) {
  const doctors = await Doctor.findAll();
  res.json({ data: doctors });
}

// GET /api/doctors/:id
async function getDoctor(req, res) {
  const doctor = await Doctor.findById(getIdOrThrow(req));
  if (!doctor) throw new AppError(404, 'Doctor not found');
  res.json({ data: doctor });
}

// POST /api/doctors
async function createDoctor(req, res) {
  const { errors, data } = validateDoctor(req.body);
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const doctor = await Doctor.create(data);
  res.status(201).location(`/api/doctors/${doctor.doctor_id}`).json({ data: doctor });
}

// PATCH /api/doctors/:id
async function updateDoctor(req, res) {
  const id = getIdOrThrow(req);
  const { errors, data } = validateDoctor(req.body, { partial: true });
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const doctor = await Doctor.update(id, data);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  res.json({ data: doctor });
}

// DELETE /api/doctors/:id
async function deleteDoctor(req, res) {
  const id = getIdOrThrow(req);
  try {
    const deleted = await Doctor.remove(id);
    if (!deleted) throw new AppError(404, 'Doctor not found');
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new AppError(409, 'Doctor has appointments and cannot be deleted (appointment history is kept)');
    }
    throw err;
  }
}

// GET /api/doctors/:id/stats
// Revenue, upcoming count, per-day counts for the next 7 days and utilization — all computed in SQL.
async function getDoctorStats(req, res) {
  const id = getIdOrThrow(req);
  const now = clinicNow();
  const options = { now, today: now.slice(0, 10), dailyCap: MAX_APPOINTMENTS_PER_DAY, days: STATS_DAYS };

  const [summary, daily] = await Promise.all([
    Doctor.getStatsSummary(id, options),
    Doctor.getDailyBreakdown(id, options),
  ]);
  if (!summary) throw new AppError(404, 'Doctor not found');

  res.json({
    data: {
      doctor: { doctor_id: summary.doctor_id, full_name: summary.full_name, specialty: summary.specialty },
      revenue_collected: summary.revenue_collected,
      upcoming_appointments: summary.upcoming_appointments,
      next_7_days: {
        from: options.today,
        daily_cap: MAX_APPOINTMENTS_PER_DAY,
        appointments: summary.next_7_days_appointments,
        utilization_pct: summary.next_7_days_utilization_pct,
        per_day: daily,
      },
    },
  });
}

module.exports = { listDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor, getDoctorStats };
