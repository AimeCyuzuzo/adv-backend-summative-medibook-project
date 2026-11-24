const { Router } = require('express');
const controller = require('../controllers/feedback.controller');

// Mounted at /feedback in src/app.js
const router = Router();

router.get('/', controller.showFeedbackForm);
router.post('/', controller.submitFeedback);

module.exports = router;
