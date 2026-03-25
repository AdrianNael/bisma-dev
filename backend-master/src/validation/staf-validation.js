import Joi from "joi";

const createStafSchema = Joi.object({
    nip: Joi.string().required(),
    nama: Joi.string().max(225).required(),
    username: Joi.string().max(20).required(),
    password: Joi.string().min(6).required(), // Password minimal 6 karakter
    departemen: Joi.string().max(512).allow(null), // Departemen bisa kosong
    no_telp: Joi.string().max(20).allow(null), // Nomor telepon bisa null
    no_rekening: Joi.string().max(30).allow(null), // Nomor rekening bisa null
    id_posisi: Joi.number().required(),
    status: Joi.string().valid('STAF', 'MANAGER', 'MAHASISWA').required(), // Validasi status
});

const getStafSchema = Joi.object({
    nama: Joi.string().optional(),
    nip: Joi.string().optional()
})

const getOneStafSchema = Joi.string().required();
  
const updateStafSchema = Joi.object({
    nama: Joi.string().max(225).optional(),
    username: Joi.string().max(20).optional(),
    nip: Joi.string().optional(),
    password: Joi.string().min(6).optional(), // Password minimal 6 karakter
    departemen: Joi.string().max(512).allow(null).optional(), // Departemen bisa kosong
    no_telp: Joi.string().max(20).allow(null).optional(), // Nomor telepon bisa null
    no_rekening: Joi.string().max(30).allow(null).optional(), // Nomor rekening bisa null
    id_posisi: Joi.number().optional(),
});

export{
    createStafSchema,
    updateStafSchema,
    getStafSchema,
    getOneStafSchema
}