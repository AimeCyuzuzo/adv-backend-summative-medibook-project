const { Router } = require('express');
const controller = require('../controllers/patient.controller');

// Mounted at /api/patients in src/app.js
const router = Router();

router.get('/', controller.listPatients);
router.post('/', controller.createPatient);
router.get('/:id', controller.getPatient);
router.patch('/:id', controller.updatePatient);
router.delete('/:id', controller.deletePatient);

module.exports = router;
