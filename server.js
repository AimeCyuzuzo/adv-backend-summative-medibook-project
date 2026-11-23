require('dotenv').config({ quiet: true });

const app = require('./src/app');
const pool = require('./src/config/db');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    // Fail fast with a clear message if MySQL isn't reachable.
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`✗ Cannot connect to MySQL (${err.code || err.message}). Is it running? Try: docker compose up -d`);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`MediBook API listening on http://localhost:${PORT}`);
  });
}

start();
