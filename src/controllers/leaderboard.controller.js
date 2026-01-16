const leaderboardService = require('../services/leaderboard.service');
const { asyncHandler } = require('../utils/asyncHandler');

const getLeaderboard = asyncHandler(async (req, res) => {
  const { period = 'all', limit } = req.query;
  const leaderboard = await leaderboardService.getLeaderboard(req.user.id, { 
    period, 
    limit: limit ? parseInt(limit, 10) : 50 
  });

  res.status(200).json({
    success: true,
    data: { 
      leaderboard,
      period,
    },
  });
});

const getLeaderboardWithStats = asyncHandler(async (req, res) => {
  const leaderboard = await leaderboardService.getLeaderboardWithStats(req.user.id);

  res.status(200).json({
    success: true,
    data: { leaderboard },
  });
});

const getUserRank = asyncHandler(async (req, res) => {
  const rank = await leaderboardService.getUserRank(req.user.id);

  res.status(200).json({
    success: true,
    data: { rank },
  });
});

const getGoalLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await leaderboardService.getGoalLeaderboard(req.params.goalId, req.user.id);

  res.status(200).json({
    success: true,
    data: { leaderboard },
  });
});

module.exports = {
  getLeaderboard,
  getLeaderboardWithStats,
  getUserRank,
  getGoalLeaderboard,
};
