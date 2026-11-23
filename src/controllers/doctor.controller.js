const Doctor = require('../models/Doctor');
const AppError = require('../utils/AppError');
const { parseId } = require('../validators/common');
const { validateDoctor } = require('../validators/doctor.validator');

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

module.exports = { listDoctors, getDoctor, createDoctor, updateDoctor, deleteDoctor };
