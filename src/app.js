const express = require('express');
const patientRoutes = require('./routes/patient.routes');
const doctorRoutes = require('./routes/doctor.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Builds the Express app without starting it (server.js calls listen).
const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
// TODO: doctor stats, reports, /feedback

app.use(notFound);
app.use(errorHandler);

module.exports = app;
