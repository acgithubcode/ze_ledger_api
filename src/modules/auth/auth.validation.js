import Joi from 'joi';

export const registerSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(80).required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      .required()
      .messages({
        'string.pattern.base':
          'Password must include at least one uppercase letter, one lowercase letter, and one number',
      }),
  }).required(),
});

export const loginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }).required(),
});

export const guestLoginSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().min(2).max(80).default('Guest User'),
  }).required(),
});
