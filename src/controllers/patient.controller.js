const Patient = require('../models/Patient');
const AppError = require('../utils/AppError');
const { parseId } = require('../validators/common');
const { validatePatient } = require('../validators/patient.validator');

// Controllers hold the request logic. They call model functions and never touch SQL.
// Express 5 forwards errors thrown in async handlers to the central error handler.

function getIdOrThrow(req) {
  const id = parseId(req.params.id);
  if (!id) throw new AppError(400, 'Patient id must be a positive integer');
  return id;
}

// GET /api/patients
async function listPatients(req, res) {
  const patients = await Patient.findAll();
  res.json({ data: patients });
}

// GET /api/patients/:id
async function getPatient(req, res) {
  const patient = await Patient.findById(getIdOrThrow(req));
  if (!patient) throw new AppError(404, 'Patient not found');
  res.json({ data: patient });
}

// POST /api/patients
async function createPatient(req, res) {
  const { errors, data } = validatePatient(req.body);
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  try {
    const patient = await Patient.create(data);
    res.status(201).location(`/api/patients/${patient.patient_id}`).json({ data: patient });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, 'A patient with this email already exists');
    throw err;
  }
}

// PATCH /api/patients/:id
async function updatePatient(req, res) {
  const id = getIdOrThrow(req);
  const { errors, data } = validatePatient(req.body, { partial: true });
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  try {
    const patient = await Patient.update(id, data);
    if (!patient) throw new AppError(404, 'Patient not found');
    res.json({ data: patient });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new AppError(409, 'A patient with this email already exists');
    throw err;
  }
}

// DELETE /api/patients/:id
async function deletePatient(req, res) {
  const id = getIdOrThrow(req);
  try {
    const deleted = await Patient.remove(id);
    if (!deleted) throw new AppError(404, 'Patient not found');
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new AppError(409, 'Patient has appointments and cannot be deleted (appointment history is kept)');
    }
    throw err;
  }
}

module.exports = { listPatients, getPatient, createPatient, updatePatient, deletePatient };
