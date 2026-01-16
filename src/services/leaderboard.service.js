const { Prisma } = require('@prisma/client');
const prisma = require('../db/prisma');
const { getFriendIds } = require('./friend.service');

/**
 * Get leaderboard among friends using optimized SQL aggregation
 * Includes current user and all accepted friends
 */
const getLeaderboard = async (userId, options = {}) => {
  const { period = 'all', limit = 50 } = options;
  const friendIds = await getFriendIds(userId);
  const userIds = [...friendIds, userId];

  if (period === 'all') {
    // Use stored points for all-time leaderboard (most efficient)
    return getAllTimeLeaderboard(userIds, userId, limit);
  }

  // For period-based leaderboards, use SQL aggregation
  return getPeriodLeaderboard(userIds, userId, period, limit);
};

/**
 * All-time leaderboard using pre-aggregated points column
 */
const getAllTimeLeaderboard = async (userIds, currentUserId, limit) => {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      username: true,
      points: true,
      _count: {
        select: { goalCompletions: true },
      },
    },
    orderBy: { points: 'desc' },
    take: limit,
  });

  return users.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    username: user.username,
    points: user.points,
    completions: user._count.goalCompletions,
    isCurrentUser: user.id === currentUserId,
  }));
};

/**
 * Period-based leaderboard using raw SQL aggregation for performance
 */
const getPeriodLeaderboard = async (userIds, currentUserId, period, limit) => {
  const startDate = getStartOfPeriod(period);

  // Use Prisma.join for UUID array
  const userIdList = Prisma.join(userIds.map(id => Prisma.sql`${id}::uuid`));

  // Raw SQL for optimal aggregation performance
  const leaderboard = await prisma.$queryRaw`
    SELECT 
      u.id,
      u.username,
      COALESCE(SUM(gc.points), 0)::int as points,
      COUNT(gc.id)::int as completions
    FROM users u
    LEFT JOIN goal_completions gc ON u.id = gc."userId" 
      AND gc."createdAt" >= ${startDate}
    WHERE u.id IN (${userIdList})
    GROUP BY u.id, u.username
    ORDER BY points DESC, completions DESC
    LIMIT ${limit}
  `;

  return leaderboard.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    username: user.username,
    points: user.points,
    completions: user.completions,
    isCurrentUser: user.id === currentUserId,
  }));
};

/**
 * Get detailed stats for leaderboard (weekly breakdown)
 */
const getLeaderboardWithStats = async (userId) => {
  const friendIds = await getFriendIds(userId);
  const userIds = [...friendIds, userId];

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Use Prisma.join for UUID array
  const userIdList = Prisma.join(userIds.map(id => Prisma.sql`${id}::uuid`));

  // Single optimized query with multiple aggregations
  const stats = await prisma.$queryRaw`
    SELECT 
      u.id,
      u.username,
      u.points as total_points,
      COALESCE(SUM(gc.points) FILTER (WHERE gc."createdAt" >= ${startOfWeek}), 0)::int as weekly_points,
      COALESCE(SUM(gc.points) FILTER (WHERE gc."createdAt" >= ${startOfMonth}), 0)::int as monthly_points,
      COUNT(gc.id) FILTER (WHERE gc."createdAt" >= ${startOfWeek})::int as weekly_completions,
      COUNT(gc.id)::int as total_completions
    FROM users u
    LEFT JOIN goal_completions gc ON u.id = gc."userId"
    WHERE u.id IN (${userIdList})
    GROUP BY u.id, u.username, u.points
    ORDER BY u.points DESC
  `;

  return stats.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    username: user.username,
    totalPoints: user.total_points,
    weeklyPoints: user.weekly_points,
    monthlyPoints: user.monthly_points,
    weeklyCompletions: user.weekly_completions,
    totalCompletions: user.total_completions,
    isCurrentUser: user.id === userId,
  }));
};

/**
 * Get user's rank among friends
 */
const getUserRank = async (userId) => {
  const friendIds = await getFriendIds(userId);
  const userIds = [...friendIds, userId];

  // Use Prisma.join for UUID array
  const userIdList = Prisma.join(userIds.map(id => Prisma.sql`${id}::uuid`));

  const result = await prisma.$queryRaw`
    WITH ranked_users AS (
      SELECT 
        id,
        points,
        RANK() OVER (ORDER BY points DESC) as rank
      FROM users
      WHERE id IN (${userIdList})
    )
    SELECT rank::int, points::int
    FROM ranked_users
    WHERE id = ${userId}::uuid
  `;

  return {
    rank: result[0]?.rank || 0,
    points: result[0]?.points || 0,
    totalFriends: userIds.length,
  };
};

/**
 * Get top performers for a specific goal
 */
const getGoalLeaderboard = async (goalId, userId) => {
  // Get all users who have access to this goal
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      sharedGoals: { select: { userId: true } },
    },
  });

  if (!goal) {
    return [];
  }

  const participantIds = [goal.userId, ...goal.sharedGoals.map((sg) => sg.userId)];
  
  // Use Prisma.join for UUID array
  const participantIdList = Prisma.join(participantIds.map(id => Prisma.sql`${id}::uuid`));

  const leaderboard = await prisma.$queryRaw`
    SELECT 
      u.id,
      u.username,
      COALESCE(SUM(gc.points), 0)::int as points,
      COUNT(gc.id)::int as completions
    FROM users u
    LEFT JOIN goal_completions gc ON u.id = gc."userId" AND gc."goalId" = ${goalId}::uuid
    WHERE u.id IN (${participantIdList})
    GROUP BY u.id, u.username
    ORDER BY completions DESC, points DESC
  `;

  return leaderboard.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    username: user.username,
    points: user.points,
    completions: user.completions,
    isCurrentUser: user.id === userId,
  }));
};

// Helper to get start of period
const getStartOfPeriod = (period) => {
  const now = new Date();
  
  switch (period) {
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly':
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'yearly':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(0); // All time
  }
};

module.exports = {
  getLeaderboard,
  getLeaderboardWithStats,
  getUserRank,
  getGoalLeaderboard,
};
