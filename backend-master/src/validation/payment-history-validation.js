import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id_payment: Joi.number().positive().required(),
  id_status: Joi.number().positive().required(),
  changed_at: Joi.date().optional(),
});

const deleteStatusValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deleteStatusValidation };