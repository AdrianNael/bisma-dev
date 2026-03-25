import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id: Joi.number().positive().required(),
  id_pengguna: Joi.string().max(50).required(),
  id_posisi: Joi.number().required(),
});

const deleteUserValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deleteUserValidation };
