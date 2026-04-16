import { StatusCodes } from 'http-status-codes';

import { sendResponse } from '../../common/utils/api-response.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardController = {
  async summary(request, response) {
    const result = await dashboardService.getSummary(request.user.id);
    sendResponse(response, StatusCodes.OK, 'Dashboard summary fetched successfully', result);
  },

  async recentActivity(request, response) {
    const result = await dashboardService.getRecentActivity(request.user.id);
    sendResponse(response, StatusCodes.OK, 'Recent activity fetched successfully', result);
  },

  async partySummary(request, response) {
    const result = await dashboardService.getPartySummary(request.user.id, request.params.partyId);
    sendResponse(response, StatusCodes.OK, 'Party summary fetched successfully', result);
  },
};
