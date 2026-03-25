import Joi from "joi";

const registerUserValidation = Joi.object({
    nip: Joi.string().required(),
    nama: Joi.string().required(),
    username: Joi.string().required(),
    departemen: Joi.string().required(),
    password: Joi.string().min(6).required(),
    status: Joi.string().valid('STAF', 'MAHASISWA', 'MANAGER').required()
});


const loginUserValidation = Joi.object({
    username: Joi.string().max(100).required(),
    password: Joi.string().max(100).required(),
});

const getUserValidation = Joi.string().max(100).required();

const updateUserValidation = Joi.object({
    username: Joi.string().max(100).required(),
    password: Joi.string().max(100).optional(),
    name: Joi.string().max(100).optional()
})

export {
    registerUserValidation,
    loginUserValidation,
    getUserValidation,
    updateUserValidation
}
