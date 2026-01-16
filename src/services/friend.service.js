const prisma = require('../db/prisma');
const { BadRequestError, NotFoundError, ConflictError } = require('../errors');

// Lazy import to avoid circular dependency
let activityService = null;
const getActivityService = () => {
  if (!activityService) {
    activityService = require('./activity.service');
  }
  return activityService;
};

const getFriends = async (userId) => {
  const friendships = await prisma.friend.findMany({
    where: {
      AND: [
        { status: 'accepted' },
        {
          OR: [
            { userIdInitiated: userId },
            { userIdReceived: userId },
          ],
        },
      ],
    },
    include: {
      userInitiated: {
        select: { id: true, username: true, email: true, points: true },
      },
      userReceived: {
        select: { id: true, username: true, email: true, points: true },
      },
    },
  });

  return friendships.map((friendship) => {
    const friend = friendship.userIdInitiated === userId
      ? friendship.userReceived
      : friendship.userInitiated;
    return {
      friendshipId: friendship.id,
      ...friend,
    };
  });
};

const getPendingRequests = async (userId) => {
  const requests = await prisma.friend.findMany({
    where: {
      userIdReceived: userId,
      status: 'pending',
    },
    include: {
      userInitiated: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  return requests.map((request) => ({
    id: request.id,
    from: request.userInitiated,
    createdAt: request.createdAt,
  }));
};

const sendRequest = async (fromUserId, toUserId) => {
  if (fromUserId === toUserId) {
    throw new BadRequestError('Cannot send friend request to yourself');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: toUserId },
  });

  if (!targetUser) {
    throw new NotFoundError('User not found');
  }

  const existingFriendship = await prisma.friend.findFirst({
    where: {
      OR: [
        { userIdInitiated: fromUserId, userIdReceived: toUserId },
        { userIdInitiated: toUserId, userIdReceived: fromUserId },
      ],
    },
  });

  if (existingFriendship) {
    if (existingFriendship.status === 'accepted') {
      throw new ConflictError('Already friends');
    }
    if (existingFriendship.status === 'pending') {
      throw new ConflictError('Friend request already pending');
    }
    if (existingFriendship.status === 'blocked') {
      throw new BadRequestError('Cannot send friend request');
    }
  }

  const request = await prisma.friend.create({
    data: {
      userIdInitiated: fromUserId,
      userIdReceived: toUserId,
      status: 'pending',
    },
    include: {
      userReceived: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  return {
    id: request.id,
    to: request.userReceived,
    status: request.status,
    createdAt: request.createdAt,
  };
};

const respondToRequest = async (userId, requestId, action) => {
  const request = await prisma.friend.findFirst({
    where: {
      id: requestId,
      userIdReceived: userId,
      status: 'pending',
    },
    include: {
      userInitiated: {
        select: { id: true, username: true, email: true },
      },
      userReceived: {
        select: { id: true, username: true, email: true },
      },
    },
  });

  if (!request) {
    throw new NotFoundError('Friend request not found');
  }

  if (action === 'accept') {
    const updated = await prisma.friend.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        userInitiated: {
          select: { id: true, username: true, email: true, points: true },
        },
        userReceived: {
          select: { id: true, username: true, email: true, points: true },
        },
      },
    });

    // Log activity for both users
    try {
      await getActivityService().logFriendAdded(userId, updated.userInitiated.username);
      await getActivityService().logFriendAdded(updated.userInitiated.id, updated.userReceived.username);
    } catch (error) {
      console.error('Failed to log friend added activity:', error);
    }

    return {
      message: 'Friend request accepted',
      friend: updated.userInitiated,
    };
  }

  await prisma.friend.delete({
    where: { id: requestId },
  });

  return { message: 'Friend request rejected' };
};

const removeFriend = async (userId, friendshipId) => {
  const friendship = await prisma.friend.findFirst({
    where: {
      id: friendshipId,
      status: 'accepted',
      OR: [
        { userIdInitiated: userId },
        { userIdReceived: userId },
      ],
    },
  });

  if (!friendship) {
    throw new NotFoundError('Friendship not found');
  }

  await prisma.friend.delete({
    where: { id: friendshipId },
  });
};

const getFriendIds = async (userId) => {
  const friendships = await prisma.friend.findMany({
    where: {
      status: 'accepted',
      OR: [
        { userIdInitiated: userId },
        { userIdReceived: userId },
      ],
    },
    select: {
      userIdInitiated: true,
      userIdReceived: true,
    },
  });

  return friendships.map((f) => 
    f.userIdInitiated === userId ? f.userIdReceived : f.userIdInitiated
  );
};

module.exports = {
  getFriends,
  getPendingRequests,
  sendRequest,
  respondToRequest,
  removeFriend,
  getFriendIds,
};
