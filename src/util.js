import Joi from 'joi';
import snooplogg from 'snooplogg';

/**
 * Ensures that a value is an array. If not, it wraps the value in an array.
 *
 * @param {*} it - The value to ensure is an array.
 * @param {Boolean} [removeFalsey=false] - When `true`, filters out all falsey items.
 * @returns {Array}
 */
export function arrayify(it, removeFalsey) {
	const arr = typeof it === 'undefined' ? [] : it instanceof Set ? Array.from(it) : Array.isArray(it) ? it : [ it ];
	return removeFalsey ? arr.filter(v => typeof v !== 'undefined' && v !== null && v !== '' && v !== false && (typeof v !== 'number' || !isNaN(v))) : arr;
}

/**
 * Examines a schema and returns an object containing the default and environment variable values.
 *
 * @param {Object} schema - A Joi schema or object to compile into a Joi schema.
 * @returns {Object} Returns the default and environment variable values.
 */
export function getSchemaInitialValues(schema) {
	if (schema.type !== 'object') {
		throw new Error('Expected schema root to be an object');
	}

	const { log } = snooplogg('config-kit:schema');
	const { highlight } = snooplogg.styles;
	const defaults = {};
	const env = {};
	const walk = (schema, key, defaults, env, segments) => {
		if (schema.type === 'object' && schema.$_terms.keys) {
			const d = {};
			const e = {};

			for (const item of schema.$_terms.keys) {
				segments.push(item.key);
				walk(item.schema, item.key, d, e, segments);
				segments.pop();
			}

			if (Object.keys(d).length) {
				defaults[key] = d;
			}

			if (Object.keys(e).length) {
				env[key] = e;
			}
		}

		if (defaults[key] === undefined && Object.prototype.hasOwnProperty.call(schema._flags, 'default')) {
			defaults[key] = schema._flags.default;
			log(`Initializing ${highlight(segments.join('.'))} = ${highlight(defaults[key])} from defaults`);
		}

		if (env[key] === undefined && schema.$_terms.metas) {
			for (const meta of schema.$_terms.metas) {
				if (meta.env && Object.prototype.hasOwnProperty.call(process.env, meta.env)) {
					const value = process.env[meta.env];
					log(`Initializing ${highlight(segments.join('.'))} = ${highlight(value)} from environment ${highlight(meta.env)}`);
					env[key] = schema.validate(value).value;
					break;
				}
			}
		}
	};

	if (schema.$_terms.keys) {
		for (const item of schema.$_terms.keys) {
			walk(item.schema, item.key, defaults, env, [ item.key ]);
		}
	}

	return { defaults, env: Object.keys(env).length ? env : null };
}

/**
 * Hashes a value quick and dirty.
 *
 * @param {*} it - A value to hash.
 * @returns {Number}
 */
export function hashValue(it) {
	const str = JSON.stringify(it) || '';
	let hash = 5381;
	let i = str.length;
	while (i) {
		hash = hash * 33 ^ str.charCodeAt(--i);
	}
	return hash >>> 0;
}

/**
 * Validates and splits a key into an array.
 *
 * @param {String|Array<String>} key - The key to split. If the key is an array, then it is simply
 * check for validity.
 * @returns {Array<String>}
 */
export function splitKey(key) {
	if (key !== undefined && key !== null && typeof key !== 'string' && !Array.isArray(key)) {
		throw new TypeError('Expected key to be a string');
	}

	const segments = key === undefined || key === null ? [] : Array.isArray(key) ? key : key.split('.');
	for (const segment of segments) {
		if (!segment) {
			throw new Error(`Invalid key ${key}`);
		}
	}
	return segments;
}

/**
 * Removes duplicates from an array and returns a new array.
 *
 * @param {Array} arr - The array to remove duplicates.
 * @returns {Array}
 */
export function unique(arr = []) {
	if (!Array.isArray(arr)) {
		arr = [ arr ];
	}

	return arr.reduce((prev, cur) => {
		if (typeof cur !== 'undefined' && cur !== null) {
			if (prev.indexOf(cur) === -1) {
				prev.push(cur);
			}
		}
		return prev;
	}, []);
}

/**
 * Validates the value being changed.
 *
 * @param {Object} opts - Various options.
 * @param {String} [opts.action] - The name of the action triggering the validation.
 * @param {Array.<String>} [opts.key] - The config key.
 * @param {String} [opts.message] - A custom error message to use if validation fails.
 * @param {Array.<Object>} opts.schemas - An array of Joi schemas.
 * @param {Object} [opts.validateOptions] - Various options to pass into Joi's schema validation.
 * @param {*} [opts.value] - The new value.
 * @returns {*} The original value reference.
 */
export function validate({ schemas, key = [], value, action = 'change', message, validateOptions }) {
	const checkReadonly = schema => {
		if (schema.$_terms.metas) {
			for (const meta of schema.$_terms.metas) {
				if (meta.readonly) {
					throw new Error(`Not allowed to ${action} read-only property`);
				}
			}
		}
	};

	// force no defaults so that Joi doesn't populate the `value` with defaults
	const opts = validateOptions || {};
	opts.noDefaults = true;

	(function walk(key, schemas) {
		const scope = key.shift();
		const scopeSchemas = [];

		for (const schema of schemas) {
			if (action !== 'load') {
				checkReadonly(schema);
			}

			if (!scope && value !== undefined) {
				value = Joi.attempt(value, schema, `${message || `Failed to ${action} config value`}:`, opts);
			} else if (scope && schema.type === 'object' && schema.$_terms.keys) {
				for (const item of schema.$_terms.keys) {
					if (item.key === scope) {
						scopeSchemas.push(item.schema);
					}
				}
			}
		}

		if (scopeSchemas.length) {
			walk(key, scopeSchemas);
		}
	}([ ...key ], (Array.isArray(schemas) ? schemas : [ schemas ]).filter(Boolean)));

	return value;
}
