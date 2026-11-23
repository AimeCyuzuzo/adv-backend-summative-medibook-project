require('dotenv').config({ quiet: true });

const app = require('./src/app');
const pool = require('./src/config/db');
const { getRedis } = require('./src/config/redis');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  // Fail fast with a clear message if MySQL or Redis isn't reachable.
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`✗ Cannot connect to MySQL (${err.code || err.message}). Is it running? Try: docker compose up -d`);
    process.exit(1);
  }

  try {
    await getRedis();
  } catch (err) {
    console.error(`✗ Cannot connect to Redis (${err.code || err.message}). Is it running? Try: docker compose up -d`);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`MediBook API listening on http://localhost:${PORT}`);
    console.log('Remember to start the worker in another terminal: npm run worker');
  });
}

start();
