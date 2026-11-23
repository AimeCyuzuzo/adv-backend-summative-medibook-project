const AppError = require('../utils/AppError');

// MySQL error codes we translate into meaningful HTTP responses.
// These are the database's last line of defence (constraints in schema.sql).
const MYSQL_ERRORS = {
  ER_DUP_ENTRY: { status: 409, message: 'A record with these details already exists' },
  ER_ROW_IS_REFERENCED_2: { status: 409, message: 'Record cannot be deleted because other records depend on it' },
  ER_NO_REFERENCED_ROW_2: { status: 422, message: 'Referenced record does not exist' },
  ER_CHECK_CONSTRAINT_VIOLATED: { status: 422, message: 'Data violates a business rule' },
};

// 404 for any route that didn't match.
function notFound(req, res, next) {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));
}

// Central error-handling middleware (must have 4 arguments).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON body sent by the client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Request body is not valid JSON' } });
  }

  if (err instanceof AppError) {
    const body = { message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json({ error: body });
  }

  const mapped = MYSQL_ERRORS[err.code];
  if (mapped) {
    return res.status(mapped.status).json({ error: { message: mapped.message } });
  }

  // Unknown error: log it, but never leak internals (SQL, stack) to the client.
  console.error(err);
  return res.status(500).json({ error: { message: 'Internal server error' } });
}

module.exports = { notFound, errorHandler };
