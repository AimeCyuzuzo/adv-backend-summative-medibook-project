// MediBook background worker — a separate process from the web server (Part E).
// Start with: npm run worker
//
// Processes jobs from the Redis list `queue:jobs`:
//   SEND_CONFIRMATION → writes the confirmation message to the audit log
//   SLOT_FREED        → books the first patient on that doctor/day waitlist
//
// Reliable queue pattern: BLMOVE atomically moves a job into `queue:jobs:processing`
// and it is only removed after it succeeds. Failed jobs are retried up to MAX_ATTEMPTS,
// then parked in `queue:jobs:failed`. Anything left in processing after a crash is
// requeued on the next start. (Recovery assumes a single worker process.)

require('dotenv').config({ quiet: true });

const pool = require('./src/config/db');
const { createRedisClient, getRedis, closeRedis } = require('./src/config/redis');
const { JOBS, JOBS_PROCESSING, JOBS_FAILED } = require('./src/queues/keys');
const Waitlist = require('./src/queues/waitlist');
const handlers = require('./src/worker/handlers');

const MAX_ATTEMPTS = 3;
const POLL_TIMEOUT_SECONDS = 5; // BLMOVE wakes up at least this often to check for shutdown
const RETRY_DELAY_MS = 2000;    // wait before retrying when Redis/MySQL is unavailable

let stopping = false;
let started = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(message) {
  console.log(`[worker ${new Date().toISOString()}] ${message}`);
}

async function recoverAfterCrash(redis) {
  // Jobs: move back to the consumer end of the queue so they are processed next.
  let jobs = 0;
  while (await redis.lMove(JOBS_PROCESSING, JOBS, 'RIGHT', 'RIGHT')) jobs += 1;
  const entries = await Waitlist.recoverProcessing();
  if (jobs || entries) log(`recovered ${jobs} job(s) and ${entries} waitlist entr(ies) from a previous run`);
}

async function handleJob(redis, rawJob) {
  let job;
  try {
    job = JSON.parse(rawJob);
  } catch {
    await redis.multi().lRem(JOBS_PROCESSING, 1, rawJob).rPush(JOBS_FAILED, rawJob).exec();
    log('discarded malformed job → queue:jobs:failed');
    return;
  }

  const handler = handlers[job.type];
  try {
    if (!handler) throw new Error(`unknown job type ${job.type}`);
    const result = await handler(job.payload);
    await redis.lRem(JOBS_PROCESSING, 1, rawJob);
    log(`${job.type} ${job.id} done ${JSON.stringify(result)}`);
  } catch (err) {
    const retry = { ...job, attempts: job.attempts + 1, last_error: err.message };
    const next = retry.attempts < MAX_ATTEMPTS ? JOBS : JOBS_FAILED;
    // Atomic: remove from processing and requeue (or park) in one step.
    await redis.multi().lRem(JOBS_PROCESSING, 1, rawJob).lPush(next, JSON.stringify(retry)).exec();
    log(`${job.type} ${job.id} failed (attempt ${retry.attempts}/${MAX_ATTEMPTS}): ${err.message}` +
        (next === JOBS_FAILED ? ' → queue:jobs:failed' : ' → requeued'));
  }
}

async function main() {
  await pool.query('SELECT 1'); // fail fast if MySQL is down
  const redis = await getRedis(); // normal commands
  const blocking = createRedisClient('worker-blocking'); // BLMOVE blocks its connection
  await blocking.connect();

  await recoverAfterCrash(redis);
  started = true;
  log('waiting for jobs (Ctrl+C to stop)');

  while (!stopping) {
    try {
      // Producers LPUSH, so the oldest job is on the RIGHT → FIFO.
      const rawJob = await blocking.blMove(JOBS, JOBS_PROCESSING, 'RIGHT', 'LEFT', POLL_TIMEOUT_SECONDS);
      if (rawJob) await handleJob(redis, rawJob);
    } catch (err) {
      // Redis (or MySQL) is temporarily unavailable. The client reconnects on its own;
      // wait and try again instead of crashing. A job interrupted here stays in
      // queue:jobs:processing and is requeued by recoverAfterCrash() on the next start.
      log(`queue unavailable (${err.message}), retrying in ${RETRY_DELAY_MS / 1000}s`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  await blocking.close();
  await closeRedis();
  await pool.end();
  log('stopped');
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`${signal} received, finishing current job...`);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  if (started) console.error(`✗ worker crashed: ${err.stack || err.message}`);
  else console.error(`✗ worker failed to start: ${err.code || err.message}. Are MySQL and Redis running? Try: docker compose up -d`);
  process.exit(1);
});
