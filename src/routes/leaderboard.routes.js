const express = require('express');
const leaderboardController = require('../controllers/leaderboard.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { leaderboardQuerySchema, goalLeaderboardSchema } = require('../validations/leaderboard.validation');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(leaderboardQuerySchema), leaderboardController.getLeaderboard);
router.get('/stats', leaderboardController.getLeaderboardWithStats);
router.get('/rank', leaderboardController.getUserRank);
router.get('/goal/:goalId', validate(goalLeaderboardSchema), leaderboardController.getGoalLeaderboard);

module.exports = router;
