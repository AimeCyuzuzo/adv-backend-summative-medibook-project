const Appointment = require('../models/Appointment');
const AppError = require('../utils/AppError');
const BookingService = require('../services/booking.service');
const { parseId } = require('../validators/common');
const { validateBooking } = require('../validators/appointment.validator');

// HTTP layer for appointments: validate input, call the booking service, send the response.
// The booking/cancellation rules live in src/services/booking.service.js because the
// worker process uses them too (to book waitlisted patients).

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

// POST /api/appointments
async function bookAppointment(req, res) {
  const { errors, data } = validateBooking(req.body);
  if (errors.length) throw new AppError(400, 'Validation failed', errors);

  const appointment = await BookingService.bookAppointment(data);
  res.status(201).location(`/api/appointments/${appointment.appointment_id}`).json({ data: appointment });
}

// DELETE /api/appointments/:id — cancels (the record is kept for refund history).
// Returns 200 (not 204) because the response reports the refund.
async function cancelAppointment(req, res) {
  const { appointment, refund } = await BookingService.cancelAppointment(getIdOrThrow(req));
  res.json({ data: { appointment, refund } });
}

module.exports = { getAppointment, bookAppointment, cancelAppointment };
