-- =============================================================
-- MediBook — database schema (MySQL 8.0.16+ for CHECK constraints)
-- Mirrors schema-diagram.mmd / schema-diagram.png (3NF, 3 entities)
-- =============================================================

CREATE DATABASE IF NOT EXISTS medibook
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE medibook;

-- Drop in reverse dependency order so the script can be re-run.
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS patients;

-- -------------------------------------------------------------
-- patients: people who book appointments
-- -------------------------------------------------------------
CREATE TABLE patients (
  patient_id  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(100)  NOT NULL,
  email       VARCHAR(150)  NOT NULL,
  phone       VARCHAR(20)   NOT NULL,
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_patients       PRIMARY KEY (patient_id),
  CONSTRAINT uq_patients_email UNIQUE (email)
) ENGINE = InnoDB;

-- -------------------------------------------------------------
-- doctors: specialty, consultation fee and room
-- -------------------------------------------------------------
CREATE TABLE doctors (
  doctor_id         INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  full_name         VARCHAR(100)   NOT NULL,
  specialty         VARCHAR(80)    NOT NULL,
  consultation_fee  DECIMAL(10,2)  NOT NULL,
  room              VARCHAR(10)    NOT NULL,
  created_at        DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT pk_doctors         PRIMARY KEY (doctor_id),
  CONSTRAINT chk_doctors_fee    CHECK (consultation_fee >= 0)
) ENGINE = InnoDB;

-- -------------------------------------------------------------
-- appointments: links a patient to a doctor at a date/time.
-- Cancelled rows are KEPT (refund history); status flips to CANCELLED.
-- -------------------------------------------------------------
CREATE TABLE appointments (
  appointment_id  INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  appt_ref        VARCHAR(20)    NOT NULL,
  patient_id      INT UNSIGNED   NOT NULL,
  doctor_id       INT UNSIGNED   NOT NULL,
  appt_datetime   DATETIME       NOT NULL,
  amount_paid     DECIMAL(10,2)  NOT NULL,
  status          ENUM('BOOKED', 'CANCELLED') NOT NULL DEFAULT 'BOOKED',
  booked_on       DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at    DATETIME       NULL,
  refund_amount   DECIMAL(10,2)  NULL,

  -- NULL when cancelled. UNIQUE allows many NULLs, so a cancelled slot
  -- can be rebooked while the cancelled row stays for refund history.
  active_slot     DATETIME GENERATED ALWAYS AS (
                    IF(status = 'BOOKED', appt_datetime, NULL)
                  ) STORED,

  CONSTRAINT pk_appointments PRIMARY KEY (appointment_id),
  CONSTRAINT uq_appt_ref     UNIQUE (appt_ref),

  -- A doctor cannot have two BOOKED appointments at the same date/time.
  -- Also the final guard against two simultaneous booking requests.
  CONSTRAINT uq_doctor_slot  UNIQUE (doctor_id, active_slot),

  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id)
    REFERENCES patients (patient_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)
    REFERENCES doctors (doctor_id)   ON DELETE RESTRICT ON UPDATE RESTRICT,

  -- 30-minute slots, 09:00–16:30 start times (last slot ends at 17:00).
  CONSTRAINT chk_appt_slot CHECK (
    HOUR(appt_datetime) BETWEEN 9 AND 16
    AND MINUTE(appt_datetime) IN (0, 30)
    AND SECOND(appt_datetime) = 0
  ),

  CONSTRAINT chk_appt_amount_paid CHECK (amount_paid >= 0),

  CONSTRAINT chk_appt_refund CHECK (
    refund_amount IS NULL OR refund_amount BETWEEN 0 AND amount_paid
  ),

  -- Cancellation fields are set if and only if the appointment is cancelled.
  CONSTRAINT chk_appt_cancellation CHECK (
    (status = 'BOOKED'    AND cancelled_at IS NULL     AND refund_amount IS NULL)
    OR
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND refund_amount IS NOT NULL)
  ),

  -- Speeds up the daily-cap count, doctor stats and reports.
  INDEX idx_appt_doctor_datetime (doctor_id, appt_datetime),
  INDEX idx_appt_patient (patient_id)
) ENGINE = InnoDB;
