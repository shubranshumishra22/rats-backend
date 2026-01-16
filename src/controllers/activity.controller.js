const activityService = require('../services/activity.service');
const { asyncHandler } = require('../utils/asyncHandler');

const getFeed = asyncHandler(async (req, res) => {
  const { page, limit, type } = req.query;
  const result = await activityService.getFeed(req.user.id, { page, limit, type });

  res.status(200).json({
    success: true,
    data: result,
  });
});

const getMyActivities = asyncHandler(async (req, res) => {
  const { page, limit, type } = req.query;
  const result = await activityService.getMyActivities(req.user.id, { page, limit, type });

  res.status(200).json({
    success: true,
    data: result,
  });
});

const getFriendActivities = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await activityService.getFriendActivities(req.user.id, req.params.friendId, { page, limit });

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getFeed,
  getMyActivities,
  getFriendActivities,
};
