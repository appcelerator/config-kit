export default function ({ Joi }) {
	return Joi.object({
		test: Joi.object({
			foo: Joi.string().valid('bar'),
			count: Joi.number().valid(0)
		})
	});
};
