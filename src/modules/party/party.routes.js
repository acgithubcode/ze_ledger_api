import { Router } from 'express';

import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { dashboardController } from '../dashboard/dashboard.controller.js';
import { partyController } from './party.controller.js';
import {
  addLedgerEntrySchema,
  createPartySchema,
  importSalesSchema,
  partyIdSchema,
  partyListSchema,
} from './party.validation.js';

const partyRouter = Router();

partyRouter.use(authenticate);

partyRouter.get('/', validate(partyListSchema), asyncHandler(partyController.listParties));
partyRouter.post('/', validate(createPartySchema), asyncHandler(partyController.createParty));
partyRouter.post('/import-sales', validate(importSalesSchema), asyncHandler(partyController.importSales));
partyRouter.get('/:partyId', validate(partyIdSchema), asyncHandler(partyController.getParty));
partyRouter.get('/:partyId/ledger-entries', validate(partyIdSchema), asyncHandler(partyController.listLedgerEntries));
partyRouter.post(
  '/:partyId/ledger-entries',
  validate(addLedgerEntrySchema),
  asyncHandler(partyController.addLedgerEntry),
);
partyRouter.get('/:partyId/summary', validate(partyIdSchema), asyncHandler(dashboardController.partySummary));

export { partyRouter };
