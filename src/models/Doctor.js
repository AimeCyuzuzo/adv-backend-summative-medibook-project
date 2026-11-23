const pool = require('../config/db');

// All SQL for the doctors table lives here.
// Every value goes through a ? placeholder — never string concatenation.

const COLUMNS = 'doctor_id, full_name, specialty, consultation_fee, room, created_at';

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors ORDER BY doctor_id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors WHERE doctor_id = ?`, [id]);
  return rows[0] || null;
}

/**
 * Locks a doctor's row until the transaction ends (SELECT ... FOR UPDATE).
 * Concurrent bookings for the SAME doctor wait here one at a time, so the
 * "max 12 per day" count can't be read by two requests at once.
 * Bookings for different doctors are not blocked.
 */
async function lockById(db, id) {
  const [rows] = await db.execute(`SELECT ${COLUMNS} FROM doctors WHERE doctor_id = ? FOR UPDATE`, [id]);
  return rows[0] || null;
}

async function create({ full_name, specialty, consultation_fee, room }) {
  const [result] = await pool.execute(
    'INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [full_name, specialty, consultation_fee, room]
  );
  return findById(result.insertId);
}

// Partial update: COALESCE keeps the current value when a field is not provided (NULL).
// (A fee of 0 is still applied — COALESCE only skips NULL, not 0.)
async function update(id, { full_name = null, specialty = null, consultation_fee = null, room = null }) {
  const [result] = await pool.execute(
    `UPDATE doctors
        SET full_name        = COALESCE(?, full_name),
            specialty        = COALESCE(?, specialty),
            consultation_fee = COALESCE(?, consultation_fee),
            room             = COALESCE(?, room)
      WHERE doctor_id = ?`,
    [full_name, specialty, consultation_fee, room, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

// Returns true if a row was deleted.
// Throws ER_ROW_IS_REFERENCED_2 if the doctor has appointments (FK ON DELETE RESTRICT).
async function remove(id) {
  const [result] = await pool.execute('DELETE FROM doctors WHERE doctor_id = ?', [id]);
  return result.affectedRows > 0;
}

/**
 * Summary statistics for one doctor, all computed in SQL.
 *  - revenue_collected: money kept = amount paid minus refunds (paid at booking, so future bookings count)
 *  - upcoming_appointments: BOOKED appointments after `now`
 *  - next_7_days_*: BOOKED appointments from `today` for 7 days, and utilization vs 7 × daily cap
 * LEFT JOIN so a doctor with no appointments still returns a row (with zeros).
 * @returns {Promise<object|null>} null if the doctor doesn't exist
 */
async function getStatsSummary(id, { now, today, dailyCap, days }) {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id,
            d.full_name,
            d.specialty,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected,
            COUNT(CASE WHEN a.status = 'BOOKED' AND a.appt_datetime > ? THEN 1 END) AS upcoming_appointments,
            COUNT(CASE WHEN a.status = 'BOOKED'
                        AND a.appt_datetime >= CAST(? AS DATE)
                        AND a.appt_datetime <  CAST(? AS DATE) + INTERVAL ? DAY THEN 1 END) AS next_7_days_appointments,
            ROUND(
              COUNT(CASE WHEN a.status = 'BOOKED'
                          AND a.appt_datetime >= CAST(? AS DATE)
                          AND a.appt_datetime <  CAST(? AS DATE) + INTERVAL ? DAY THEN 1 END)
              * 100 / (? * ?), 1) AS next_7_days_utilization_pct
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
      WHERE d.doctor_id = ?
      GROUP BY d.doctor_id, d.full_name, d.specialty`,
    [now, today, today, days, today, today, days, dailyCap, days, id]
  );
  return rows[0] || null;
}

/**
 * Appointments per day for `days` days starting `today` — one row per day,
 * INCLUDING days with zero appointments. A recursive CTE generates the dates,
 * then appointments are LEFT JOINed onto them.
 */
async function getDailyBreakdown(id, { today, dailyCap, days }) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE calendar (day, n) AS (
       SELECT CAST(? AS DATE), 1
       UNION ALL
       SELECT day + INTERVAL 1 DAY, n + 1 FROM calendar WHERE n < ?
     )
     SELECT DATE_FORMAT(c.day, '%Y-%m-%d') AS date,
            COUNT(a.appointment_id)                  AS appointments,
            ROUND(COUNT(a.appointment_id) * 100 / ?, 1) AS utilization_pct
       FROM calendar c
       LEFT JOIN appointments a
              ON a.doctor_id = ?
             AND a.status = 'BOOKED'
             AND a.appt_datetime >= c.day
             AND a.appt_datetime <  c.day + INTERVAL 1 DAY
      GROUP BY c.day
      ORDER BY c.day`,
    [today, days, dailyCap, id]
  );
  return rows;
}

module.exports = { findAll, findById, lockById, create, update, remove, getStatsSummary, getDailyBreakdown };
