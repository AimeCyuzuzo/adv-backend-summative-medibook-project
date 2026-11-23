const { Router } = require('express');
const controller = require('../controllers/waitlist.controller');

// Mounted at /api/waitlist in src/app.js
const router = Router();

router.post('/', controller.joinWaitlist);
router.get('/', controller.getWaitlist);

module.exports = router;
