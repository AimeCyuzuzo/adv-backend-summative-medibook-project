-- =============================================================
-- MediBook — sample data
-- Run after schema.sql:  npm run db:reset
--
-- Covers the brief's requirements:
--   * 4 patients, 3 doctors (Dr. Asante has NO appointments)
--   * 17 appointments, incl. a doctor-day near the 12-slot cap
--     (Dr. Boateng on 2026-12-01 has 11 booked = 92% → a "busy day")
--   * past appointments (revenue history) and one cancellation with refund
-- =============================================================

USE medibook;

INSERT INTO patients (patient_id, full_name, email, phone) VALUES
  (1, 'Ama Mensah',   'ama@mail.com',   '0244-111-222'),
  (2, 'Kojo Owusu',   'kojo@mail.com',  '0555-333-444'),
  (3, 'Efua Darko',   'efua@mail.com',  '0201-555-666'),
  (4, 'Yaw Appiah',   'yaw@mail.com',   '0277-777-888');

INSERT INTO doctors (doctor_id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng', 'Dermatology',      150.00, 'R-12'),
  (2, 'Dr. Adjei',   'Paediatrics',      100.00, 'R-03'),
  (3, 'Dr. Asante',  'General Practice',  80.00, 'R-07');   -- no appointments

INSERT INTO appointments
  (appt_ref, patient_id, doctor_id, appt_datetime, amount_paid, status, booked_on, cancelled_at, refund_amount)
VALUES
  -- Past appointments (revenue already collected)
  ('AP-001', 1, 1, '2026-08-10 09:00:00', 150.00, 'BOOKED',    '2026-07-01 10:15:00', NULL, NULL),
  ('AP-002', 2, 1, '2026-08-10 09:30:00', 120.00, 'BOOKED',    '2026-07-02 14:40:00', NULL, NULL),
  ('AP-003', 1, 2, '2026-08-15 10:00:00', 100.00, 'BOOKED',    '2026-07-03 09:05:00', NULL, NULL),

  -- Cancelled >48h before → 100% refund; slot 2026-12-01 14:30 is free again
  ('AP-004', 3, 1, '2026-12-01 14:30:00', 150.00, 'CANCELLED', '2026-11-10 08:00:00', '2026-11-20 12:00:00', 150.00),

  -- Upcoming: Dr. Adjei
  ('AP-005', 3, 2, '2026-12-02 09:00:00', 100.00, 'BOOKED',    '2026-11-18 11:00:00', NULL, NULL),
  ('AP-006', 4, 2, '2026-12-03 11:30:00', 100.00, 'BOOKED',    '2026-11-19 16:20:00', NULL, NULL),

  -- Busy day: Dr. Boateng on 2026-12-01 — 11 of 12 slots booked
  ('AP-007', 1, 1, '2026-12-01 09:00:00', 150.00, 'BOOKED',    '2026-11-15 09:00:00', NULL, NULL),
  ('AP-008', 2, 1, '2026-12-01 09:30:00', 150.00, 'BOOKED',    '2026-11-15 09:10:00', NULL, NULL),
  ('AP-009', 3, 1, '2026-12-01 10:00:00', 150.00, 'BOOKED',    '2026-11-15 10:00:00', NULL, NULL),
  ('AP-010', 4, 1, '2026-12-01 10:30:00', 150.00, 'BOOKED',    '2026-11-15 11:30:00', NULL, NULL),
  ('AP-011', 1, 1, '2026-12-01 11:00:00', 150.00, 'BOOKED',    '2026-11-16 08:45:00', NULL, NULL),
  ('AP-012', 2, 1, '2026-12-01 11:30:00', 150.00, 'BOOKED',    '2026-11-16 12:00:00', NULL, NULL),
  ('AP-013', 3, 1, '2026-12-01 12:00:00', 150.00, 'BOOKED',    '2026-11-17 09:30:00', NULL, NULL),
  ('AP-014', 4, 1, '2026-12-01 13:00:00', 150.00, 'BOOKED',    '2026-11-17 15:00:00', NULL, NULL),
  ('AP-015', 1, 1, '2026-12-01 13:30:00', 150.00, 'BOOKED',    '2026-11-18 10:10:00', NULL, NULL),
  ('AP-016', 2, 1, '2026-12-01 14:00:00', 150.00, 'BOOKED',    '2026-11-18 13:25:00', NULL, NULL),
  ('AP-017', 3, 1, '2026-12-01 15:00:00', 150.00, 'BOOKED',    '2026-11-19 09:00:00', NULL, NULL);
