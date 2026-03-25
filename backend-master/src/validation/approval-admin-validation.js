import Joi from "joi";


const approveValidation = Joi.number().positive().required();

const rejectValidation = Joi.object({
    projectId: Joi.number().positive().required(),
    remarkProject: Joi.string().required()
});

export{
    approveValidation,
    rejectValidation
}