require('dotenv').config();

const http = require('http');

// Import config first to validate env vars
const config = require('./config');
const app = require('./app');
const { initializeSocket } = require('./socket');
const { logger } = require('./utils/logger');

const { port, nodeEnv } = config.server;

// Create HTTP server (needed for Socket.IO)
const server = http.createServer(app);

// Initialize Socket.IO
initializeSocket(server);

server.listen(port, () => {
  logger.info(`🚀 Server running on port ${port} in ${nodeEnv} mode`);
  logger.info(`📡 Socket.IO ready for real-time messaging`);
});
