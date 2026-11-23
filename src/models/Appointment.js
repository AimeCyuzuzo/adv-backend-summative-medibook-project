const pool = require('../config/db');

// All SQL for the appointments table lives here.
// Functions take an optional `db` (a transaction connection); default is the pool.

const COLUMNS = `
  a.appointment_id, a.appt_ref, a.patient_id, p.full_name AS patient_name,
  a.doctor_id, d.full_name AS doctor_name, d.specialty, d.room,
  a.appt_datetime, a.amount_paid, a.status, a.booked_on, a.cancelled_at, a.refund_amount`;

const FROM = `
  FROM appointments a
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id`;

async function findById(id, db = pool) {
  const [rows] = await db.execute(`SELECT ${COLUMNS} ${FROM} WHERE a.appointment_id = ?`, [id]);
  return rows[0] || null;
}

/**
 * Locks one appointment row until the transaction ends (used when cancelling),
 * so two concurrent cancellations cannot both refund it.
 */
async function lockById(db, id) {
  const [rows] = await db.execute(
    `SELECT appointment_id, doctor_id, appt_datetime, amount_paid, status
       FROM appointments
      WHERE appointment_id = ?
      FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Number of BOOKED (not cancelled) appointments a doctor has on one calendar day.
 * Uses a range on appt_datetime (not DATE(appt_datetime) = ?) so the
 * (doctor_id, appt_datetime) index can be used.
 * @param {string} day 'YYYY-MM-DD'
 */
async function countBookedForDoctorOnDay(db, doctorId, day) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS booked
       FROM appointments
      WHERE doctor_id = ?
        AND status = 'BOOKED'
        AND appt_datetime >= CAST(? AS DATE)
        AND appt_datetime <  CAST(? AS DATE) + INTERVAL 1 DAY`,
    [doctorId, day, day]
  );
  return Number(rows[0].booked);
}

/**
 * Inserts a booking. Throws ER_DUP_ENTRY on uq_doctor_slot if the slot is taken
 * (including when two requests race for the same slot at the same instant).
 * @returns {number} new appointment_id
 */
async function create(db, { appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, booked_on }) {
  const [result] = await db.execute(
    `INSERT INTO appointments (appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, booked_on)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, booked_on]
  );
  return result.insertId;
}

/**
 * Cancels a booking AND records its refund in one statement.
 * `status = 'BOOKED'` in the WHERE makes it a no-op if already cancelled.
 * Setting status = 'CANCELLED' makes the generated active_slot NULL, which frees the slot.
 * @returns {boolean} true if the row was cancelled
 */
async function cancel(db, id, { cancelled_at, refund_amount }) {
  const [result] = await db.execute(
    `UPDATE appointments
        SET status = 'CANCELLED', cancelled_at = ?, refund_amount = ?
      WHERE appointment_id = ? AND status = 'BOOKED'`,
    [cancelled_at, refund_amount, id]
  );
  return result.affectedRows === 1;
}

module.exports = { findById, lockById, countBookedForDoctorOnDay, create, cancel };
