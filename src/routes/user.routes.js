const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { searchUsersSchema, userIdSchema, usernameSchema, updateProfileSchema } = require('../validations/user.validation');

const router = express.Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);
router.get('/search', validate(searchUsersSchema), userController.searchUsers);
router.get('/profile/:username', validate(usernameSchema), userController.getPublicProfile);
router.get('/:id', validate(userIdSchema), userController.getUserById);

module.exports = router;
