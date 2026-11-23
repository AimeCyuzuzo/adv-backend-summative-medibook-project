const pool = require('./db');

/**
 * Runs `work(conn)` inside a single MySQL transaction.
 * Commits if it resolves; rolls back if it throws — so every statement inside
 * succeeds or fails together. Always releases the connection back to the pool.
 *
 * Controllers use this to group several model calls; they pass `conn` through
 * to the models and never write SQL themselves.
 */
async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { withTransaction };
