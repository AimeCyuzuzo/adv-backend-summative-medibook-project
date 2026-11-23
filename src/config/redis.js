const { createClient } = require('redis');

function redisUrl() {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6379';
}

/**
 * Creates a NEW (unconnected) Redis client. The worker needs its own client for
 * blocking commands (BLMOVE), because a blocked connection can't run anything else.
 */
function createRedisClient(name) {
  const client = createClient({
    url: redisUrl(),
    // Fail commands immediately while disconnected instead of queueing them forever,
    // so a Redis outage can't make bookings hang (enqueueSafely logs and moves on).
    disableOfflineQueue: true,
  });
  client.on('error', (err) => console.error(`[redis:${name}] ${err.message}`));
  return client;
}

// One shared, lazily-connected client for normal (non-blocking) commands.
// The promise is cached so concurrent callers don't open several connections.
let sharedClientPromise = null;

function getRedis() {
  if (!sharedClientPromise) {
    const client = createRedisClient('shared');
    sharedClientPromise = client.connect().then(() => client);
    sharedClientPromise.catch(() => {
      sharedClientPromise = null; // allow a retry on the next call
    });
  }
  return sharedClientPromise;
}

async function closeRedis() {
  if (!sharedClientPromise) return;
  const client = await sharedClientPromise.catch(() => null);
  sharedClientPromise = null;
  if (client) await client.close();
}

module.exports = { createRedisClient, getRedis, closeRedis };
