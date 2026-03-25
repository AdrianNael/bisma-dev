import Joi from "joi";

const createTmstUserValidation = Joi.object({
  id: Joi.string().max(20).required(),
  nama: Joi.string().max(225).required(),
  username: Joi.string().max(20).required(),
  departemen: Joi.string().max(512).required(),
  no_telp: Joi.string().max(20).required(),
  no_rekening: Joi.string().max(30).required(),
  status: Joi.string().max(10).required(),
});

const updateTmstUserValidation = Joi.object({
  id: Joi.string().max(20).required(),
  nama: Joi.string().max(225).required(),
  departemen: Joi.string().max(512).required(),
  no_telp: Joi.string().max(20).required(),
  no_rekening: Joi.string().max(30).required(),
  status: Joi.string().max(10).required(),
});
const deleteTmstUserValidation = Joi.string().max(20).required();

export { createTmstUserValidation, deleteTmstUserValidation, updateTmstUserValidation };
