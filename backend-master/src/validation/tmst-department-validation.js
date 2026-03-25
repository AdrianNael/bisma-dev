import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id: Joi.number().positive().optional(),
  department: Joi.string().max(50).required(),
  faculty_id: Joi.number().positive().allow(null).optional(),
});

const deleteDepartmentValidation = Joi.number().positive().required();

export { createAndUpdateValidation, deleteDepartmentValidation };
