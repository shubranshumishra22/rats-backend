const prisma = require('../db/prisma');
const { getFriendIds } = require('./friend.service');

const ACTIVITY_TYPES = {
  GOAL_COMPLETED: 'goal_completed',
  GOAL_CREATED: 'goal_created',
  FRIEND_ADDED: 'friend_added',
  FRIEND_REQUEST_SENT: 'friend_request_sent',
  STREAK_MILESTONE: 'streak_milestone',
  POINTS_MILESTONE: 'points_milestone',
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * Create a new activity
 */
const createActivity = async (userId, type, message, metadata = null) => {
  return prisma.activity.create({
    data: {
      userId,
      type,
      message,
      metadata,
    },
  });
};

/**
 * Get activity feed for a user (their own activities + friends' activities)
 */
const getFeed = async (userId, options = {}) => {
  const { page = 1, limit = DEFAULT_PAGE_SIZE, type } = options;
  const take = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  // Get friend IDs
  const friendIds = await getFriendIds(userId);
  const userIds = [userId, ...friendIds];

  const where = {
    userId: { in: userIds },
  };

  if (type) {
    where.type = type;
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.activity.count({ where }),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
};

/**
 * Get only the user's own activities
 */
const getMyActivities = async (userId, options = {}) => {
  const { page = 1, limit = DEFAULT_PAGE_SIZE, type } = options;
  const take = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  const where = { userId };

  if (type) {
    where.type = type;
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.activity.count({ where }),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
};

/**
 * Get activities for a specific friend
 */
const getFriendActivities = async (userId, friendId, options = {}) => {
  const { page = 1, limit = DEFAULT_PAGE_SIZE } = options;
  const take = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  // Verify they are friends
  const friendIds = await getFriendIds(userId);
  if (!friendIds.includes(friendId)) {
    return { activities: [], pagination: { page, limit: take, total: 0, totalPages: 0 } };
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: friendId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.activity.count({ where: { userId: friendId } }),
  ]);

  return {
    activities,
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
};

// Activity creation helpers
const logGoalCompleted = async (userId, goal, points, streak) => {
  const streakMessage = streak > 1 ? ` (${streak} day streak! 🔥)` : '';
  const message = `Completed "${goal.title}" and earned ${points} points${streakMessage}`;
  
  await createActivity(userId, ACTIVITY_TYPES.GOAL_COMPLETED, message, {
    goalId: goal.id,
    goalTitle: goal.title,
    points,
    streak,
    frequency: goal.frequency,
  });

  // Check for streak milestones
  if ([7, 14, 30, 50, 100, 365].includes(streak)) {
    await logStreakMilestone(userId, streak, goal.title);
  }
};

const logGoalCreated = async (userId, goal) => {
  const message = `Created a new ${goal.frequency} goal: "${goal.title}"`;
  
  await createActivity(userId, ACTIVITY_TYPES.GOAL_CREATED, message, {
    goalId: goal.id,
    goalTitle: goal.title,
    frequency: goal.frequency,
  });
};

const logFriendAdded = async (userId, friendUsername) => {
  const message = `Became friends with ${friendUsername}`;
  
  await createActivity(userId, ACTIVITY_TYPES.FRIEND_ADDED, message, {
    friendUsername,
  });
};

const logStreakMilestone = async (userId, streak, goalTitle) => {
  const message = `Achieved a ${streak}-day streak on "${goalTitle}"! 🎉`;
  
  await createActivity(userId, ACTIVITY_TYPES.STREAK_MILESTONE, message, {
    streak,
    goalTitle,
  });
};

const logPointsMilestone = async (userId, totalPoints) => {
  const milestones = [100, 500, 1000, 5000, 10000];
  const milestone = milestones.find(m => totalPoints >= m && totalPoints < m + 100);
  
  if (milestone) {
    const message = `Reached ${milestone} total points! 🏆`;
    
    await createActivity(userId, ACTIVITY_TYPES.POINTS_MILESTONE, message, {
      totalPoints,
      milestone,
    });
  }
};

module.exports = {
  ACTIVITY_TYPES,
  createActivity,
  getFeed,
  getMyActivities,
  getFriendActivities,
  logGoalCompleted,
  logGoalCreated,
  logFriendAdded,
  logStreakMilestone,
  logPointsMilestone,
};
