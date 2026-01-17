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

const usernameSchema = z.object({
  params: z.object({
    username: z.string().min(1, 'Username is required'),
  }),
});

const updateProfileSchema = z.object({
  body: z.object({
    displayName: z.string().max(50).optional(),
    bio: z.string().max(500).optional(),
    avatarUrl: z.string().url().optional().nullable(),
  }),
});

module.exports = {
  searchUsersSchema,
  userIdSchema,
  usernameSchema,
  updateProfileSchema,
};
