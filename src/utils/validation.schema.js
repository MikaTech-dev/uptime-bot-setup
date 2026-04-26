import Joi from "joi";

const schema = Joi.object ({
    message: Joi.string()
    .min(3)
    .max(254)
    .required()
    .pattern(new RegExp(/[A-Z]/, "i")),
})

const verifySchema = (data) => {
    const {error, value} = schema.validate(data)
    if (error) {
        throw new Error(error);
    }
    return value
}


export default verifySchema