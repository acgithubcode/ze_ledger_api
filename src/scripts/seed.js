import { connectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { seedDatabaseIfNeeded } from './seed-data.js';

const run = async () => {
  await connectDatabase();
  await seedDatabaseIfNeeded();
  logger.info('Seed script finished');
  process.exit(0);
};

run().catch((error) => {
  logger.error({ error }, 'Seed script failed');
  process.exit(1);
});
