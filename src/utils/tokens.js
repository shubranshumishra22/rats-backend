const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const prisma = require('../db/prisma');

// Parse duration string (e.g., '14d', '7d', '24h') to milliseconds
const parseDurationToMs = (duration) => {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
};

// Parse duration string to days for database expiration
const parseDurationToDays = (duration) => {
  const ms = parseDurationToMs(duration);
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
};

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
};

const generateRefreshToken = async (userId) => {
  // Generate a secure random token
  const token = crypto.randomBytes(64).toString('hex');
  
  // Calculate expiration based on config
  const days = parseDurationToDays(config.jwt.refreshExpiresIn);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  // Store in database
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

const verifyRefreshToken = async (token) => {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!refreshToken) {
    return null;
  }

  // Check if expired
  if (new Date() > refreshToken.expiresAt) {
    // Delete expired token
    await prisma.refreshToken.delete({
      where: { id: refreshToken.id },
    });
    return null;
  }

  return refreshToken;
};

const revokeRefreshToken = async (token) => {
  try {
    await prisma.refreshToken.delete({
      where: { token },
    });
  } catch (error) {
    // Token might not exist, that's ok
  }
};

const revokeAllUserRefreshTokens = async (userId) => {
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
};

const rotateRefreshToken = async (oldToken, userId) => {
  // Delete old token
  await revokeRefreshToken(oldToken);
  
  // Generate new token
  return generateRefreshToken(userId);
};

const setRefreshTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = parseDurationToMs(config.jwt.refreshExpiresIn);
  
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? 'none' : 'strict', // 'none' for cross-origin in production
    maxAge,
    path: '/',
  });
};

const clearRefreshTokenCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    path: '/',
  });
};

// Cleanup expired tokens (run periodically)
const cleanupExpiredTokens = async () => {
  await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  rotateRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  cleanupExpiredTokens,
};
