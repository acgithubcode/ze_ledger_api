import { Router } from 'express';

import { authenticate } from '../../common/middleware/auth.middleware.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { dashboardController } from './dashboard.controller.js';

const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get('/summary', asyncHandler(dashboardController.summary));

export { dashboardRouter };
