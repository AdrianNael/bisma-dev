import Joi from 'joi';

exports.uploadKaryaSchema = Joi.object({
  project: Joi.string().required(),
  tanggal: Joi.date().required(),
}).unknown(true); // Allow other unknown fields such as files
