const pool = require('../config/db');

// All SQL for the patients table lives here.
// Every value goes through a ? placeholder — never string concatenation.

const COLUMNS = 'patient_id, full_name, email, phone, created_at';

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients ORDER BY patient_id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients WHERE patient_id = ?`, [id]);
  return rows[0] || null;
}

async function create({ full_name, email, phone }) {
  const [result] = await pool.execute(
    'INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)',
    [full_name, email, phone]
  );
  return findById(result.insertId);
}

// Partial update: COALESCE keeps the current value when a field is not provided (NULL).
async function update(id, { full_name = null, email = null, phone = null }) {
  const [result] = await pool.execute(
    `UPDATE patients
        SET full_name = COALESCE(?, full_name),
            email     = COALESCE(?, email),
            phone     = COALESCE(?, phone)
      WHERE patient_id = ?`,
    [full_name, email, phone, id]
  );
  if (result.affectedRows === 0) return null;
  return findById(id);
}

// Returns true if a row was deleted.
// Throws ER_ROW_IS_REFERENCED_2 if the patient has appointments (FK ON DELETE RESTRICT).
async function remove(id) {
  const [result] = await pool.execute('DELETE FROM patients WHERE patient_id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, remove };
