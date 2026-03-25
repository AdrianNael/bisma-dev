import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id: Joi.number().positive().optional(),
  posisi: Joi.string().max(50).required(),
});

const deletePositionValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deletePositionValidation };
