/* eslint no-unused-vars: 0 */

import Joi from 'joi';

/**
 * A base class for all store implemntations.
 */
export default class Store {
	/**
	 * The file extension associated to this type of store.
	 * @type {String}
	 */
	static extension = null;

	/**
	 * A Joi schema. The `Layer` will pass in the schema into the `schema` setter during
	 * construction or when the schema is loaded.
	 * @type {Object}
	 */
	_schema = null;

	/**
	 * Initializes the store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.applyOwner=true] - When `true`, determines the owner of the closest
	 * existing parent directory and apply the owner to the file and any newly created directories.
	 * @param {String} [opts.file] - The file backing this layer's store.
	 * @access public
	 */
	constructor(opts = {}) {
		if (new.target === Store) {
			throw new TypeError('Cannot create instance of abstract Store class');
		}

		if (!opts || typeof opts !== 'object') {
			throw new TypeError('Expected store options to be an object');
		}

		this.applyOwner = opts.applyOwner !== false;
	}

	/**
	 * Deletes a config value.
	 *
	 * @param {Array.<String>} key - The key to delete.
	 * @access public
	 */
	delete(key) {
		throw new Error('delete() not implemented');
	}

	/**
	 * Retrieves a value for the specified key.
	 *
	 * @param {Array.<String>} [key] - The key to get. When `undefined`, the entire config is
	 * returned.
	 * @access public
	 */
	get(key) {
		throw new Error('get() not implemented');
	}

	/**
	 * Determines if a key is set.
	 *
	 * @param {Array.<String>} [key] - The key to check.
	 * @access public
	 */
	has(key) {
		throw new Error('has() not implemented');
	}

	/**
	 * Returns an array of the names of the keys defined on the object.
	 *
	 * @access public
	 */
	keys() {
		throw new Error('keys() not implemented');
	}

	/**
	 * Loads a config file.
	 *
	 * @param {String} file - The path to the config file to load.
	 * @returns {Promise}
	 * @access public
	 */
	async load(file) {
		throw new Error('load() not implemented');
	}

	/**
	 * Deeply merges an object into a layer's store.
	 *
	 * @param {Object} value - The data to merge.
	 * @access public
	 */
	merge(value) {
		throw new Error('merge() not implemented');
	}

	/**
	 * Saves the data to disk.
	 *
	 * @param {String} file - The filename to save the data to.
	 * @returns {Promise}
	 * @access public
	 */
	async save(file) {
		throw new Error('save() not implemented');
	}

	/**
	 * A Joi schema object.
	 * @type {Object}
	 * @access public
	 */
	get schema() {
		return this._schema;
	}

	set schema(newSchema) {
		if (newSchema && (!Joi.isSchema(newSchema) || newSchema.type !== 'object')) {
			throw new TypeError('Expected schema root to be an object');
		}
		this._schema = newSchema;
	}

	/**
	 * Sets the value for a given config key.
	 *
	 * @param {Array.<String>} key - The key to set.
	 * @param {*} value - The value to set.
	 * @access public
	 */
	set(key, value) {
		throw new Error('set() not implemented');
	}

	/**
	 * Removes a watch handler.
	 *
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @access public
	 */
	unwatch(handler) {
		// nothing to do
	}

	/**
	 * Registers a watch handler.
	 *
	 * @param {Array.<String>} [filter] - A property name or array of nested properties to watch.
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @access public
	 */
	watch(filter, handler) {
		// nothing to do
	}
}
