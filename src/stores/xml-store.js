import detectIndent from 'detect-indent';
import fs from 'fs-extra';
import path from 'path';
import snooplogg from 'snooplogg';
import Store from '../store';
import XNode from './xml/xnode';
import { detectLineEndings, unescapeSequence } from './xml/util';
import { DOMParser } from '@xmldom/xmldom';
import { moveSync, writeFileSync } from '../fsutil';

const { log } = snooplogg('config-kit')('xml');
const { highlight } = snooplogg.styles;

/**
 * Loads `.xml` config files.
 */
export default class XMLStore extends Store {
	/**
	 * The file extension associated to this type of store.
	 * @type {String}
	 */
	static extension = '.xml';

	/**
	 * Initializes the store.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Object} [opts.data] - A data object to initialize the store with.
	 * @param {Object} [opts.schema] - A Joi schema object. This is only used when a config-kit
	 * layer is being initialized with an existing `XMLStore` instance or for unit tests.
	 * @access public
	 */
	constructor(opts = {}) {
		super(opts);

		if (opts.schema) {
			if (typeof opts.schema !== 'object') {
				throw new TypeError('Expected schema to be an object');
			}
			this._schema = opts.schema;
		}

		this.loadFromString();

		if (opts.data) {
			this.merge(opts.data);
		}
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
		let node = this.data;

		if (key?.length) {
			for (let i = 0, prop; node !== undefined && (prop = key[i++]); node = node[prop]) {
				if (typeof node !== 'object') {
					return;
				}
			}
		}

		return node;
	}

	/**
	 * Determines if a key is set.
	 *
	 * @param {Array.<String>} [key] - The key to check.
	 * @returns {Boolean}
	 * @access public
	 */
	has(key) {
		let node = this.data;

		if (key?.length) {
			for (let i = 0, prop; node !== undefined && (prop = key[i++]); node = node[prop]) {
				if (typeof node !== 'object') {
					return false;
				}
			}
		}

		return node !== undefined;
	}

	/**
	 * Loads a config file.
	 *
	 * @param {String} file - The path to the xml file to load.
	 * @returns {XMLStore}
	 * @access public
	 */
	load(file) {
		if (!fs.existsSync(file)) {
			const err = new Error(`File not found: ${file}`);
			err.code = 'ENOENT';
			throw err;
		}

		log(`Loading ${highlight(file)}`);
		return this.loadFromString(fs.readFileSync(file, 'utf8'));
	}

	/**
	 * Parse a string containing the XML document.
	 *
	 * @param {String} [str] - An XML string.
	 * @returns {XMLStore}
	 * @access public
	 */
	loadFromString(str = '<?xml version="1.0" encoding="UTF-8"?>') {
		if (str && typeof str !== 'string') {
			throw new TypeError('Expected string containing XML to parse');
		}

		let errorMsg;
		const parser = new DOMParser({
			errorHandler: err => errorMsg = err
		});
		const doc = parser.parseFromString(str, 'text/xml');
		if (errorMsg) {
			throw new Error(errorMsg);
		}

		let foundPIN = false;
		let child = doc.firstChild;
		for (; child; child = child.nextSibling) {
			if (child.nodeType === doc.PROCESSING_INSTRUCTION_NODE) {
				foundPIN = true;
				break;
			}
		}
		if (!foundPIN) {
			const pin = doc.createProcessingInstruction('xml', 'version="1.0" encoding="UTF-8"');
			doc.insertBefore(doc.createTextNode('\n'), doc.firstChild);
			doc.insertBefore(pin, doc.firstChild);
		}

		doc.indent = detectIndent(str).indent || '\t';
		doc.lineEnding = detectLineEndings(str);
		log(`Detected line ending ${highlight(unescapeSequence(doc.lineEnding))} indent ${highlight(unescapeSequence(doc.indent))}`);

		this.doc = doc;

		this.regen();

		return this;
	}

	/**
	 * Deeply merges an object into a layer's store.
	 *
	 * @param {Object} data - The data to merge.
	 * @returns {XMLStore}
	 * @access public
	 */
	merge(data) {
		if (!data || typeof data !== 'object') {
			throw new TypeError('Expected data to be an object');
		}
		XNode.merge(this.data, data);
		return this;
	}

	/**
	 * Regenerates the data tree by simultaneously walking the schema and XML document.
	 *
	 * @access private
	 */
	regen() {
		if (!this.doc && !this._schema) {
			this.data = null;
			return;
		}

		this.data = XNode.createNode({
			domNode:      this.doc,
			existingNode: this.data,
			schema:       this._schema
		});
	}

	/**
	 * Saves the data to disk.
	 *
	 * @param {String} file - The filename to save the data to.
	 * @returns {XMLStore}
	 * @access public
	 */
	save(file) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected config file path to be a string');
		}

		const ext = path.extname(file);
		if (ext !== XMLStore.extension) {
			throw new Error(`Expected XML config file to have "${XMLStore.extension}" extension, found "${ext}"`);
		}

		const tmpFile = `${file}.${Date.now()}.tmp`;
		writeFileSync(tmpFile, this.doc.toString(), { applyOwner: this.applyOwner });
		moveSync(tmpFile, file, { applyOwner: this.applyOwner });
		log(`Wrote config file: ${highlight(file)}`);

		return this;
	}

	/**
	 * A Joi schema object.
	 * @type {Object}
	 * @access public
	 */
	get schema() {
		return super.schema;
	}

	set schema(newSchema) {
		super.schema = newSchema;
		this.regen();
	}

	/**
	 * Sets the value for a given config key.
	 *
	 * @param {Array.<String>} key - The key to set.
	 * @param {*} value - The value to set.
	 * @returns {XMLStore}
	 * @access public
	 */
	set(key, value) {
		XNode.pause(this.data);

		let obj = this.data;
		for (let i = 0, len = key.length; i < len; i++) {
			const segment = key[i];
			if (i + 1 < len) {
				if (typeof obj[segment] !== 'object' || Array.isArray(obj[segment])) {
					obj[segment] = {};
					// obj[segment][XNode.Meta].domNode = createDOMNode(segment, undefined, obj[XNode.Meta].domNode);
				}
				obj = obj[segment];
			} else {
				obj[segment] = value;
			}
		}

		XNode.resume(this.data);

		return this;
	}

	/**
	 * Returns the data as a JSON-encoded string.
	 *
	 * @returns {String}
	 * @access public
	 */
	toString() {
		return this.doc.toString();
	}

	/**
	 * Removes a watch handler.
	 *
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {XMLStore}
	 * @access public
	 */
	unwatch(handler) {
		this.data[XNode.Meta].unwatch(handler);
		return this;
	}

	/**
	 * Registers a watch handler.
	 *
	 * @param {String|Array.<String>} [filter] - A property name or array of nested properties to
	 * watch.
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {XMLStore}
	 * @access public
	 */
	watch(filter, handler) {
		this.data[XNode.Meta].watch(filter, handler);
		return this;
	}
}
