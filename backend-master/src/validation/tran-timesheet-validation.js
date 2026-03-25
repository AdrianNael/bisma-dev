import Joi from "joi";

const createTranTimesheetValidation = Joi.array().items(
  Joi.object({
    id_kategori_kegiatan: Joi.number().positive().optional(),
    id_tran_project: Joi.number().positive().optional(),
    tanggal: Joi.date().required(),
    jam_mulai: Joi.string().required(),
    jam_selesai: Joi.string().required(),
    deskripsi: Joi.string().max(500).required(),
    total_sesi: Joi.number().min(0).max(40).precision(2).required(),
    id_status: Joi.number().positive().optional().default(4),
    link_output: Joi.string().max(500).allow('').optional(),
  })
);

const updateTranTimesheetValidation = Joi.object({
  id: Joi.number().positive().required(),
  id_kategori_kegiatan: Joi.number().positive().required(),
  id_tran_project: Joi.number().positive().required(),
  tanggal: Joi.date().required(),
  jam_mulai: Joi.string().required(),
  jam_selesai: Joi.string().required(),
  deskripsi: Joi.string().max(500).required(),
  total_sesi: Joi.number().min(0).max(40).precision(2).required(),
  id_status: Joi.number().positive().optional().default(4),
  link_output: Joi.string().max(500).allow('').optional(),
});

const getId = Joi.number().positive().required();

const getNIM = Joi.string().max(50).required();

const getSubmitPaymentValidation = Joi.object({
  projectId: Joi.number().positive().required(),
  date: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM').required(),
});

const showAvailableTranTimesheetValidation = Joi.object({
  nama: Joi.string().max(40).optional(),
  nim: Joi.string().max(40).optional(),
  keyword: Joi.string().allow('').optional(),
  month: Joi.number().positive().min(1).max(12).optional(),
  prodi: Joi.string().max(40).optional(),
  page: Joi.number().min(1).positive().default(1),
  size: Joi.number().min(1).positive().max(100).default(5),
});

const searchTimesheetValidation = Joi.object({
  userId: Joi.string().max(40).required(),
  page: Joi.number().min(1).positive().default(1),
  size: Joi.number().min(1).positive().max(100).default(5),
  project: Joi.string().max(255).optional(),
});

const submitPaymentValidation = Joi.object({
  page: Joi.number().min(1).positive().default(1),
  size: Joi.number().min(1).positive().max(100).default(5),
  project: Joi.string().max(255).optional(),
  pic: Joi.string().max(50).optional(), // Parameter untuk filter berdasarkan PIC
});

const getDataPdfTimesheetValidation = Joi.object({
  id_pengguna: Joi.string().max(50).required(),
  month: Joi.number().positive().max(12).required(),
  year: Joi.number().integer().min(2000).max(3000).optional(),
  project: Joi.string().max(255).required(),
});

const generatePdfTimesheetValidation = Joi.object({
  id_pengguna: Joi.string().max(50).required(),
  month: Joi.number().positive().max(12).required(),
  year: Joi.number().integer().min(2000).max(3000).optional(),
  project: Joi.string().max(255).required(),
  option: Joi.string().max(50).required(),
});

const generateAllPdfValidation = Joi.object({
  month: Joi.number().positive().max(12).required(),
  project: Joi.string().max(255).optional(),
  option: Joi.string().max(50).required(),
});

const deleteManyValidation = Joi.object({
  projectId: Joi.number().required(),
  date: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required(),
  userId: Joi.string().max(50).required(),
});

export { createTranTimesheetValidation, updateTranTimesheetValidation, showAvailableTranTimesheetValidation, getId, getNIM, generatePdfTimesheetValidation, generateAllPdfValidation, getDataPdfTimesheetValidation, searchTimesheetValidation, deleteManyValidation, submitPaymentValidation, getSubmitPaymentValidation };
