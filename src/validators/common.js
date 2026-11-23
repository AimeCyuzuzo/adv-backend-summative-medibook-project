// Small, pure validation helpers (no DB, no Express) so they can be unit-tested.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,19}$/;

// Parses a route :id param. Returns a positive integer, or null if invalid.
function parseId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isNonEmptyString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isEmail(value) {
  return typeof value === 'string' && value.length <= 150 && EMAIL_RE.test(value);
}

function isPhone(value) {
  return typeof value === 'string' && PHONE_RE.test(value.trim());
}

module.exports = { parseId, isNonEmptyString, isEmail, isPhone };
