const FIELDS = ['patient_id', 'doctor_id', 'date'];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const isPositiveInt = (v) => Number.isSafeInteger(v) && v > 0;

/** True for a real calendar date 'YYYY-MM-DD' (rejects 2026-02-30). */
function isValidDate(value) {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Validates a "join the waitlist" request.
 * @param {object} body
 * @param {string} today clinic date 'YYYY-MM-DD'
 */
function validateWaitlistJoin(body, today) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'], data: {} };
  }

  const unknown = Object.keys(body).filter((key) => !FIELDS.includes(key));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  if (!isPositiveInt(body.patient_id)) errors.push('patient_id must be a positive integer');
  if (!isPositiveInt(body.doctor_id)) errors.push('doctor_id must be a positive integer');
  if (!isValidDate(body.date)) errors.push('date must be a valid date like "2026-12-01"');
  else if (body.date < today) errors.push('date must be today or in the future');

  return { errors, data: { patient_id: body.patient_id, doctor_id: body.doctor_id, date: body.date } };
}

module.exports = { validateWaitlistJoin, isValidDate };
