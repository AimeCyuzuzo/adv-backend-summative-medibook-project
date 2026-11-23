const express = require('express');
const patientRoutes = require('./routes/patient.routes');
const doctorRoutes = require('./routes/doctor.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const reportRoutes = require('./routes/report.routes');
const waitlistRoutes = require('./routes/waitlist.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Builds the Express app without starting it (server.js calls listen).
const app = express();

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/waitlist', waitlistRoutes);
// TODO: /feedback

app.use(notFound);
app.use(errorHandler);

module.exports = app;
