import Joi from 'joi';

export const createPartySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    phone: Joi.string().trim().min(8).max(20).required(),
    openingBalance: Joi.number().precision(2).default(0),
  }).required(),
});

export const partyIdSchema = Joi.object({
  params: Joi.object({
    partyId: Joi.number().integer().positive().required(),
  }).required(),
});

export const addLedgerEntrySchema = Joi.object({
  params: Joi.object({
    partyId: Joi.number().integer().positive().required(),
  }).required(),
  body: Joi.object({
    type: Joi.string().valid('sale', 'payment').required(),
    amount: Joi.number().positive().precision(2).required(),
    reference: Joi.string().trim().min(2).max(120).required(),
    date: Joi.date().iso().optional(),
  }).required(),
});

export const partyListSchema = Joi.object({
  query: Joi.object({
    search: Joi.string().trim().allow('').optional(),
  }).required(),
});
