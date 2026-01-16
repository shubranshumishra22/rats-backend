require('dotenv').config();

// Import config first to validate env vars
const config = require('./config');
const app = require('./app');
const { logger } = require('./utils/logger');

const { port, nodeEnv } = config.server;

app.listen(port, () => {
  logger.info(`🚀 Server running on port ${port} in ${nodeEnv} mode`);
});
