const goalService = require('../services/goal.service');
const { asyncHandler } = require('../utils/asyncHandler');

const getGoals = asyncHandler(async (req, res) => {
  const { frequency, page, limit } = req.query;
  const result = await goalService.getGoals(req.user.id, { frequency, page, limit });

  res.status(200).json({
    success: true,
    data: result,
  });
});

const getSharedGoals = asyncHandler(async (req, res) => {
  const goals = await goalService.getSharedGoals(req.user.id);

  res.status(200).json({
    success: true,
    data: { goals },
  });
});

const getGoalById = asyncHandler(async (req, res) => {
  const goal = await goalService.getGoalById(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: { goal },
  });
});

const createGoal = asyncHandler(async (req, res) => {
  const goal = await goalService.createGoal(req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: { goal },
  });
});

const updateGoal = asyncHandler(async (req, res) => {
  const goal = await goalService.updateGoal(req.params.id, req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: { goal },
  });
});

const deleteGoal = asyncHandler(async (req, res) => {
  await goalService.deleteGoal(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Goal deleted successfully',
  });
});

const shareGoal = asyncHandler(async (req, res) => {
  const result = await goalService.shareGoal(req.params.id, req.user.id, req.body.friendIds);

  res.status(201).json({
    success: true,
    data: result,
    message: `Goal shared with ${result.count} friend(s)`,
  });
});

const unshareGoal = asyncHandler(async (req, res) => {
  const result = await goalService.unshareGoal(req.params.id, req.user.id, req.params.friendId);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

const completeGoal = asyncHandler(async (req, res) => {
  const completion = await goalService.completeGoal(req.params.id, req.user.id);

  res.status(201).json({
    success: true,
    data: { completion },
  });
});

const getGoalStats = asyncHandler(async (req, res) => {
  const stats = await goalService.getGoalStats(req.user.id);

  res.status(200).json({
    success: true,
    data: { stats },
  });
});

const getStreakInfo = asyncHandler(async (req, res) => {
  const streakInfo = await goalService.getStreakInfo(req.user.id);

  res.status(200).json({
    success: true,
    data: { streak: streakInfo },
  });
});

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
