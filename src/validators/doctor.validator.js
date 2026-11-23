const { isNonEmptyString, isMoney } = require('./common');

const FIELDS = ['full_name', 'specialty', 'consultation_fee', 'room'];

/**
 * Validates a doctor request body.
 * @param {object} body
 * @param {{ partial?: boolean }} options  partial = true for PATCH (only sent fields are checked)
 * @returns {{ errors: string[], data: object }}  data contains only known, cleaned fields
 */
function validateDoctor(body, { partial = false } = {}) {
  const errors = [];
  const data = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Request body must be a JSON object'], data };
  }

  const unknown = Object.keys(body).filter((key) => !FIELDS.includes(key));
  if (unknown.length) errors.push(`Unknown field(s): ${unknown.join(', ')}`);

  const has = (field) => body[field] !== undefined;

  if (!partial || has('full_name')) {
    if (!isNonEmptyString(body.full_name, 100)) errors.push('full_name is required (1–100 characters)');
    else data.full_name = body.full_name.trim();
  }

  if (!partial || has('specialty')) {
    if (!isNonEmptyString(body.specialty, 80)) errors.push('specialty is required (1–80 characters)');
    else data.specialty = body.specialty.trim();
  }

  if (!partial || has('consultation_fee')) {
    if (!isMoney(body.consultation_fee)) {
      errors.push('consultation_fee must be a number >= 0 with at most 2 decimal places');
    } else {
      data.consultation_fee = body.consultation_fee;
    }
  }

  if (!partial || has('room')) {
    if (!isNonEmptyString(body.room, 10)) errors.push('room is required (1–10 characters)');
    else data.room = body.room.trim();
  }

  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push(`Provide at least one of: ${FIELDS.join(', ')}`);
  }

  return { errors, data };
}

module.exports = { validateDoctor };
