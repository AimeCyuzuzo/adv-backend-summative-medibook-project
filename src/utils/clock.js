// The clinic's clock. Business rules (future-only bookings, refund tiers,
// "per day" limits) use clinic local time, so "now" is computed here in Node
// and passed into SQL as a parameter — never taken from the DB's NOW().

const DEFAULT_TZ = 'Africa/Kigali';

/**
 * Formats a Date as clinic local time in MySQL DATETIME format.
 * 'sv-SE' is used only because it formats as 'YYYY-MM-DD HH:MM:SS'.
 * @param {Date} [date=new Date()]
 * @param {string} [timeZone]  IANA zone, defaults to CLINIC_TZ
 * @returns {string} e.g. '2026-11-23 15:06:12'
 */
function toClinicDateTime(date = new Date(), timeZone = process.env.CLINIC_TZ || DEFAULT_TZ) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

// Current clinic time as 'YYYY-MM-DD HH:MM:SS'.
function clinicNow() {
  return toClinicDateTime(new Date());
}

module.exports = { toClinicDateTime, clinicNow, DEFAULT_TZ };
