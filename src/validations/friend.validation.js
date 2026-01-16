const { z } = require('zod');

const sendRequestSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Invalid user ID'),
  }),
});

const respondRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid friend request ID'),
  }),
  body: z.object({
    action: z.enum(['accept', 'reject'], {
      errorMap: () => ({ message: 'Action must be accept or reject' }),
    }),
  }),
});

const friendIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid friend ID'),
  }),
});

module.exports = {
  sendRequestSchema,
  respondRequestSchema,
  friendIdSchema,
};
