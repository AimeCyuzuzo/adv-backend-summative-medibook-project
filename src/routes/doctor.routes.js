const { Router } = require('express');
const controller = require('../controllers/doctor.controller');

// Mounted at /api/doctors in src/app.js
const router = Router();

router.get('/', controller.listDoctors);
router.post('/', controller.createDoctor);
router.get('/:id', controller.getDoctor);
router.get('/:id/stats', controller.getDoctorStats);
router.patch('/:id', controller.updateDoctor);
router.delete('/:id', controller.deleteDoctor);

module.exports = router;
