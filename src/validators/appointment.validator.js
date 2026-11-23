const FIELDS = ['patient_id', 'doctor_id', 'appt_datetime'];

const isPositiveInt = (v) => Number.isSafeInteger(v) && v > 0;

/**
 * Validates the shape of a booking request. The time itself is checked
 * separately by validateSlot() because that rule needs the current time.
 * @returns {{ errors: string[], data: object }}
 */
function validateBooking(body) {
  const errors = [];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'], data: {} };
  }

  const unknown = Object.keys(body).filter((key) => !FIELDS.includes(key));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  if (!isPositiveInt(body.patient_id)) errors.push('patient_id must be a positive integer');
  if (!isPositiveInt(body.doctor_id)) errors.push('doctor_id must be a positive integer');
  if (typeof body.appt_datetime !== 'string') errors.push('appt_datetime is required, e.g. "2026-12-01 09:30"');

  return {
    errors,
    data: { patient_id: body.patient_id, doctor_id: body.doctor_id, appt_datetime: body.appt_datetime },
  };
}

module.exports = { validateBooking };
