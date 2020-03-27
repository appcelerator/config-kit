module.exports = {
	__esModule: true,
	default: function ({ Joi }) {
		return Joi.object({
			foo: Joi.string().valid('bar'),
			count: Joi.number().valid(0)
		});
	}
};
