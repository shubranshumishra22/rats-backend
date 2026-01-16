const bcrypt = require('bcrypt');
const prisma = require('../db/prisma');
const { ConflictError, UnauthorizedError } = require('../errors');
const { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require('../utils/tokens');

const SALT_ROUNDS = 12;

const register = async ({ email, username, password }) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new ConflictError('Email already registered');
    }
    throw new ConflictError('Username already taken');
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      username: true,
      points: true,
      createdAt: true,
    },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  return { user, accessToken, refreshToken };
};

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  const { password: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, accessToken, refreshToken };
};

const refresh = async (token) => {
  if (!token) {
    throw new UnauthorizedError('Refresh token required');
  }

  const tokenData = await verifyRefreshToken(token);

  if (!tokenData) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = tokenData.user;

  // Rotate refresh token for security
  const accessToken = generateAccessToken(user.id);
  const newRefreshToken = await rotateRefreshToken(token, user.id);

  return { accessToken, refreshToken: newRefreshToken };
};

const logout = async (token) => {
  if (token) {
    await revokeRefreshToken(token);
  }
};

const logoutAll = async (userId) => {
  await revokeAllUserRefreshTokens(userId);
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
};
