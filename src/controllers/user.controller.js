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
  searchUsers,
};
