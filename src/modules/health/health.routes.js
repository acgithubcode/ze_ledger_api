import { Router } from 'express';

import { getPool } from '../../config/database.js';

const healthRouter = Router();

healthRouter.get('/', (_request, response, next) => {
  getPool()
    .query('SELECT 1')
    .then(() => {
      response.json({
        success: true,
        message: 'Service healthy',
        data: {
          uptime: process.uptime(),
          databaseState: 'connected',
          timestamp: new Date().toISOString(),
        },
      });
    })
    .catch(next);
});

export { healthRouter };
