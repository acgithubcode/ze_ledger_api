import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { partyRouter } from '../modules/party/party.routes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/parties', partyRouter);

export { apiRouter };
