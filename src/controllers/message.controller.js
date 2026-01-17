const messageService = require('../services/message.service');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Get or create a conversation with another user
 */
const getOrCreateConversation = asyncHandler(async (req, res) => {
  const conversation = await messageService.getOrCreateConversation(
    req.user.id,
    req.body.userId
  );

  res.status(200).json({
    success: true,
    data: { conversation },
  });
});

/**
 * Get all conversations for the current user
 */
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await messageService.getConversations(req.user.id);

  res.status(200).json({
    success: true,
    data: { conversations },
  });
});

/**
 * Get messages for a conversation
 */
const getMessages = asyncHandler(async (req, res) => {
  const { cursor, limit } = req.query;
  const result = await messageService.getMessages(
    req.user.id,
    req.params.conversationId,
    { cursor, limit: limit ? parseInt(limit, 10) : 50 }
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Send a message (REST fallback - prefer Socket.IO for real-time)
 */
const sendMessage = asyncHandler(async (req, res) => {
  const message = await messageService.sendMessage(
    req.user.id,
    req.params.conversationId,
    req.body.content
  );

  res.status(201).json({
    success: true,
    data: { message },
  });
});

/**
 * Mark conversation as read
 */
const markAsRead = asyncHandler(async (req, res) => {
  await messageService.markAsRead(req.user.id, req.params.conversationId);

  res.status(200).json({
    success: true,
    message: 'Marked as read',
  });
});

/**
 * Get unread message count
 */
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await messageService.getUnreadCount(req.user.id);

  res.status(200).json({
    success: true,
    data: { unreadCount: count },
  });
});

module.exports = {
  getOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getUnreadCount,
};
