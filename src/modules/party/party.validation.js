import Joi from 'joi';

export const createPartySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    phone: Joi.string().trim().min(8).max(20).required(),
    gstin: Joi.string().trim().allow('').max(30).optional(),
    openingBalance: Joi.number().precision(2).default(0),
  }).required(),
});

export const partyIdSchema = Joi.object({
  params: Joi.object({
    partyId: Joi.number().integer().positive().required(),
  }).required(),
});

export const ledgerEntryIdSchema = Joi.object({
  params: Joi.object({
    partyId: Joi.number().integer().positive().required(),
    entryId: Joi.number().integer().positive().required(),
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
    invoiceData: Joi.object({
      partyName: Joi.string().trim().min(2).max(120).required(),
      partyAddress: Joi.string().trim().min(5).max(500).required(),
      gstin: Joi.string().trim().min(5).max(30).required(),
      invoiceNo: Joi.string().trim().min(1).max(120).required(),
      vehicleNo: Joi.string().trim().min(1).max(60).required(),
      subtotal: Joi.number().min(0).precision(2).required(),
      sgst: Joi.number().precision(2).required(),
      cgst: Joi.number().precision(2).required(),
      igst: Joi.number().precision(2).required(),
      roundOff: Joi.number().precision(2).required(),
      total: Joi.number().positive().precision(2).required(),
      items: Joi.array()
        .items(
          Joi.object({
            description: Joi.string().trim().min(1).max(500).required(),
            hsnCode: Joi.string().trim().min(1).max(40).required(),
            quantity: Joi.number().positive().precision(3).required(),
            unit: Joi.string().trim().min(1).max(20).required(),
            rate: Joi.number().positive().precision(2).required(),
            amount: Joi.number().positive().precision(2).required(),
          }).required(),
        )
        .min(1)
        .required(),
    }).optional(),
  }).required(),
});

export const partyListSchema = Joi.object({
  query: Joi.object({
    search: Joi.string().trim().allow('').optional(),
  }).required(),
});

export const importSalesSchema = Joi.object({
  body: Joi.object({
    createMissingParties: Joi.boolean().default(false),
    rows: Joi.array()
      .items(
        Joi.object({
          monthName: Joi.string().trim().min(3).max(30).required(),
          reference: Joi.string().trim().min(1).max(120).required(),
          date: Joi.date().iso().required(),
          partyName: Joi.string().trim().min(2).max(120).required(),
          gstin: Joi.string().trim().allow('').max(30).optional(),
          amount: Joi.number().positive().precision(2).required(),
          quantity: Joi.number().precision(3).min(0).optional(),
        }).required(),
      )
      .min(1)
      .required(),
  }).required(),
});
