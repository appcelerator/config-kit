/* eslint no-unused-vars: 0 */

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
	 * Initializes the store.
	 *
	 * @param {Object} [opts] - Various options.
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
	 * Loads a config file.
	 *
	 * @param {String} file - The path to the config file to load.
	 * @access public
	 */
	load(file) {
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
	 * @access public
	 */
	save(file) {
		throw new Error('save() not implemented');
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
