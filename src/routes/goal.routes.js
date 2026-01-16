const express = require('express');
const goalController = require('../controllers/goal.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createGoalSchema,
  updateGoalSchema,
  goalIdSchema,
  shareGoalSchema,
  unshareGoalSchema,
  getGoalsSchema,
} = require('../validations/goal.validation');

const router = express.Router();

router.use(authenticate);

router.get('/', validate(getGoalsSchema), goalController.getGoals);
router.get('/shared', goalController.getSharedGoals);
router.get('/stats', goalController.getGoalStats);
router.get('/streak', goalController.getStreakInfo);
router.post('/', validate(createGoalSchema), goalController.createGoal);
router.get('/:id', validate(goalIdSchema), goalController.getGoalById);
router.patch('/:id', validate(updateGoalSchema), goalController.updateGoal);
router.delete('/:id', validate(goalIdSchema), goalController.deleteGoal);
router.post('/:id/share', validate(shareGoalSchema), goalController.shareGoal);
router.delete('/:id/share/:friendId', validate(unshareGoalSchema), goalController.unshareGoal);
router.post('/:id/complete', validate(goalIdSchema), goalController.completeGoal);

module.exports = router;
