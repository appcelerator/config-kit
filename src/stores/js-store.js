import fs from 'fs-extra';
import JSONStore from './json-store.js';
import Node from '../node.js';
import snooplogg from 'snooplogg';

const { log } = snooplogg('config-kit')('js-store');
const { highlight } = snooplogg.styles;

/**
 * Loads `.js` config files.
 */
export default class JSStore extends JSONStore {
	/**
	 * The file extension associated to this type of store.
	 * @type {String}
	 */
	static extension = '.js';

	/**
	 * Loads a config file.
	 *
	 * @param {String} file - The path to the config file to load.
	 * @returns {Promise} Resolves this `JSONStore` instance.
	 * @access public
	 */
	async load(file) {
		if (!fs.existsSync(file)) {
			const err = Error(`File not found: ${file}`);
			err.code = 'ENOENT';
			throw err;
		}

		log(`Loading ${highlight(file)}`);
		let data = await import(file);

		if (data?.default) {
			data = data.default;
		}

		if (typeof data === 'function') {
			data = data({ ctx: this });
		}

		if (!data || typeof data !== 'object') {
			throw new TypeError('Expected config file to be an object');
		}

		this.data = new Node(data);
		this.file = file;

		return this;
	}

	/**
	 * Saves the data to disk.
	 *
	 * @resolves {Promise}
	 * @access public
	 */
	async save() {
		throw new Error('Saving JavaScript config files is unsupported');
	}
}
