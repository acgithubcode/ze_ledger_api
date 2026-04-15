import { StatusCodes } from 'http-status-codes';

import { sendResponse } from '../../common/utils/api-response.js';
import { authService } from './auth.service.js';

export const authController = {
  async register(request, response) {
    const result = await authService.register(request.body);
    sendResponse(response, StatusCodes.CREATED, 'User registered successfully', result);
  },

  async login(request, response) {
    const result = await authService.login(request.body);
    sendResponse(response, StatusCodes.OK, 'Login successful', result);
  },

  async guestLogin(request, response) {
    const result = await authService.loginAsGuest(request.body);
    sendResponse(response, StatusCodes.CREATED, 'Guest session created', result);
  },

  async profile(request, response) {
    const result = await authService.getProfile(request.user.id);
    sendResponse(response, StatusCodes.OK, 'Profile fetched successfully', result);
  },
};
