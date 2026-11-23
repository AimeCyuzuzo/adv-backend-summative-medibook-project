const express = require('express');
const patientRoutes = require('./routes/patient.routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Builds the Express app without starting it (server.js calls listen).
const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/patients', patientRoutes);
// TODO: app.use('/api/doctors', doctorRoutes);
// TODO: appointments, reports, /feedback

app.use(notFound);
app.use(errorHandler);

module.exports = app;
