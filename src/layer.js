import fs from 'fs-extra';
import importFresh from 'import-fresh';
import Joi from 'joi';
import JSONStore from './stores/json-store';
import path from 'path';
import snooplogg from 'snooplogg';
import Store from './store';
import Values from 'joi/lib/values';
import { getSchemaInitialValues, validate } from './util';

const { log } = snooplogg('config-kit')('js-store');
const { highlight } = snooplogg.styles;

/**
 * Contains information about a layer. The layer's data is located in the layer's store.
 */
export default class Layer {
	/**
	 * Forces all nodes of a schema to allow nulls.
	 * @type {Boolean}
	 */
	allowNulls = false;

	/**
	 * The path to the file to write the config file to. This value can be overwritten with a file
	 * path specified passed in when saving.
	 * @param {String}
	 */
	file = null;

	/**
	 * The layer identifier.
	 * @type {String|Symbol}
	 */
	id = null;

	/**
	 * An optional name of the scope encompassing this layer's data and schema.
	 * @type {String}
	 */
	namespace = null;

	/**
	 * The layer precedence in the layer list.
	 * @type {Number}
	 */
	order = 0;

	/**
	 * Indicates if the values in the store can be modified.
	 * @type {Boolean}
	 */
	readonly = false;

	/**
	 * The Joi schema.
	 * @type {Object}
	 */
	schema = null;

	/**
	 * Indicates if this layer can be unloaded.
	 * @type {Boolean}
	 */
	static = false;

	/**
	 * A reference to the layer's data store instance.
	 * @type {Store}
	 */
	store = null;

	/**
	 * A custom validation callback. If not set, defaults to validating against this layer's
	 * schema.
	 * @type {Function}
	 */
	validator = null;

	/**
	 * A lookup table of original watch handlers to their wrapped counterparts so that it can
	 * add a reference to this layer to the event handler.
	 * @type {Map}
	 */
	watcherMap = new Map();

	/**
	 * Initializes the layer, loads a file, and initializes the schema object.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.allowNulls] - Forces all nodes of a schema to allow nulls.
	 * @param {Object} [opts.data] - Data to initialize the base config layer with.
	 * @param {String} [opts.file] - The file backing this layer's store.
	 * @param {Boolean} [opts.graceful=true] - Try to load the file, but if it doesn't exist, then
	 * gracefully handle the error.
	 * @param {String|Symbol} [opts.id] - The layer id.
	 * @param {String} [opts.namespace] - The name of the scope encompassing this layer's data and
	 * schema if not already defined.
	 * @param {Number} [opts.order=0] - The layer precedence.
	 * @param {Boolean} [opts.readonly] - Indicates if this layer's data can be changed.
	 * @param {Object} [opts.schema] - A Joi schema or object to compile into a Joi schema.
	 * @param {Boolean} [opts.static] - Indicates if this layer can be unloaded.
	 * @param {Store} [opts.store] - The data store. Defaults to a `JSONStore` instance.
	 * @param {Function} [opts.validate] - A function to call and validate changes against a schema.
	 * @access public
	 */
	constructor(opts = {}) {
		this.allowNulls = opts.allowNulls;
		this.id         = opts.id || null;
		this.namespace  = opts.namespace;
		this.order      = opts.order || 0;
		this.readonly   = !!opts.readonly;
		this.static     = !!opts.static;

		if (opts.validate !== undefined) {
			if (typeof opts.validate !== 'function') {
				throw new TypeError('Expected validate callback to be a function');
			}
			this.validate = opts.validate;
		}

		let defaults, env;

		if (opts.schema) {
			this.loadSchema(opts.schema);
			({ defaults, env } = getSchemaInitialValues(this.schema));
		}

		if (opts.store instanceof Store) {
			this.store = opts.store;
			if (this.schema) {
				this.store.schema = this.schema;
			}
		} else if (typeof opts.store === 'function') {
			this.store = new opts.store({ data: defaults, schema: this.schema });
		} else {
			this.store = new JSONStore(opts.store || { data: defaults, schema: this.schema });
		}

		let { data } = opts;
		if (data) {
			if (typeof data !== 'object') {
				throw new TypeError('Expected layer data to be an object');
			}

			if (data && typeof data === 'object') {
				this.merge(this.namespace ? { [this.namespace]: data } : data);
			}
		}

		if (opts.file) {
			this.load(opts.file, opts.graceful !== false);
		}

		if (env) {
			// we can merge the environment variable values directly into the store since we've
			// already done the validation in `getSchemaInitialValues()`
			this.store.merge(env);
		}
	}

	/**
	 * Sets a value for the specified key.
	 *
	 * @param {Array.<String>} key - The key to set.
	 * @returns {Boolean}
	 */
	delete(key) {
		if (this.readonly) {
			throw new Error(`Layer "${String(this.id)}" is readonly`);
		}

		if (!key || !key.length) {
			throw new Error('Missing required config key');
		}

		this.validate({ action: 'delete', key });
		if (key = this.resolveKey(key)) {
			return this.store.delete(key);
		}

		return false;
	}

	/**
	 * Retrieves a value for the specified key.
	 *
	 * @param {Array.<String>} [key] - The key to get. When `undefined`, the entire config is
	 * returned.
	 * @returns {*}
	 * @access public
	 */
	get(key) {
		const nsKey = this.resolveKey(key);
		if (nsKey !== null) {
			let value = this.store.get(nsKey);
			if (!nsKey?.length && value === undefined) {
				// set to empty object if value
				value = {};
			}
			if (key.length && this.namespace && key[0] === this.namespace) {
				// return a specific value
				return value;
			}
			return this.namespace ? { [this.namespace]: value } : value;
		}
	}

	/**
	 * Determines if a key is set.
	 *
	 * @param {Array.<String>} [key] - The key to check.
	 * @returns {Boolean}
	 * @access public
	 */
	has(key) {
		const nsKey = this.resolveKey(key);
		if (nsKey !== null) {
			if (key.length === 1 && this.namespace && key[0] === this.namespace) {
				return true;
			}
			return this.store.has(nsKey);
		}
		return false;
	}

	/**
	 * Loads a config file.
	 *
	 * @param {String} file - The path to the config file to load.
	 * @param {Boolean} [graceful=false] - When `true`, doesn't error if the config file does not
	 * exist.
	 * @returns {Layer}
	 * @access public
	 */
	load(file, graceful) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected config file path to be a string');
		}

		const exists = fs.existsSync(file);
		this.file = file;

		if (graceful && !exists) {
			log(`${String(this.id)} Gracefully handling non-existent config file: ${highlight(file)}`);
		}

		if (!graceful || exists) {
			this.store.load(file);
			const data = this.store.get();
			this.validate({
				action: 'load',
				message: 'Failed to load config file',
				value: this.namespace ? { [this.namespace]: data } : data
			});
		}

		return this;
	}

	/**
	 * Loads a schema from a file or object.
	 *
	 * @param {String|Object} schema - The path to the config file to load or Joi schema.
	 * @returns {Layer}
	 * @access public
	 */
	loadSchema(schema) {
		if (!schema) {
			throw new TypeError('Expected schema to be an object or file');
		}

		if (typeof schema === 'string') {
			if (!fs.existsSync(schema)) {
				throw new Error(`File not found: ${schema}`);
			}

			const ext = path.extname(schema);
			if (ext !== '.js' && ext !== '.json') {
				throw new Error(`Unsupported schema file type: ${ext}`);
			}

			log(`${String(this.id)} Loading ${highlight(schema)}`);
			if (ext === '.json') {
				try {
					schema = fs.readJsonSync(schema);
				} catch (e) {
					throw new Error(`Failed to parse schema json file: ${e.message}`);
				}
			} else if (ext === '.js') {
				try {
					schema = importFresh(schema);
				} catch (e) {
					throw new Error(`Failed to parse schema js file: ${e.message}`);
				}

				// check if we have a babel transpiled file
				if (schema && typeof schema === 'object' && schema.__esModule && schema.default) {
					schema = schema.default;
				}

				if (typeof schema === 'function') {
					schema = schema({ ctx: this, Joi });
				}
			}
		}

		if (!schema || typeof schema !== 'object') {
			throw new TypeError('Expected schema to be an object or file');
		}

		if (Joi.isSchema(schema)) {
			if (schema.type !== 'object') {
				throw new TypeError('Expected schema root to be an object');
			}

			if (this.namespace) {
				let found = false;
				for (const item of schema.$_terms.keys) {
					if (item.key === this.namespace && item.schema.type === 'object') {
						found = true;
						break;
					}
				}
				if (!found) {
					schema = Joi.object({ [this.namespace]: schema });
				}
			}
		} else {
			if (this.namespace && !Object.prototype.hasOwnProperty.call(schema, this.namespace)) {
				schema = { [this.namespace]: schema };
			}
			log(`${String(this.id)} Compiling schema...`);
			schema = Joi.compile(schema);
		}

		if (this.allowNulls) {
			log(`${String(this.id)} Forcing nulls on schema`);
			(function walk(schema) {
				if (schema._valids) {
					schema._valids.add(null);
				} else {
					schema._valids = new Values([ null ]);
				}

				if (schema.type === 'object' && schema.$_terms.keys) {
					for (const item of schema.$_terms.keys) {
						walk(item.schema);
					}
				}
			}(schema));
		}

		this.schema = schema;

		// when loadSchema() is called from the constructor, `this.store` will not have been set
		// yet, so this is really for the public API
		if (this.store) {
			this.store.schema = this.namespace && schema.$_terms.keys?.find(s => s.key === this.namespace)?.schema || schema;
		}

		return this;
	}

	/**
	 * Deeply merges an object into a layer's store.
	 *
	 * @param {Object} value - The data to merge.
	 * @returns {Layer}
	 * @access public
	 */
	merge(value) {
		if (this.readonly) {
			throw new Error(`Layer "${String(this.id)}" is readonly`);
		}
		this.validate({ action: 'merge', value });
		if ((!this.namespace || (value = value[this.namespace])) && typeof value === 'object') {
			this.store.merge(value);
		}
		return this;
	}

	/**
	 * Checks if this layer has a namespaces and if the key has the namespace, then returns the
	 * resolved key.
	 *
	 * @param {Array.<String>} key - The key to resolve.
	 * @returns {Array.<String>}
	 * @access private
	 */
	resolveKey(key) {
		if (key.length && this.namespace) {
			return key[0] === this.namespace ? key.slice(1) : null;
		}
		return key;
	}

	/**
	 * Saves a specific layer's store to disk.
	 *
	 * @param {String} [file] - The file to write the layers store to.
	 * @returns {Layer}
	 * @access public
	 */
	save(file) {
		log(`${String(this.id)} Saving to file: ${highlight(file || this.file)}`);
		this.store.save(file || this.file);
		return this;
	}

	/**
	 * Sets a value for the specified key.
	 *
	 * @param {Array.<String>} key - The key to set.
	 * @param {*} [value] - The value;
	 * @param {String} [action="set"] - An action hint for validation.
	 * @returns {Layer}
	 */
	set(key, value, action = 'set') {
		if (this.readonly) {
			throw new Error(`Layer "${String(this.id)}" is readonly`);
		}

		if (!key || !key.length) {
			throw new Error('Missing required config key');
		}

		this.validate({ action, key, value });
		if (key = this.resolveKey(key)) {
			this.store.set(key, value);
		}

		return this;
	}

	/**
	 * Returns a value of the store as a string.
	 *
	 * @param {*} [args] - Various arguments to pass into the store's `toString()`.
	 * @returns {String}
	 * @access public
	 */
	toString(...args) {
		return this.store?.toString(...args) || '';
	}

	/**
	 * Checks if this layer can be unloaded.
	 *
	 * @returns {Layer}
	 * @access public
	 */
	unload() {
		if (this.static) {
			throw new Error('Cannot unload static layer');
		}
		return this;
	}

	/**
	 * Removes a watch handler.
	 *
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {Layer}
	 * @access public
	 */
	unwatch(handler) {
		const wrapped = this.watcherMap.get(handler);
		if (wrapped) {
			this.store.unwatch(wrapped);
			this.watcherMap.delete(handler);
		}
		return this;
	}

	/**
	 * Returns a validator function that either invokes the custom validator or the default
	 * validator.
	 *
	 * @type {Function}
	 */
	get validate() {
		return args => (this.validator || validate)({
			schemas: this.schema ? [ this.schema ] : [],
			...args
		});
	}

	set validate(fn) {
		if (!fn || typeof fn !== 'function') {
			throw new TypeError('Expected validator to be a function');
		}
		this.validator = fn;
	}

	/**
	 * Registers a watch handler.
	 *
	 * @param {Array.<String>} [filter] - A property name or array of nested properties to watch.
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {Layer}
	 * @access public
	 */
	watch(filter, handler) {
		const wrapped = obj => handler(obj, this);
		this.watcherMap.set(handler, wrapped);
		this.store.watch(filter, wrapped);
		return this;
	}
}
