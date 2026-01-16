const jwt = require('jsonwebtoken');
const config = require('../config');
const { UnauthorizedError } = require('../errors');
const prisma = require('../db/prisma');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access token required');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.jwt.accessSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, username: true, points: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Access token expired'));
    } else if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid access token'));
    } else {
      next(error);
    }
  }
};

module.exports = { authenticate };
