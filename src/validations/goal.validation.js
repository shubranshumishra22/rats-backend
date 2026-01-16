const { z } = require('zod');

const createGoalSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
    description: z.string().max(500, 'Description must be at most 500 characters').optional(),
    frequency: z.enum(['daily', 'weekly', 'yearly'], {
      errorMap: () => ({ message: 'Frequency must be daily, weekly, or yearly' }),
    }),
  }),
});

const updateGoalSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid goal ID'),
  }),
  body: z.object({
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    frequency: z.enum(['daily', 'weekly', 'yearly']).optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  }),
});

const goalIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid goal ID'),
  }),
});

const shareGoalSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid goal ID'),
  }),
  body: z.object({
    friendIds: z.array(z.string().uuid('Invalid friend ID')).min(1, 'At least one friend is required').max(50, 'Cannot share with more than 50 friends at once'),
  }),
});

const unshareGoalSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid goal ID'),
    friendId: z.string().uuid('Invalid friend ID'),
  }),
});

const getGoalsSchema = z.object({
  query: z.object({
    frequency: z.enum(['daily', 'weekly', 'yearly']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  }).optional(),
});

module.exports = {
  createGoalSchema,
  updateGoalSchema,
  goalIdSchema,
  shareGoalSchema,
  unshareGoalSchema,
  getGoalsSchema,
};
