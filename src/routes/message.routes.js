const express = require('express');
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { 
  createConversationSchema, 
  conversationIdSchema, 
  sendMessageSchema,
  getMessagesSchema,
} = require('../validations/message.validation');

const router = express.Router();

router.use(authenticate);

// Conversations
router.get('/conversations', messageController.getConversations);
router.post('/conversations', validate(createConversationSchema), messageController.getOrCreateConversation);

// Messages
router.get('/conversations/:conversationId/messages', validate(getMessagesSchema), messageController.getMessages);
router.post('/conversations/:conversationId/messages', validate(sendMessageSchema), messageController.sendMessage);
router.post('/conversations/:conversationId/read', validate(conversationIdSchema), messageController.markAsRead);

// Unread count
router.get('/unread', messageController.getUnreadCount);

module.exports = router;
