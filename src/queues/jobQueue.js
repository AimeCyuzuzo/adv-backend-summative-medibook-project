const crypto = require('node:crypto');
const { getRedis } = require('../config/redis');
const { JOBS } = require('./keys');

const JOB_TYPES = Object.freeze({
  SEND_CONFIRMATION: 'SEND_CONFIRMATION', // payload: { appointment_id }
  SLOT_FREED: 'SLOT_FREED',               // payload: { doctor_id, appt_datetime }
});

/**
 * Adds a job to the queue for the worker process. Throws if Redis is unavailable.
 */
async function enqueue(type, payload) {
  const job = {
    id: crypto.randomUUID(),
    type,
    payload,
    attempts: 0,
    created_at: new Date().toISOString(),
  };
  const redis = await getRedis();
  await redis.lPush(JOBS, JSON.stringify(job));
  return job;
}

/**
 * Same as enqueue(), but never throws — for use AFTER a request has already
 * succeeded (e.g. booking committed). A queue outage is logged, not turned into a 500.
 */
async function enqueueSafely(type, payload) {
  try {
    return await enqueue(type, payload);
  } catch (err) {
    console.error(`[queue] failed to enqueue ${type}: ${err.message}`);
    return null;
  }
}

module.exports = { JOB_TYPES, enqueue, enqueueSafely };
