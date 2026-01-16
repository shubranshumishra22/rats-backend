const prisma = require('../db/prisma');
const { NotFoundError } = require('../errors');

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      points: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

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
    },
    take: 20,
  });

  return users;
};

module.exports = {
  getUserById,
  searchUsers,
};
