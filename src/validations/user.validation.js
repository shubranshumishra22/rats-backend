const { z } = require('zod');

const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required'),
  }),
});

const userIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

module.exports = {
  searchUsersSchema,
  userIdSchema,
};
