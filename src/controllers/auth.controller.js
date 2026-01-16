const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { setRefreshTokenCookie, clearRefreshTokenCookie } = require('../utils/tokens');

const register = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.register({ email, username, password });

  setRefreshTokenCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    data: { user, accessToken },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login({ email, password });

  setRefreshTokenCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    data: { user, accessToken },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.cookies;
  const { accessToken, refreshToken } = await authService.refresh(token);

  setRefreshTokenCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    data: { accessToken },
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies;
  
  await authService.logout(refreshToken);
  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user.id);
  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logged out from all devices',
  });
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
};
