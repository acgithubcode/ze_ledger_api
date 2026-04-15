import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { seedDatabaseIfNeeded } from './scripts/seed-data.js';

const startServer = async () => {
  await connectDatabase();

  if (env.seedOnBoot) {
    await seedDatabaseIfNeeded();
  }

  app.listen(env.port, () => {
    logger.info(`ZE Ledger API listening on port ${env.port}`);
  });
};

startServer().catch((error) => {
  logger.error({ error }, 'Failed to start ZE Ledger API');
  process.exit(1);
});
