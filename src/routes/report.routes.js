const { Router } = require('express');
const controller = require('../controllers/report.controller');

// Mounted at /api/reports in src/app.js
const router = Router();

router.get('/doctors', controller.getDoctorsReport);
router.get('/busy-days', controller.getBusyDaysReport);

module.exports = router;
