import Joi from "joi";

const createIncentiveValidation = Joi.object({
  id_kategori: Joi.number().positive().required(),
  id_satuan: Joi.number().positive().required(),
  besaran_insentif: Joi.number().positive().required(),
  durasi_satuan: Joi.number().positive().default(1).required()
});

const updateIncentiveValidation = Joi.object({
  id: Joi.number().positive().required(),
  id_kategori: Joi.number().positive().required(),
  id_satuan: Joi.number().positive().required(),
  besaran_insentif: Joi.number().positive().required(),
  durasi_satuan: Joi.number().positive().default(1).required()
});

const searchIncentiveValidation = Joi.object({
  page: Joi.number().min(1).positive().default(1),
  size: Joi.number().min(1).positive().max(100).default(15),
  kategori: Joi.string().max(255).optional(),
  insentif: Joi.number().positive().optional(),
});

const showIncentiveValidation = Joi.object({
  page: Joi.number().min(1).positive().default(1),
  size: Joi.number().min(1).positive().max(100).default(15),
});

const getId = Joi.number().positive().required();

export { createIncentiveValidation, updateIncentiveValidation, searchIncentiveValidation, showIncentiveValidation, getId };
