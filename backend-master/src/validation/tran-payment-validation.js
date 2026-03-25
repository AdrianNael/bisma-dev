import Joi from "joi";

const createPaymentValidation = Joi.object({
  id_tmst_project: Joi.number().positive().required(),
  periode: Joi.string().max(100).required(),
  total_tagihan: Joi.number().min(0).required(),
  url_file_sp3: Joi.string().max(255).allow('', null).optional(),
  id_status: Joi.number().positive().required(),
  revisi: Joi.string().allow(null, '').optional(),
});

const UpdatePaymentValidation = Joi.object({
  id: Joi.number().positive().required(),
  id_tmst_project: Joi.number().positive().required(),
  periode: Joi.string().max(100).required(),
  total_tagihan: Joi.number().positive().required(),
  url_file_sp3: Joi.string().max(100).allow('').required(),
  id_status: Joi.number().positive().required(),
  revisi: Joi.string().allow(null, '').optional(),
});

const listAdminValidation = Joi.object({
  namaProjek: Joi.string().max(255).optional(),
  size: Joi.number().min(1).positive().max(100).default(5),
  page: Joi.number().min(1).positive().default(1),
  status: Joi.string().max(10).required(),
});

const showSp3Validation = Joi.object({
  idProject: Joi.number().min(1).positive().required(),
  month: Joi.number().min(1).positive().max(12).required(),
  option: Joi.string().max(255).required(),
});

const deletePaymentValidation = Joi.number().positive().required();

export { createPaymentValidation, UpdatePaymentValidation, deletePaymentValidation, listAdminValidation, showSp3Validation };
