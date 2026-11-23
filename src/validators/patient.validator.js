const { isNonEmptyString, isEmail, isPhone } = require('./common');

const FIELDS = ['full_name', 'email', 'phone'];

/**
 * Validates a patient request body.
 * @param {object} body
 * @param {{ partial?: boolean }} options  partial = true for PATCH (only sent fields are checked)
 * @returns {{ errors: string[], data: object }}  data contains only known, trimmed fields
 */
function validatePatient(body, { partial = false } = {}) {
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

  if (!partial || has('email')) {
    if (!isEmail(body.email)) errors.push('email must be a valid email address');
    else data.email = body.email.trim().toLowerCase();
  }

  if (!partial || has('phone')) {
    if (!isPhone(body.phone)) errors.push('phone must be 7–20 digits (may include +, spaces, dashes, brackets)');
    else data.phone = body.phone.trim();
  }

  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push(`Provide at least one of: ${FIELDS.join(', ')}`);
  }

  return { errors, data };
}

module.exports = { validatePatient };
