import Joi from "joi";

const createTranProjectValidation = Joi.array().items(
  Joi.object({
    id_project: Joi.number().positive().required(),
    id_peserta: Joi.string().max(50).required(),
    estimasi: Joi.number().positive().required(),
    durasi: Joi.number().positive().required(),
    id_status: Joi.number().positive().required(),
  })
);

const updateTranProjectValidation = Joi.array().items(
  Joi.object({
    id_peserta: Joi.string().max(50).required(),
    estimasi: Joi.number().positive().required(),
    durasi: Joi.number().positive().required(),
    id_status: Joi.number().positive().required(),
  })
);


const timesheetTranProjectValidation = Joi.object({
  projectId: Joi.number().positive().required(),
  userId: Joi.string().max(50).required(),
});

const getAvailableProjectById = Joi.string().max(255).required();

const getDataRecapValidation = Joi.object({
  project: Joi.string().max(255).required(),
  month: Joi.number().positive().max(12).required(),
  year: Joi.number().integer().min(2000).max(3000).optional(),
  firstUserId: Joi.string().max(50).optional(),
  reportType: Joi.string().valid('main', 'secondary').optional(),
});

const recapValidation = Joi.object({
  project: Joi.string().max(255).required(),
  month: Joi.number().positive().max(12).required(),
  year: Joi.number().integer().min(2000).max(3000).optional(),
  option: Joi.string().max(50).required(),
  firstUserId: Joi.string().max(50).optional(),
  reportType: Joi.string().valid('main', 'secondary').optional(),
});

const deleteTranProjectValidation = Joi.number().positive().required();

const userRecapValidation = Joi.object({
  userId: Joi.string().max(50).required(),
  month: Joi.number().positive().max(12).required(),
  year: Joi.number().integer().min(2000).max(3000).optional(),
  option: Joi.string().max(50).optional(),
  reportType: Joi.string().optional(), // Accept numeric (1, 2, 3, ...) or 'karya'
});

const myProjectRecapValidation = Joi.object({
  userId: Joi.string().max(50).required(),
  year: Joi.number().integer().min(2000).max(3000).required(),
  option: Joi.string().max(50).optional(),
});

const projectRecapValidation = Joi.object({
  projectId: Joi.alternatives().try(Joi.number().positive(), Joi.string()).required(),
  month: Joi.number().positive().max(12).optional(),
  year: Joi.number().integer().min(2000).max(3000).optional(),
});

export { createTranProjectValidation, deleteTranProjectValidation, updateTranProjectValidation, recapValidation, getAvailableProjectById, getDataRecapValidation, timesheetTranProjectValidation, userRecapValidation, myProjectRecapValidation, projectRecapValidation };

