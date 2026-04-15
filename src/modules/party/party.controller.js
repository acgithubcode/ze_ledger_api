import { StatusCodes } from 'http-status-codes';

import { sendResponse } from '../../common/utils/api-response.js';
import { partyService } from './party.service.js';

export const partyController = {
  async listParties(request, response) {
    const result = await partyService.listParties(request.user.id, request.query.search);
    sendResponse(response, StatusCodes.OK, 'Parties fetched successfully', result);
  },

  async getParty(request, response) {
    const result = await partyService.getPartyById(request.user.id, request.params.partyId);
    sendResponse(response, StatusCodes.OK, 'Party fetched successfully', result);
  },

  async createParty(request, response) {
    const result = await partyService.createParty(request.user.id, request.body);
    sendResponse(response, StatusCodes.CREATED, 'Party created successfully', result);
  },

  async listLedgerEntries(request, response) {
    const result = await partyService.listLedgerEntries(request.user.id, request.params.partyId);
    sendResponse(response, StatusCodes.OK, 'Ledger entries fetched successfully', result);
  },

  async addLedgerEntry(request, response) {
    const result = await partyService.addLedgerEntry(request.user.id, request.params.partyId, request.body);
    sendResponse(response, StatusCodes.CREATED, 'Ledger entry created successfully', result);
  },
};
