import fs from 'fs-extra';
import Node from '../node';
import path from 'path';
import snooplogg from 'snooplogg';
import Store from '../store';
import { moveSync, writeFileSync } from '../fsutil';

const { log } = snooplogg('config-kit')('json-store');
const { highlight } = snooplogg.styles;

/**
 * Loads `.json` config files.
 */
export default class JSONStore extends Store {
	/**
	 * The file extension associated to this type of store.
	 * @type {String}
	 */
	static extension = '.json';

	/**
	 * Initializes the store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.data] - A data object to initialize the store with.
	 * @access public
	 */
	constructor(opts = {}) {
		super(opts);

		const data = opts.data || {};
		if (typeof data !== 'object') {
			throw new TypeError('Expected config data to be an object');
		}

		/**
		 * The data in this store.
		 * @type {Object}
		 */
		this.data = new Node(data);
	}

	/**
	 * Deletes a config value.
	 *
	 * @param {Array.<String>} key - The key to delete.
	 * @returns {Boolean} Returns `true` if the value was deleted.
	 * @access public
	 */
	delete(key) {
		const stack = [];
		const len = key.length;
		let found = false;
		let { data } = this;
		let prop;

		for (let i = 0; data !== undefined && (prop = key[i]); i++) {
			if (!Object.prototype.hasOwnProperty.call(data, prop)) {
				break;
			}

			if (i + 1 === len) {
				found = true;
				delete data[prop];

				while (data = stack.pop()) {
					if (Object.keys(data[key[--i]]).length) {
						break;
					}
					delete data[key[i]];
				}
			} else {
				stack.push(data);
				data = data[prop];
			}
		}

		return found;
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
		let { data } = this;

		if (key?.length) {
			for (let i = 0, prop; data !== undefined && (prop = key[i++]); data = data[prop]) {
				if (typeof data !== 'object') {
					return;
				}
			}
		}

		if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length) {
			return data;
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
		let { data } = this;

		if (key?.length) {
			for (let i = 0, prop; data !== undefined && (prop = key[i++]); data = data[prop]) {
				if (typeof data !== 'object') {
					return false;
				}
			}
		}

		return data !== undefined;
	}

	/**
	 * Returns an array of the names of the keys defined on the object.
	 *
	 * @returns {Array.<String>}
	 * @access public
	 */
	keys() {
		return Object.getOwnPropertyNames(this.data);
	}

	/**
	 * Loads a config file.
	 *
	 * @param {String} file - The path to the config file to load.
	 * @returns {JSONStore}
	 * @access public
	 */
	load(file) {
		if (!fs.existsSync(file)) {
			const err = new Error(`File not found: ${file}`);
			err.code = 'ENOENT';
			throw err;
		}

		let content;
		let data;

		log(`Loading ${highlight(file)}`);
		try {
			content = fs.readFileSync(file, 'utf8');
		} catch (e) {
			e.message = `Failed to load config file: ${e.message}`;
			throw e;
		}

		try {
			data = JSON.parse(content);
		} catch (e) {
			e.message = `Failed to load config file: ${e.message}`;
			throw e;
		}

		if (!data || typeof data !== 'object') {
			throw new TypeError('Expected config file to be an object');
		}

		Node.merge(this.data, data);

		return this;
	}

	/**
	 * Deeply merges an object into a layer's store.
	 *
	 * @param {Object} data - The data to merge.
	 * @returns {JSONStore}
	 * @access public
	 */
	merge(data) {
		Node.merge(this.data, data);
		return this;
	}

	/**
	 * Saves the data to disk.
	 *
	 * @param {String} file - The filename to save the data to.
	 * @returns {JSONStore}
	 * @access public
	 */
	save(file) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected config file path to be a string');
		}

		const ext = path.extname(file);
		if (ext !== JSONStore.extension) {
			throw new Error(`Expected JSON config file to have "${JSONStore.extension}" extension, found "${ext}"`);
		}

		const tmpFile = `${file}.${Date.now()}.tmp`;
		writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), { applyOwner: this.applyOwner });
		moveSync(tmpFile, file, { applyOwner: this.applyOwner });
		log(`Wrote config file: ${highlight(file)}`);

		return this;
	}

	/**
	 * Sets the value for a given config key.
	 *
	 * @param {Array.<String>} key - The key to set.
	 * @param {*} value - The value to set.
	 * @returns {JSONStore}
	 * @access public
	 */
	set(key, value) {
		Node.pause(this.data);

		let obj = this.data;
		for (let i = 0, len = key.length; i < len; i++) {
			const segment = key[i];
			if (i + 1 < len) {
				if (typeof obj[segment] !== 'object' || Array.isArray(obj[segment])) {
					obj[segment] = {};
				}
				obj = obj[segment];
			} else {
				obj[segment] = value;
			}
		}

		Node.resume(this.data);

		return this;
	}

	/**
	 * Returns the data as a JSON-encoded string.
	 *
	 * @param {Number} [indentation=2] The number of spaces to indent the JSON formatted output.
	 * @returns {String}
	 * @access public
	 */
	toString(indentation) {
		return JSON.stringify(this.data, null, indentation);
	}

	/**
	 * Removes a watch handler.
	 *
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {JSONStore}
	 * @access public
	 */
	unwatch(handler) {
		Node.unwatch(this.data, handler);
		return this;
	}

	/**
	 * Registers a watch handler.
	 *
	 * @param {Array.<String>} [filter] - A property name or array of nested properties to watch.
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {JSONStore}
	 * @access public
	 */
	watch(filter, handler) {
		Node.watch(this.data, filter?.length ? filter : null, handler);
		return this;
	}
}
