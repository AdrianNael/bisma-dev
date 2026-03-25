import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id: Joi.number().positive().optional(),
  kegiatan: Joi.string().max(255).required(),
});

const deleteActivityCategoryValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deleteActivityCategoryValidation };
