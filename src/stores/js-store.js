import fs from 'fs-extra';
import importFresh from 'import-fresh';
import JSONStore from './json-store';
import Node from '../node';
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
	 * @returns {JSONStore}
	 * @access public
	 */
	load(file) {
		if (!fs.existsSync(file)) {
			const err = Error(`File not found: ${file}`);
			err.code = 'ENOENT';
			throw err;
		}

		log(`Loading ${highlight(file)}`);
		let data = importFresh(file);

		// check if we have a babel transpiled file
		if (data && typeof data === 'object' && data.__esModule && data.default) {
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
	 * @access public
	 */
	save() {
		throw new Error('Saving JavaScript config files is unsupported');
	}
}
