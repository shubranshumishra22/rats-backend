const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log error
  if (statusCode >= 500) {
    logger.error(`${err.stack}`);
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method}`);
  }

  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' && statusCode === 500
        ? 'Internal server error'
        : message,
    },
  };

  // Include validation errors if present
  if (err.errors) {
    response.error.details = err.errors;
  }

  res.status(statusCode).json(response);
};

module.exports = { errorHandler };
