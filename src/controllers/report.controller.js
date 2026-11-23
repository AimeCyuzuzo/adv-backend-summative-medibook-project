const Report = require('../models/Report');
const { MAX_APPOINTMENTS_PER_DAY } = require('../utils/booking-rules');

const BUSY_THRESHOLD_PCT = 80;

// GET /api/reports/doctors
async function getDoctorsReport(req, res) {
  const rows = await Report.doctorsReport();
  res.json({ data: rows });
}

// GET /api/reports/busy-days
async function getBusyDaysReport(req, res) {
  const rows = await Report.busyDaysReport({
    dailyCap: MAX_APPOINTMENTS_PER_DAY,
    thresholdPct: BUSY_THRESHOLD_PCT,
  });
  res.json({
    meta: { daily_cap: MAX_APPOINTMENTS_PER_DAY, threshold_pct: BUSY_THRESHOLD_PCT },
    data: rows,
  });
}

module.exports = { getDoctorsReport, getBusyDaysReport };
