const pool = require('../config/db');

// Reporting queries. Not a table — these read across doctors and appointments.
// All aggregation (joins, GROUP BY, HAVING) happens in SQL, not in JavaScript.

/**
 * Every doctor's appointment totals and revenue — including doctors with zero appointments.
 * LEFT JOIN keeps doctors that have no matching appointments; COUNT(a.appointment_id)
 * then counts 0 for them (COUNT ignores NULLs), and COALESCE turns their NULL SUM into 0.
 */
async function doctorsReport() {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id,
            d.full_name,
            d.specialty,
            COUNT(a.appointment_id)                                         AS total_appointments,
            COUNT(CASE WHEN a.status = 'BOOKED'    THEN 1 END)               AS booked_appointments,
            COUNT(CASE WHEN a.status = 'CANCELLED' THEN 1 END)               AS cancelled_appointments,
            COALESCE(SUM(a.amount_paid), 0)                                  AS amount_paid,
            COALESCE(SUM(a.refund_amount), 0)                                AS refunded,
            COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0)   AS revenue_collected
       FROM doctors d
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
      GROUP BY d.doctor_id, d.full_name, d.specialty
      ORDER BY revenue_collected DESC, d.full_name`
  );
  return rows;
}

/**
 * Every (doctor, date) where more than `thresholdPct`% of the daily cap is booked.
 * WHERE filters rows before grouping (only BOOKED); HAVING filters the groups after counting.
 * With a cap of 12 and 80%, a day needs more than 9.6 → at least 10 booked appointments.
 */
async function busyDaysReport({ dailyCap, thresholdPct }) {
  const [rows] = await pool.execute(
    `SELECT d.doctor_id,
            d.full_name,
            DATE_FORMAT(a.appt_datetime, '%Y-%m-%d')  AS date,
            COUNT(*)                                  AS booked_appointments,
            ROUND(COUNT(*) * 100 / ?, 1)              AS utilization_pct
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE a.status = 'BOOKED'
      -- Group by the same expression as in SELECT (required by ONLY_FULL_GROUP_BY)
      GROUP BY d.doctor_id, d.full_name, DATE_FORMAT(a.appt_datetime, '%Y-%m-%d')
     HAVING COUNT(*) > ? * ? / 100
      ORDER BY date, d.full_name`,
    [dailyCap, dailyCap, thresholdPct]
  );
  return rows;
}

module.exports = { doctorsReport, busyDaysReport };
