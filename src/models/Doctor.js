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

module.exports = { findAll, findById, create, update, remove };
