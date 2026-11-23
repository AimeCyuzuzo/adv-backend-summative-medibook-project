const { getRedis } = require('../config/redis');
const { waitlistKey, waitlistMembersKey, WAITLIST_PROCESSING, WAITLIST_FAILED } = require('./keys');

// A waitlist is a Redis list per doctor per day. Each entry is a JSON string:
//   { patient_id, doctor_id, date, joined_at }
// The exact string is used to remove/move the entry, so it is never re-serialised.
//
// Lifecycle of an entry (it is ALWAYS in exactly one place, so it can't vanish):
//   waitlist:<doctor>:<date>  --claimNext()-->  waitlist:processing
//        ^                                         |
//        |---------------- putBack() (to front) ---|   booking failed, may succeed later
//                                                  |--> confirm()     booked → appointments table
//                                                  |--> deadLetter()  can never be booked → waitlist:failed

/**
 * Adds a patient to the end of a doctor's waitlist for a day.
 * @returns {Promise<{ added: boolean, position: number }>} position is 1-based
 */
async function join({ patient_id, doctor_id, date }) {
  const redis = await getRedis();
  const key = waitlistKey(doctor_id, date);
  const membersKey = waitlistMembersKey(doctor_id, date);

  // SADD returns 0 if the patient is already in the set → already waiting.
  const isNew = await redis.sAdd(membersKey, String(patient_id));
  if (!isNew) {
    return { added: false, position: await positionOf(key, patient_id) };
  }

  const entry = JSON.stringify({ patient_id, doctor_id, date, joined_at: new Date().toISOString() });
  try {
    const length = await redis.rPush(key, entry);
    return { added: true, position: length };
  } catch (err) {
    await redis.sRem(membersKey, String(patient_id)); // undo so the patient can retry
    throw err;
  }
}

async function positionOf(key, patientId) {
  const redis = await getRedis();
  const entries = await redis.lRange(key, 0, -1);
  const index = entries.findIndex((raw) => JSON.parse(raw).patient_id === patientId);
  return index === -1 ? null : index + 1;
}

/** All entries on a waitlist, in order (first = next to be promoted). */
async function list(doctorId, date) {
  const redis = await getRedis();
  const entries = await redis.lRange(waitlistKey(doctorId, date), 0, -1);
  return entries.map((raw, i) => ({ position: i + 1, ...JSON.parse(raw) }));
}

/**
 * Atomically moves the FIRST entry of a waitlist into the processing list (LMOVE).
 * @returns {Promise<string|null>} the raw entry, or null if the waitlist is empty
 */
async function claimNext(doctorId, date) {
  const redis = await getRedis();
  return redis.lMove(waitlistKey(doctorId, date), WAITLIST_PROCESSING, 'LEFT', 'RIGHT');
}

/** Booking succeeded: remove the entry from processing and from the members set. */
async function confirm(rawEntry) {
  const { patient_id, doctor_id, date } = JSON.parse(rawEntry);
  const redis = await getRedis();
  await redis
    .multi()
    .lRem(WAITLIST_PROCESSING, 1, rawEntry)
    .sRem(waitlistMembersKey(doctor_id, date), String(patient_id))
    .exec();
}

/** Booking failed but may succeed later: put the entry back at the FRONT of its waitlist. */
async function putBack(rawEntry) {
  const { doctor_id, date } = JSON.parse(rawEntry);
  const redis = await getRedis();
  await redis
    .multi()
    .lRem(WAITLIST_PROCESSING, 1, rawEntry)
    .lPush(waitlistKey(doctor_id, date), rawEntry)
    .exec();
}

/** Booking can never succeed (e.g. patient deleted): keep a record in waitlist:failed. */
async function deadLetter(rawEntry, reason) {
  const { patient_id, doctor_id, date } = JSON.parse(rawEntry);
  const record = JSON.stringify({ entry: JSON.parse(rawEntry), reason, failed_at: new Date().toISOString() });
  const redis = await getRedis();
  await redis
    .multi()
    .lRem(WAITLIST_PROCESSING, 1, rawEntry)
    .rPush(WAITLIST_FAILED, record)
    .sRem(waitlistMembersKey(doctor_id, date), String(patient_id))
    .exec();
}

/**
 * Crash recovery, run when the worker starts: anything left in processing was
 * mid-promotion when the worker stopped, so it goes back to the front of its waitlist.
 * @returns {Promise<number>} how many entries were recovered
 */
async function recoverProcessing() {
  const redis = await getRedis();
  const stuck = await redis.lRange(WAITLIST_PROCESSING, 0, -1);
  for (const raw of stuck) await putBack(raw);
  return stuck.length;
}

module.exports = { join, list, claimNext, confirm, putBack, deadLetter, recoverProcessing };
