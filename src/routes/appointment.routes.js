const { Router } = require('express');
const controller = require('../controllers/appointment.controller');

// Mounted at /api/appointments in src/app.js
const router = Router();

router.post('/', controller.bookAppointment);
router.get('/:id', controller.getAppointment);
router.delete('/:id', controller.cancelAppointment);

module.exports = router;
