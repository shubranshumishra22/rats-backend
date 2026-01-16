const { z } = require('zod');

const leaderboardQuerySchema = z.object({
  query: z.object({
    period: z.enum(['all', 'daily', 'weekly', 'monthly', 'yearly']).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine((n) => n >= 1 && n <= 100, {
      message: 'Limit must be between 1 and 100',
    }).optional(),
  }).optional(),
});

const goalLeaderboardSchema = z.object({
  params: z.object({
    goalId: z.string().uuid('Invalid goal ID'),
  }),
});

module.exports = {
  leaderboardQuerySchema,
  goalLeaderboardSchema,
};
