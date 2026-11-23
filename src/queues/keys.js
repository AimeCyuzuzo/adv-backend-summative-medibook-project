// All Redis key names in one place.

// Job queue. Producers LPUSH; the worker takes from the RIGHT end (FIFO).
const JOBS = 'queue:jobs';
const JOBS_PROCESSING = 'queue:jobs:processing'; // jobs the worker is working on right now
const JOBS_FAILED = 'queue:jobs:failed';         // jobs that failed too many times (kept for inspection)

// Waitlists: one Redis list per doctor per day, oldest entry at the LEFT (head).
const waitlistKey = (doctorId, date) => `waitlist:${doctorId}:${date}`;
// Set of patient_ids on that waitlist, so a patient can't join the same list twice.
const waitlistMembersKey = (doctorId, date) => `waitlist:${doctorId}:${date}:members`;
const WAITLIST_PROCESSING = 'waitlist:processing'; // entries being promoted right now
const WAITLIST_FAILED = 'waitlist:failed';         // entries that can never be booked (e.g. patient deleted)

module.exports = {
  JOBS,
  JOBS_PROCESSING,
  JOBS_FAILED,
  waitlistKey,
  waitlistMembersKey,
  WAITLIST_PROCESSING,
  WAITLIST_FAILED,
};
