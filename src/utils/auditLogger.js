const fs = require('node:fs/promises');
const path = require('node:path');

// Default: <project root>/logs/audit.log (override with AUDIT_LOG_PATH, e.g. in tests).
const DEFAULT_LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'audit.log');

function logFilePath() {
  return process.env.AUDIT_LOG_PATH || DEFAULT_LOG_FILE;
}

/**
 * Appends one event to the audit log as a single JSON line (JSON Lines format).
 *
 * - Async and non-blocking: uses fs/promises (no *Sync calls), so the event loop
 *   keeps serving other requests while the write happens.
 * - Creates the logs/ directory on first use (mkdir recursive is a no-op if it exists,
 *   and also recovers if the folder is deleted while the server is running).
 * - NEVER throws or rejects: a logging failure is reported to stderr but must not
 *   fail the user's request. Callers can safely fire-and-forget it.
 *
 * @param {string} event   e.g. 'APPOINTMENT_BOOKED'
 * @param {object} details event data
 * @returns {Promise<boolean>} true if written, false if logging failed
 */
async function audit(event, details = {}) {
  const file = logFilePath();
  const line = `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`;

  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.appendFile(file, line, 'utf8');
    return true;
  } catch (err) {
    console.error(`[audit] failed to write ${event} to ${file}: ${err.message}`);
    return false;
  }
}

module.exports = { audit, logFilePath };
