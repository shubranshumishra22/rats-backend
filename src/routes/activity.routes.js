const express = require('express');
const activityController = require('../controllers/activity.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { feedQuerySchema, friendActivitySchema } = require('../validations/activity.validation');

const router = express.Router();

router.use(authenticate);

router.get('/feed', validate(feedQuerySchema), activityController.getFeed);
router.get('/me', validate(feedQuerySchema), activityController.getMyActivities);
router.get('/friend/:friendId', validate(friendActivitySchema), activityController.getFriendActivities);

module.exports = router;
