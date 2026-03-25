import Joi from "joi";

const createAndUpdateValidation = Joi.object({
  id_kategori: Joi.number().positive().required(),
  nama: Joi.string().max(255).required(),
  pic: Joi.string().max(50).required(),
  // tanggal_mulai / tanggal_selesai are required for most categories,
  // but for certain "karya" categories (id 7 & 8) these should be optional/null.
  // Use conditional validation on the date schema itself.
  tanggal_mulai: Joi.date().when('id_kategori', {
    is: Joi.valid(7, 8),
    then: Joi.date().optional().allow(null, ''),
    otherwise: Joi.date().required(),
  }),
  tanggal_selesai: Joi.date().when('id_kategori', {
    is: Joi.valid(7, 8),
    then: Joi.date().optional().allow(null, ''),
    otherwise: Joi.date().required(),
  }),
  created_by: Joi.string().max(50).required(),
  kriteria: Joi.string().optional(),
  kuota: Joi.number().positive().optional(),
  pendaftaran_mulai: Joi.date().optional(),
  pendaftaran_selesai: Joi.date().optional(),
  id_status: Joi.number().integer().min(1).max(7).optional(), // tmst_status_master_project IDs: 1=Draft, 2=Open, 3=Selection, 4=Submitted, 5=Approved, 6=Completed, 7=Rejected
  durasi_per_mahasiswa: Joi.number().integer().min(0).optional(), // Keep for backward compatibility
  durasi_default: Joi.number().integer().min(0).optional(),
  tempat_magang: Joi.string().max(255).optional(),
  pic_jabatan: Joi.string().max(255).optional(),
  department_ids: Joi.array().items(Joi.number().positive()).optional(),
  faculty_ids: Joi.array().items(Joi.number().positive()).optional(),
});

const listProjectValidation = Joi.object({
  userId: Joi.string().max(50).required(),
  namaProjek: Joi.string().max(255).optional(),
  size: Joi.number().min(1).positive().max(100).default(15),
  page: Joi.number().min(1).positive().default(1),
});

const list2ProjectValidation = Joi.object({
  namaProjek: Joi.string().max(255).optional(),
  size: Joi.number().min(1).positive().max(100).default(15),
  page: Joi.number().min(1).positive().default(1),
  status: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
  status_ne: Joi.alternatives().try(Joi.number().positive(), Joi.string()).optional(),
  id_kategori: Joi.number().positive().optional(),
  tanggalMulai: Joi.date().optional().allow(null, ''),
  tanggalSelesai: Joi.date().optional().allow(null, ''),
  filterMonth: Joi.string().max(7).optional(), // YYYY-MM format
  merge: Joi.boolean().optional(),
});


const getEditValidation = Joi.object({
  userId: Joi.string().max(50).required(),
  projectId: Joi.number().positive().required(),
});

const tmstProjectId = Joi.number().positive().required();

const showAvailableStudentValidation = Joi.string().max(50).required();

export { createAndUpdateValidation, tmstProjectId, showAvailableStudentValidation, listProjectValidation, getEditValidation, list2ProjectValidation };
