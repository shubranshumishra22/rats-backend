const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFoundHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const friendRoutes = require('./routes/friend.routes');
const goalRoutes = require('./routes/goal.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const activityRoutes = require('./routes/activity.routes');
const messageRoutes = require('./routes/message.routes');

const app = express();

// ===========================================
// Middleware
// ===========================================

// CORS - Support multiple origins
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (config.cors.origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (v1)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/friends', friendRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/leaderboard', leaderboardRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/messages', messageRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
