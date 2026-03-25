import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id: Joi.number().positive().optional(),
  status: Joi.string().max(50).required(),
});

const deleteStatusValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deleteStatusValidation };
