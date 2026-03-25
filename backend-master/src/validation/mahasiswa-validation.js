import Joi from "joi";

const createMahasiswaSchema = Joi.object({
    nim: Joi.string().required(),
    nama: Joi.string().max(225).required(),
    username: Joi.string().max(20).required(),
    password: Joi.string().min(6).required(), 
    departemen: Joi.string().max(512).required(), 
    no_telp: Joi.string().max(20).allow(null), 
    no_rekening: Joi.string().max(30).required(),
    status: Joi.string().valid('STAF', 'MANAGER', 'MAHASISWA').required(),
});

const getMahasiswaSchema = Joi.object({
    nama: Joi.string().optional(),
    nim: Joi.string().optional()
})

const getOneMahasiswaSchema = Joi.string().required();
  
const updateMahasiswaSchema = Joi.object({
    nama: Joi.string().max(225).optional(),
    username: Joi.string().max(20).optional(),
    nim: Joi.string().optional(),
    password: Joi.string().min(6).optional(), 
    departemen: Joi.string().max(512).allow(null), 
    no_telp: Joi.string().max(20).allow(null).optional(), 
    no_rekening: Joi.string().max(30).allow(null),
});

export{
    createMahasiswaSchema,
    updateMahasiswaSchema,
    getMahasiswaSchema,
    getOneMahasiswaSchema
}