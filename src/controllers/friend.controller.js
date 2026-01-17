const friendService = require('../services/friend.service');
const { asyncHandler } = require('../utils/asyncHandler');

const getFriends = asyncHandler(async (req, res) => {
  const friends = await friendService.getFriends(req.user.id);

  res.status(200).json({
    success: true,
    data: { friends },
  });
});

const getPendingRequests = asyncHandler(async (req, res) => {
  const requests = await friendService.getPendingRequests(req.user.id);

  res.status(200).json({
    success: true,
    data: { requests },
  });
});

const sendRequest = asyncHandler(async (req, res) => {
  const request = await friendService.sendRequest(req.user.id, req.body.userId);

  res.status(201).json({
    success: true,
    data: { request },
  });
});

const respondToRequest = asyncHandler(async (req, res) => {
  const result = await friendService.respondToRequest(req.user.id, req.params.id, req.body.action);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const removeFriend = asyncHandler(async (req, res) => {
  await friendService.removeFriend(req.user.id, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Friend removed successfully',
  });
});

/**
 * Get friendship status with a specific user
 */
const getFriendshipStatus = asyncHandler(async (req, res) => {
  const status = await friendService.getFriendshipStatus(req.user.id, req.params.userId);

  res.status(200).json({
    success: true,
    data: status,
  });
});

module.exports = {
  getFriends,
  getPendingRequests,
  sendRequest,
  respondToRequest,
  removeFriend,
  getFriendshipStatus,
};
