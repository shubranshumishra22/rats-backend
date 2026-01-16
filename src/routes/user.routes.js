const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchUsersSchema, userIdSchema } = require('../validations/user.validation');

const router = express.Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.get('/search', validate(searchUsersSchema), userController.searchUsers);
router.get('/:id', validate(userIdSchema), userController.getUserById);

module.exports = router;
