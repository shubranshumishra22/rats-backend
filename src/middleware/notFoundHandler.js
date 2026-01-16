const { NotFoundError } = require('../errors');

const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
};

module.exports = { notFoundHandler };
