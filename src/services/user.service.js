const prisma = require('../db/prisma');
const { NotFoundError } = require('../errors');

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      points: true,
      currentStreak: true,
      longestStreak: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return user;
};

/**
 * Get public profile by username
 * Only returns public-safe fields (no email or sensitive data)
 */
const getPublicProfile = async (username) => {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      points: true,
      currentStreak: true,
      longestStreak: true,
      createdAt: true,
      _count: {
        select: {
          goalCompletions: true,
          goals: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    stats: {
      points: user.points,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      goalsCompleted: user._count.goalCompletions,
      totalGoals: user._count.goals,
    },
    createdAt: user.createdAt,
  };
};

/**
 * Update user profile
 */
const updateProfile = async (userId, data) => {
  const { displayName, bio, avatarUrl } = data;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      displayName,
      bio,
      avatarUrl,
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      points: true,
      currentStreak: true,
      longestStreak: true,
      createdAt: true,
    },
  });

  return user;
};

const searchUsers = async (query, currentUserId) => {
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: currentUserId } },
        {
          OR: [
            { username: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      avatarUrl: true,
    },
    take: 20,
  });

  return users;
};

module.exports = {
  getUserById,
  getPublicProfile,
  updateProfile,
  searchUsers,
};
