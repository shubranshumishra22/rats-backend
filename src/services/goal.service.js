const prisma = require('../db/prisma');
const config = require('../config');
const { NotFoundError, ForbiddenError, BadRequestError, ConflictError } = require('../errors');
const { getFriendIds } = require('./friend.service');

// Lazy import to avoid circular dependency
let activityService = null;
const getActivityService = () => {
  if (!activityService) {
    activityService = require('./activity.service');
  }
  return activityService;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

const getGoals = async (userId, options = {}) => {
  const { frequency, page = 1, limit = DEFAULT_PAGE_SIZE } = options;
  const take = Math.min(limit, MAX_PAGE_SIZE);
  const skip = (page - 1) * take;

  const where = { userId };
  if (frequency) {
    where.frequency = frequency;
  }

  const [goals, total] = await Promise.all([
    prisma.goal.findMany({
      where,
      include: {
        sharedGoals: {
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        },
        completions: {
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { completions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.goal.count({ where }),
  ]);

  // Add completion status for current period
  const goalsWithStatus = goals.map((goal) => ({
    ...goal,
    completedThisPeriod: goal.completions.length > 0 && isCompletedThisPeriod(goal.completions[0], goal.frequency),
    totalCompletions: goal._count.completions,
    sharedWith: goal.sharedGoals.map((sg) => sg.user),
  }));

  return {
    goals: goalsWithStatus,
    pagination: {
      page,
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  };
};

const getSharedGoals = async (userId) => {
  const sharedGoals = await prisma.sharedGoal.findMany({
    where: { userId },
    include: {
      goal: {
        include: {
          user: {
            select: { id: true, username: true },
          },
          completions: {
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return sharedGoals.map((sg) => ({
    ...sg.goal,
    sharedBy: sg.goal.user,
  }));
};

const getGoalById = async (goalId, userId) => {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      user: {
        select: { id: true, username: true },
      },
      sharedGoals: {
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      },
      completions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      },
    },
  });

  if (!goal) {
    throw new NotFoundError('Goal not found');
  }

  const isOwner = goal.userId === userId;
  const isShared = goal.sharedGoals.some((sg) => sg.userId === userId);

  if (!isOwner && !isShared) {
    throw new ForbiddenError('Not authorized to view this goal');
  }

  return goal;
};

const createGoal = async (userId, data) => {
  const points = config.points[data.frequency];

  const goal = await prisma.goal.create({
    data: {
      ...data,
      points,
      userId,
    },
  });

  // Log activity
  try {
    await getActivityService().logGoalCreated(userId, goal);
  } catch (error) {
    console.error('Failed to log goal created activity:', error);
  }

  return goal;
};

const updateGoal = async (goalId, userId, data) => {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    throw new NotFoundError('Goal not found');
  }

  if (goal.userId !== userId) {
    throw new ForbiddenError('Not authorized to update this goal');
  }

  const updateData = { ...data };
  if (data.frequency) {
    updateData.points = config.points[data.frequency];
  }

  return prisma.goal.update({
    where: { id: goalId },
    data: updateData,
  });
};

const deleteGoal = async (goalId, userId) => {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
  });

  if (!goal) {
    throw new NotFoundError('Goal not found');
  }

  if (goal.userId !== userId) {
    throw new ForbiddenError('Not authorized to delete this goal');
  }

  await prisma.goal.delete({
    where: { id: goalId },
  });
};

const shareGoal = async (goalId, userId, friendIds) => {
  // Verify goal exists and user owns it
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, userId: true, title: true },
  });

  if (!goal) {
    throw new NotFoundError('Goal not found');
  }

  // Authorization: Only goal owner can share
  if (goal.userId !== userId) {
    throw new ForbiddenError('Only the goal owner can share this goal');
  }

  // Prevent sharing with self
  if (friendIds.includes(userId)) {
    throw new BadRequestError('Cannot share goal with yourself');
  }

  // Get accepted friends only
  const userFriendIds = await getFriendIds(userId);
  
  // Filter to only accepted friends
  const validFriendIds = friendIds.filter((id) => userFriendIds.includes(id));

  // Check if any provided IDs were not friends
  const invalidIds = friendIds.filter((id) => !userFriendIds.includes(id) && id !== userId);
  if (invalidIds.length > 0 && validFriendIds.length === 0) {
    throw new BadRequestError('Can only share goals with accepted friends');
  }

  if (validFriendIds.length === 0) {
    throw new BadRequestError('No valid friends to share with');
  }

  const existingShares = await prisma.sharedGoal.findMany({
    where: {
      goalId,
      userId: { in: validFriendIds },
    },
    select: { userId: true },
  });

  const existingUserIds = new Set(existingShares.map((s) => s.userId));
  const newFriendIds = validFriendIds.filter((id) => !existingUserIds.has(id));

  if (newFriendIds.length === 0) {
    throw new ConflictError('Goal already shared with these friends');
  }

  const sharedGoals = await prisma.sharedGoal.createMany({
    data: newFriendIds.map((friendId) => ({
      goalId,
      userId: friendId,
    })),
  });

  return { count: sharedGoals.count };
};

const completeGoal = async (goalId, userId) => {
  // Fetch goal with sharing info in a single query
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      sharedGoals: {
        where: { userId },
        select: { id: true },
      },
    },
  });

  if (!goal) {
    throw new NotFoundError('Goal not found');
  }

  // Authorization: Must be owner OR have goal shared with them
  const isOwner = goal.userId === userId;
  const isSharedWithUser = goal.sharedGoals.length > 0;

  if (!isOwner && !isSharedWithUser) {
    throw new ForbiddenError('You do not have access to complete this goal');
  }

  // Generate period key for idempotency (unique constraint in DB)
  const periodKey = generatePeriodKey(goal.frequency);

  try {
    // Use interactive transaction with serializable isolation for race condition prevention
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing completion using the unique periodKey
      const existingCompletion = await tx.goalCompletion.findUnique({
        where: {
          goalId_userId_periodKey: {
            goalId,
            userId,
            periodKey,
          },
        },
      });

      // Idempotent: Return existing completion if already completed this period
      if (existingCompletion) {
        return {
          completion: existingCompletion,
          alreadyCompleted: true,
        };
      }

      // Create completion with periodKey
      const completion = await tx.goalCompletion.create({
        data: {
          goalId,
          userId,
          points: goal.points,
          periodKey,
        },
      });

      // Update goal streak
      const goalStreak = await updateGoalStreak(tx, goalId, goal.frequency);

      // Update user streak and last active date
      const userStreak = await updateUserStreak(tx, userId);

      // Update user points atomically
      await tx.user.update({
        where: { id: userId },
        data: { 
          points: { increment: goal.points },
          lastActiveAt: new Date(),
        },
      });

      return {
        completion,
        alreadyCompleted: false,
        goalStreak,
        userStreak,
      };
    }, {
      isolationLevel: 'Serializable', // Prevents race conditions
    });

    if (result.alreadyCompleted) {
      // Return success but indicate it was already completed (idempotent)
      return {
        ...result.completion,
        goalTitle: goal.title,
        frequency: goal.frequency,
        message: `Goal already completed for this ${goal.frequency} period`,
        alreadyCompleted: true,
      };
    }

    // Log activity for goal completion
    try {
      await getActivityService().logGoalCompleted(userId, goal, goal.points, result.goalStreak.current);
    } catch (error) {
      console.error('Failed to log goal completed activity:', error);
    }

    return {
      ...result.completion,
      goalTitle: goal.title,
      frequency: goal.frequency,
      message: `Earned ${goal.points} points!`,
      alreadyCompleted: false,
      streak: result.goalStreak,
      userStreak: result.userStreak,
    };
  } catch (error) {
    // Handle unique constraint violation (race condition fallback)
    if (error.code === 'P2002') {
      // Fetch the existing completion
      const existingCompletion = await prisma.goalCompletion.findUnique({
        where: {
          goalId_userId_periodKey: {
            goalId,
            userId,
            periodKey,
          },
        },
      });

      return {
        ...existingCompletion,
        goalTitle: goal.title,
        frequency: goal.frequency,
        message: `Goal already completed for this ${goal.frequency} period`,
        alreadyCompleted: true,
      };
    }
    throw error;
  }
};

/**
 * Generate a period key based on frequency for idempotency
 * Format: "daily:YYYY-MM-DD", "weekly:YYYY-WW", "yearly:YYYY"
 */
const generatePeriodKey = (frequency) => {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return `daily:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    case 'weekly':
      // ISO week number calculation
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `weekly:${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    case 'yearly':
      return `yearly:${now.getFullYear()}`;
    default:
      return `unknown:${now.toISOString()}`;
  }
};

const unshareGoal = async (goalId, userId, friendId) => {
  // Verify goal exists
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { id: true, userId: true },
  });

  if (!goal) {
    throw new NotFoundError('Goal not found');
  }

  // Authorization: Only goal owner can unshare
  if (goal.userId !== userId) {
    throw new ForbiddenError('Only the goal owner can unshare this goal');
  }

  // Prevent unsharing from self (shouldn't happen but defensive check)
  if (friendId === userId) {
    throw new BadRequestError('Invalid operation');
  }

  // Find the shared goal record
  const sharedGoal = await prisma.sharedGoal.findFirst({
    where: {
      goalId,
      userId: friendId,
    },
  });

  if (!sharedGoal) {
    throw new NotFoundError('Goal is not shared with this user');
  }

  await prisma.sharedGoal.delete({
    where: { id: sharedGoal.id },
  });

  return { message: 'Goal unshared successfully' };
};

const getGoalStats = async (userId) => {
  const [ownGoals, sharedGoals, completions] = await Promise.all([
    prisma.goal.count({ where: { userId } }),
    prisma.sharedGoal.count({ where: { userId } }),
    prisma.goalCompletion.aggregate({
      where: { userId },
      _sum: { points: true },
      _count: true,
    }),
  ]);

  // Get streak calculation (consecutive days with completions)
  const recentCompletions = await prisma.goalCompletion.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { createdAt: true },
  });

  const streak = calculateStreak(recentCompletions);

  return {
    totalGoals: ownGoals,
    sharedWithMe: sharedGoals,
    totalCompletions: completions._count,
    totalPointsEarned: completions._sum.points || 0,
    currentStreak: streak,
  };
};

// Helper function to check if completed this period
const isCompletedThisPeriod = (completion, frequency) => {
  const now = new Date();
  const completionDate = new Date(completion.createdAt);
  
  switch (frequency) {
    case 'daily':
      return completionDate.toDateString() === now.toDateString();
    case 'weekly':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return completionDate >= startOfWeek;
    case 'yearly':
      return completionDate.getFullYear() === now.getFullYear();
    default:
      return false;
  }
};

// Helper function to calculate streak
const calculateStreak = (completions) => {
  if (completions.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completionDates = [...new Set(
    completions.map((c) => new Date(c.createdAt).toDateString())
  )];

  for (let i = 0; i < completionDates.length; i++) {
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    
    if (completionDates.includes(expectedDate.toDateString())) {
      streak++;
    } else if (i === 0) {
      // If no completion today, check if yesterday counts
      continue;
    } else {
      break;
    }
  }

  return streak;
};

const getStartOfPeriod = (frequency) => {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    case 'yearly':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return now;
  }
};

/**
 * Update goal streak when completing a goal
 */
const updateGoalStreak = async (tx, goalId, frequency) => {
  const goal = await tx.goal.findUnique({
    where: { id: goalId },
    select: { currentStreak: true, longestStreak: true },
  });

  // Get all completions for this goal to calculate streak
  const completions = await tx.goalCompletion.findMany({
    where: { goalId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { periodKey: true, createdAt: true },
  });

  const newStreak = calculateGoalStreak(completions, frequency);
  const newLongestStreak = Math.max(newStreak, goal.longestStreak);

  await tx.goal.update({
    where: { id: goalId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
    },
  });

  return { current: newStreak, longest: newLongestStreak };
};

/**
 * Update user's overall streak based on daily activity
 */
const updateUserStreak = async (tx, userId) => {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { currentStreak: true, longestStreak: true, lastActiveAt: true },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak = 1;

  if (user.lastActiveAt) {
    const lastActive = new Date(user.lastActiveAt);
    lastActive.setHours(0, 0, 0, 0);

    if (lastActive.getTime() === today.getTime()) {
      // Already active today, keep current streak
      newStreak = user.currentStreak;
    } else if (lastActive.getTime() === yesterday.getTime()) {
      // Active yesterday, increment streak
      newStreak = user.currentStreak + 1;
    }
    // Otherwise, streak resets to 1
  }

  const newLongestStreak = Math.max(newStreak, user.longestStreak);

  await tx.user.update({
    where: { id: userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
    },
  });

  return { current: newStreak, longest: newLongestStreak };
};

/**
 * Calculate streak for a specific goal based on its frequency
 */
const calculateGoalStreak = (completions, frequency) => {
  if (completions.length === 0) return 0;

  let streak = 0;
  const now = new Date();

  // Group completions by period
  const periods = completions.map(c => c.periodKey);
  const uniquePeriods = [...new Set(periods)];

  for (let i = 0; i < 365; i++) {
    const expectedPeriod = generateExpectedPeriodKey(frequency, i);
    
    if (uniquePeriods.includes(expectedPeriod)) {
      streak++;
    } else if (i === 0) {
      // Allow for not completing today yet
      continue;
    } else {
      break;
    }
  }

  return streak;
};

/**
 * Generate expected period key for a given offset from today
 */
const generateExpectedPeriodKey = (frequency, offset) => {
  const date = new Date();
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() - offset);
      return `daily:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    case 'weekly':
      date.setDate(date.getDate() - (offset * 7));
      const startOfYear = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `weekly:${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    case 'yearly':
      return `yearly:${date.getFullYear() - offset}`;
    default:
      return '';
  }
};

/**
 * Get detailed streak information for a user
 */
const getStreakInfo = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActiveAt: true,
    },
  });

  // Get streak for each daily goal
  const dailyGoals = await prisma.goal.findMany({
    where: { userId, frequency: 'daily' },
    select: {
      id: true,
      title: true,
      currentStreak: true,
      longestStreak: true,
    },
    orderBy: { currentStreak: 'desc' },
  });

  // Check if user has completed any goal today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayCompletion = await prisma.goalCompletion.findFirst({
    where: {
      userId,
      createdAt: { gte: today },
    },
  });

  // Calculate days until streak breaks (for daily goals)
  const streakExpiresAt = user.lastActiveAt 
    ? new Date(new Date(user.lastActiveAt).setDate(new Date(user.lastActiveAt).getDate() + 2))
    : null;

  return {
    currentStreak: user.currentStreak,
    longestStreak: user.longestStreak,
    lastActiveAt: user.lastActiveAt,
    completedToday: !!todayCompletion,
    streakExpiresAt,
    goalStreaks: dailyGoals,
  };
};

module.exports = {
  getGoals,
  getSharedGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  shareGoal,
  unshareGoal,
  completeGoal,
  getGoalStats,
  getStreakInfo,
};
