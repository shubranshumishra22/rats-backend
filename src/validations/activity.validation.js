const Joi = require('joi');

const feedQuerySchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
    type: Joi.string().valid(
      'goal_completed',
      'goal_created',
      'friend_added',
      'friend_request_sent',
      'streak_milestone',
      'points_milestone'
    ),
  }),
};

const friendActivitySchema = {
  params: Joi.object({
    friendId: Joi.string().uuid().required(),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20),
  }),
};

module.exports = {
  feedQuerySchema,
  friendActivitySchema,
};
