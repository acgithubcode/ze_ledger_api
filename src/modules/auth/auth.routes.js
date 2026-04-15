import { Router } from 'express';

import { authenticate } from '../../common/middleware/auth.middleware.js';
import { validate } from '../../common/middleware/validate.middleware.js';
import { asyncHandler } from '../../common/utils/async-handler.js';
import { authController } from './auth.controller.js';
import { guestLoginSchema, loginSchema, registerSchema } from './auth.validation.js';

const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/guest', validate(guestLoginSchema), asyncHandler(authController.guestLogin));
authRouter.get('/me', authenticate, asyncHandler(authController.profile));

export { authRouter };
