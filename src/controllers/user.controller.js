const userService = require('../services/user.service');
const { asyncHandler } = require('../utils/asyncHandler');

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.user.id);

  res.status(200).json({
    success: true,
    data: { user },
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  res.status(200).json({
    success: true,
    data: { user },
  });
});

/**
 * Get public profile by username
 * This is accessible to any authenticated user
 */
const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getPublicProfile(req.params.username);

  res.status(200).json({
    success: true,
    data: { profile },
  });
});

/**
 * Update current user's profile
 */
const updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: { user },
  });
});

const searchUsers = asyncHandler(async (req, res) => {
  const users = await userService.searchUsers(req.query.q, req.user.id);

  res.status(200).json({
    success: true,
    data: { users },
  });
});

module.exports = {
  getMe,
  getUserById,
  getPublicProfile,
  updateProfile,
  searchUsers,
};
