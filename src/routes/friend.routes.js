const express = require('express');
const friendController = require('../controllers/friend.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendRequestSchema, respondRequestSchema, friendIdSchema } = require('../validations/friend.validation');

const router = express.Router();

router.use(authenticate);

router.get('/', friendController.getFriends);
router.get('/requests', friendController.getPendingRequests);
router.post('/request', validate(sendRequestSchema), friendController.sendRequest);
router.patch('/request/:id', validate(respondRequestSchema), friendController.respondToRequest);
router.delete('/:id', validate(friendIdSchema), friendController.removeFriend);

module.exports = router;
