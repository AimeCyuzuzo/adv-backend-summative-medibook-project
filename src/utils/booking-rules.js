// Pure business rules for booking and cancelling — no DB, no Express, no real clock.
// `now` is always passed in (as clinic local time), so every rule is unit-testable.

const OPENING_HOUR = 9;          // first slot starts 09:00
const CLOSING_HOUR = 17;         // last slot must END by 17:00 → last start 16:30
const SLOT_MINUTES = 30;
const MAX_APPOINTMENTS_PER_DAY = 12;

const MS_PER_HOUR = 60 * 60 * 1000;

// Accepts 'YYYY-MM-DD HH:MM', 'YYYY-MM-DDTHH:MM', optionally with ':SS'.
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parses a clinic-local date/time string.
 * @returns {{ value: string, parts: object } | null}
 *   value = normalised MySQL DATETIME 'YYYY-MM-DD HH:MM:SS', or null if malformed / not a real date.
 */
function parseClinicDateTime(input) {
  if (typeof input !== 'string') return null;
  const match = DATETIME_RE.exec(input.trim());
  if (!match) return null;

  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number);
  const second = match[6] === undefined ? 0 : Number(match[6]); // seconds are optional

  // Reject impossible dates like 2026-02-30 or 25:00 by round-tripping through Date.
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day ||
    d.getUTCHours() !== hour || d.getUTCMinutes() !== minute || d.getUTCSeconds() !== second
  ) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');
  return {
    value: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
    parts: { year, month, day, hour, minute, second },
  };
}

// Milliseconds for a clinic-local DATETIME string. Both sides of any comparison are
// clinic-local, so treating them as UTC is safe (Africa/Kigali has no DST).
function toMs(dateTime) {
  return Date.parse(`${dateTime.replace(' ', 'T')}Z`);
}

/**
 * Checks a requested appointment time.
 * @param {string} input  requested time, clinic local
 * @param {string} now    current clinic time 'YYYY-MM-DD HH:MM:SS'
 * @returns {{ ok: true, value: string } | { ok: false, status: 400|422, error: string }}
 */
function validateSlot(input, now) {
  const parsed = parseClinicDateTime(input);
  if (!parsed) {
    return { ok: false, status: 400, error: 'appt_datetime must be a valid date/time like "2026-12-01 09:30"' };
  }

  const { hour, minute, second } = parsed.parts;

  if (minute % SLOT_MINUTES !== 0 || second !== 0) {
    return { ok: false, status: 422, error: 'Appointments start on a 30-minute boundary (e.g. 09:00, 09:30)' };
  }

  const lastStartHour = CLOSING_HOUR - 1; // 16:30 is the last start; 17:00 itself is closing time
  if (hour < OPENING_HOUR || hour > lastStartHour) {
    return { ok: false, status: 422, error: 'Appointments must be within working hours (09:00–17:00); last slot starts 16:30' };
  }

  if (toMs(parsed.value) <= toMs(now)) {
    return { ok: false, status: 422, error: 'Appointments can only be booked in the future' };
  }

  return { ok: true, value: parsed.value };
}

/**
 * Refund policy, based on notice given before the appointment:
 *   more than 48 hours           → 100%
 *   24 to 48 hours (inclusive)   → 50%   (exactly 48h → 50%, exactly 24h → 50%)
 *   less than 24 hours           → 0%
 * @param {number} amountPaid
 * @param {string} apptDateTime  clinic local 'YYYY-MM-DD HH:MM:SS'
 * @param {string} now           clinic local 'YYYY-MM-DD HH:MM:SS'
 * @returns {{ hoursNotice: number, percent: 0|50|100, amount: number }}
 */
function calculateRefund(amountPaid, apptDateTime, now) {
  const hoursNotice = (toMs(apptDateTime) - toMs(now)) / MS_PER_HOUR;

  let percent;
  if (hoursNotice > 48) percent = 100;
  else if (hoursNotice >= 24) percent = 50;
  else percent = 0;

  // Work in cents to avoid floating-point errors (e.g. 150 * 0.5).
  const amount = Math.round(amountPaid * percent) / 100;

  return { hoursNotice: Math.round(hoursNotice * 100) / 100, percent, amount };
}

module.exports = {
  OPENING_HOUR,
  CLOSING_HOUR,
  SLOT_MINUTES,
  MAX_APPOINTMENTS_PER_DAY,
  parseClinicDateTime,
  validateSlot,
  calculateRefund,
};
