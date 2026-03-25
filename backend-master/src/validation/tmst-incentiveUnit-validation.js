import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id: Joi.number().positive().optional(),
  satuan: Joi.string().max(50).required(),
});

const deleteIncentiveUnitValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deleteIncentiveUnitValidation };
