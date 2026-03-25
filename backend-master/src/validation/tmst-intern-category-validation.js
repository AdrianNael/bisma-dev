import Joi from "joi";

const createInternCategoryValidation = Joi.object({
  kategori: Joi.string().max(255).required(),
});

const updateInternCategoryValidation = Joi.object({
  id: Joi.number().positive().required(),
  kategori: Joi.string().max(255).required(),
});

const searchInternCategoryValidation = Joi.object({
  page: Joi.number().min(1).positive().default(1),
  size: Joi.number().min(1).positive().max(100).default(15),
  kategori: Joi.string().max(255).optional(),
});

const getIdValidation = Joi.number().positive().required();

export { createInternCategoryValidation, updateInternCategoryValidation, getIdValidation, searchInternCategoryValidation };
