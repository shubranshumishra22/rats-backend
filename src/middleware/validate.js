const { ValidationError } = require('../errors');

const validate = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    req.body = parsed.body ?? req.body;
    req.query = parsed.query ?? req.query;
    req.params = parsed.params ?? req.params;

    next();
  } catch (error) {
    const errors = error.errors?.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    next(new ValidationError('Validation failed', errors));
  }
};

module.exports = { validate };
