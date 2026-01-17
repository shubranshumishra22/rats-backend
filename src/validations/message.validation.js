const { z } = require('zod');

const createConversationSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

const conversationIdSchema = z.object({
  params: z.object({
    conversationId: z.string().uuid('Invalid conversation ID'),
  }),
});

const getMessagesSchema = z.object({
  params: z.object({
    conversationId: z.string().uuid('Invalid conversation ID'),
  }),
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.string().optional(),
  }),
});

const sendMessageSchema = z.object({
  params: z.object({
    conversationId: z.string().uuid('Invalid conversation ID'),
  }),
  body: z.object({
    content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
  }),
});

module.exports = {
  createConversationSchema,
  conversationIdSchema,
  getMessagesSchema,
  sendMessageSchema,
};
