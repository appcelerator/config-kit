import Joi from 'joi';
import JSStore from './stores/js-store';
import JSONStore from './stores/json-store';
import LayerList, { All, Base } from './layer-list';
import Node from './node';
import path from 'path';
import snooplogg from 'snooplogg';
import Store from './store';
import StoreRegistry from './store-registry';
import XMLStore from './stores/xml-store';
import { arrayify, hashValue, splitKey, unique } from './util';

const { log } = snooplogg('config-kit')('config');
const { highlight } = snooplogg.styles;

const arrayActionRE = /^pop|push|shift|unshift$/;

/**
 * The main config object that orchestrates data access and file interaction.
 */
export default class Config {
	/**
	 * A special id that signifies all layers when querying a list of layers.
	 * @type {Symbol}
	 * @access public
	 */
	static All = All;

	/**
	 * The id for the base layer.
	 * @type {Symbol}
	 * @access public
	 */
	static Base = Base;

	/**
	 * A reference to the Joi schema library.
	 * @type {Object}
	 * @access public
	 */
	Joi = Joi;

	/**
	 * Manages the list of layers.
	 * @type {LayerList}
	 * @access public
	 */
	layers = null;

	/**
	 * Internal counter for change notifications.
	 * @type {Number}
	 */
	paused = 0;

	/**
	 * A map of pending notifications by filter hash to `Map` instances. Each `Map` instance ties
	 * the handler to the watch filter and event arguments.
	 * @type {Object}
	 */
	pending = {};

	/**
	 * Tracks the store types by file extension.
	 * @type {StoreRegistry}
	 * @access public
	 */
	stores = new StoreRegistry();

	/**
	 * A lookup table of original watch handlers to their wrapped counterparts so that it can
	 * dedupe events.
	 * @type {Map}
	 */
	watcherMap = new Map();

	/**
	 * Initializes the config object.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.allowNulls] - Forces all nodes of a schema to allow nulls.
	 * @param {Boolean} [opts.allowUnknown=true] - Allows object values to contain unknown keys.
	 * @param {Object} [opts.data] - Data to initialize the base config layer with.
	 * @param {String} [opts.file] - The file to associate with the base layer.
	 * @param {Object|Layer|Array.<Object|Layer>} [opts.layers] - One or more layers to add in
	 * addition to the base layer.
	 * @param {Object} [opts.schema] - A Joi schema for the base layer.
	 * @param {Store|Function} [opts.store] - A store instance or store class to use for the base
	 * layer.
	 * @param {Function|Array.<Function>} [opts.stores] - A store class or array of store classes
	 * to register in addition to the built-in `JSStore` and `JSONStore`.
	 * @access public
	 */
	constructor(...opts) {
		if (opts.length) {
			for (const opt of opts) {
				if (opt && typeof opt !== 'object') {
					throw new TypeError('Expected config options to be an object');
				}
			}
			opts = Object.assign({}, ...opts);
		} else {
			opts = {};
		}

		if (opts.data && typeof opts.data !== 'object') {
			throw new TypeError('Expected config data to be an object');
		}

		this.stores.add(JSStore);
		this.stores.add(JSONStore);
		this.stores.add(XMLStore);
		for (const store of arrayify(opts.stores)) {
			this.stores.add(store);
		}

		let { store } = opts;
		if (store) {
			// if we have an explicit `store`, then register it's class
			this.stores.add(store instanceof Store ? Object.getPrototypeOf(store).constructor : store);
		} else if (opts.file) {
			const StoreClass = this.stores.get(path.extname(opts.file));
			store = new StoreClass();
		}

		this.layers = new LayerList({
			allowNulls:   opts.allowNulls,
			allowUnknown: opts.allowUnknown !== false,
			data:         opts.data,
			file:         opts.file,
			schema:       opts.schema,
			store:        opts.store
		});

		for (const layer of arrayify(opts.layers)) {
			this.layers.add(layer);
		}
	}

	/**
	 * Retrieves the data store for a specific layer.
	 *
	 * Note that not all stores expose their internal data structure. This method is leaky and
	 * probably should be removed someday.
	 *
	 * @param {String|Symbol} id - The layer id.
	 * @returns {Object}
	 * @access public
	 */
	data(id) {
		return this.layers.get(id)?.store?.data;
	}

	/**
	 * Deletes a config value.
	 *
	 * @param {String|Array.<String>} key - The key to delete.
	 * @param {String|Symbol} id - A specific layer id to delete the value from.
	 * @returns {Boolean} Returns `true` if the value was deleted.
	 * @access public
	 */
	delete(key, id) {
		key = splitKey(key);
		let deleted = false;

		this._pause();

		for (const layer of this.layers.query(id)) {
			if (layer) {
				log(`Deleting ${highlight(key.join('.'))} on layer ${highlight(String(layer.id))}`);
				deleted = layer.delete(key) || deleted;
			}
		}

		this._resume();

		return deleted;
	}

	/**
	 * Retrieves a value for the specified key.
	 *
	 * @param {String|Array.<String>} [key] - The key to get. When `undefined`, the entire config
	 * is returned.
	 * @param {*} [defaultValue] - A value to return if the key is not found.
	 * @param {String|Symbol|Array.<String|Symbol>} [id] - A specific id or ids to scan for the
	 * key. If not specified, then it scans all layers.
	 * @returns {*}
	 * @access public
	 */
	get(key, defaultValue, id) {
		const origKey = key;
		const replace = it => {
			if (typeof it === 'string') {
				return it.replace(/\{\{([^}]+)\}\}/g, (m, k) => {
					const value = this.get(k);
					if (value === undefined) {
						throw new Error(`Config key "${origKey}" references undefined variable "${k}"`);
					}
					return value;
				});
			} else if (Array.isArray(it)) {
				return it.map(i => replace(i));
			} else if (it && typeof it === 'object') {
				const obj = {};
				for (const [ key, value ] of Object.entries(it)) {
					obj[key] = replace(value);
				}
				return obj;
			}
			return it;
		};
		const merge = (src, dest) => {
			for (const [ key, srcValue ] of Object.entries(src)) {
				if (srcValue && typeof srcValue === 'object' && dest[key] && typeof dest[key] === 'object' && !Array.isArray(srcValue)) {
					merge(srcValue, dest[key]);
				} else {
					dest[key] = srcValue;
				}
			}
		};

		key = splitKey(key);

		let result;
		const objects = [];

		// loop through the layers in reverse until we hit a non-object value and accumulate
		// object values for merging if no non-object found
		for (const layer of this.layers.query(id, true)) {
			const value = replace(layer.get(key));
			if (value !== undefined) {
				if (value === null || typeof value !== 'object' || Array.isArray(value)) {
					return value;
				}
				objects.unshift(value);
			}
		}

		// merge all objects
		if (objects.length) {
			result = {};
			for (const obj of objects) {
				merge(obj, result);
			}
		}

		if (result !== undefined) {
			return result;
		}

		return defaultValue !== undefined || key.length ? replace(defaultValue) : {};
	}

	/**
	 * Determines if a key is set.
	 *
	 * @param {String|Array.<String>} [key] - The key to check.
	 * @param {String|Symbol|Array.<String|Symbol>} [id] - A specific layer id or ids to scan for
	 * the key. If not specified, then it scans all layers.
	 * @returns {Boolean}
	 * @access public
	 */
	has(key, id) {
		key = splitKey(key);
		for (const layer of this.layers.query(id, true)) {
			if (layer.has(key)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Loads a config file. By default, it loads it into the config's default layer.
	 *
	 * @param {String} file - The path to the config file to load.
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.graceful=false] - When `true`, doesn't error if the config file does
	 * not exist.
	 * @param {Object} [opts.id] - The layer id to load the file into. If the layer id does not
	 * exist, it will create it.
	 * @param {String} [opts.namespace] - The name of the scope encompassing this layer's data and
	 * schema if not already defined.
	 * @param {Number} [opts.order=0] - The layer precedence.
	 * @param {Boolean} [opts.readonly] - Indicates if this layer's data can be changed.
	 * @param {Object|String} [opts.schema] - A Joi schema, object to compile into a Joi schema, or
	 * a path to a `.js` or `.json` file containing a Joi schema.
	 * @param {Boolean} [opts.static] - Indicates if this layer can be unloaded.
	 * @returns {Config}
	 * @access public
	 */
	load(file, opts = {}) {
		if (!file || typeof file !== 'string') {
			throw new TypeError('Expected config file to be a non-empty string');
		}

		if (opts && typeof opts === 'string') {
			opts = { id: opts };
		}

		if (!opts || typeof opts !== 'object') {
			throw new Error('Expected options to be an object');
		}

		const filename = path.basename(file);
		const tags = filename.split('.').slice(1);
		const ext = tags.pop();
		const StoreClass = this.stores.get(`.${ext}`);

		if (!StoreClass) {
			throw new Error(`Unsupported file type "${ext ? `.${ext}` : filename}"`);
		}

		const layers = unique(opts.id || this.resolve({ action: 'load', tags }));

		log(`Loading ${highlight(file)} into ${layers.map(s => highlight(String(s))).join(', ')}`);

		for (const id of layers) {
			const existing = this.layers.get(id);

			const layer = this.layers.add({
				...opts,
				file,
				graceful: !!opts.graceful,
				id,
				store: new StoreClass()
			});

			if (existing) {
				// if we already have an existing layer, then this is considered a "reload" and we
				// need to determine if the contents changed, specifically any filtered data

				this._pause();

				// we need to loop over the list of watchers that the `LayerList` has already
				// copied from the existing layer to the new layer

				// to optimize performance, both the value and hash for the existing and new
				// layers is cached per filter

				// if the values are objects, then compare hashes, otherwise compare values and if
				// there's a discrepancy, queue the change notification

				const existingHashes = {};
				const existingValues = {};
				const newHashes = {};
				const newValues = {};

				for (const { filter, filterHash, handler } of this.layers.watchers) {
					let existingHash, existingValue, newHash, newValue;

					if (Object.prototype.hasOwnProperty.call(existingHashes, filterHash)) {
						existingValue = existingValues[filterHash];
						existingHash = existingHashes[filterHash];
					} else {
						existingValue = existingValues[filterHash] = existing.get(filter);
						existingHash = existingHashes[filterHash] = existingValue?.[Node.Meta]?.hash;
					}

					if (Object.prototype.hasOwnProperty.call(newHashes, filterHash)) {
						newValue = newValues[filterHash];
						newHash = newHashes[filterHash];
					} else {
						newValue = newValues[filterHash] = layer.get(filter);
						newHash = newHashes[filterHash] = newValue?.[Node.Meta]?.hash;
					}

					// if there was an existing node and the hash of the existing layer and the new layer are
					// different, then notify the handler immediately
					if ((existingHash !== newHash) || ((existingHash === undefined || newHash === undefined) && existingValue !== newValue)) {
						// hashes are different -or- value changed type and only one has a type, then compare values
						if (!this.pending[filterHash]) {
							this.pending[filterHash] = new Map();
						}
						log(`Detected change in loaded file${filter.length ? ` with filter "${filter.join('.')}"` : ''}`);
						this.pending[filterHash].set(handler, { args: [ layer ], filter, value: newValue });
					}
				}

				this._resume();
			}
		}

		return this;
	}

	/**
	 * Deeply merges an object into a layer's store.
	 *
	 * @param {Object} data - The data to merge.
	 * @param {String|Symbol} [id] - A specific layer id or ids to merge the data into. If not
	 * specified, then it merges the data into the config's default layer.
	 * @returns {Config}
	 * @access public
	 */
	merge(data, id) {
		if (data && typeof data === 'object' && !Array.isArray(data)) {
			for (const layer of this.layers.query(id)) {
				if (layer) {
					layer.merge(data);
				}
			}
		}
		return this;
	}

	/**
	 * Internal helper for invoking mutator methods on the layer.
	 *
	 * @param {Object} opts - Various options.
	 * @param {String} opts.action - The action to perform. Must be 'set', 'push', 'pop', 'shift',
	 * or 'unshift'.
	 * @returns {*}
	 * @access private
	 */
	_mutate({ action, key, value, id }) {
		key = splitKey(key);

		if (!key || !key.length) {
			throw new Error('Missing required config key');
		}

		let result;
		let label = 'Setting';

		if (arrayActionRE.test(action)) {
			const existing = unique(this.get(key));

			if (action === 'pop' || action === 'shift') {
				label = action === 'pop' ? 'Popping' : 'Shifting';
				result = existing[action]();
				value = existing;
			} else if (action === 'push') {
				label = 'Pushing';
				value = unique(Array.isArray(value) ? [ ...existing, ...value ] : [ ...existing, value ]);
			} else {
				label = 'Unshifting';
				value = unique(Array.isArray(value) ? [ ...value, ...existing ] : [ value, ...existing ]);
			}
		}

		this._pause();

		for (const _id of unique(id || this.resolve({ action }))) {
			const layer = this.layers.get(_id) || this.layers.add(_id);
			const type = Array.isArray(value) ? 'array' : typeof value;
			log(`${label} ${highlight(key.join('.'))} to a${type === 'array' || type === 'object' ? 'n' : ''} ${highlight(type)} on layer ${highlight(String(layer.id))}`);
			layer.set(key, value, action);
		}

		this._resume();

		return result;
	}

	/**
	 * Internal helper for dispatching change notifications.
	 *
	 * @access private
	 */
	_notify() {
		const pending = Object.entries(this.pending);
		if (pending.length) {
			log(`Notifying ${pending.length} listener${pending.length !== 1 ? 's' : ''}`);

			for (const [ filterHash, handlers ] of pending) {
				delete this.pending[filterHash];
				for (const [ handler, { args, filter, value } ] of handlers) {
					handler(value !== undefined ? value : this.get(filter), ...args);
				}
				handlers.clear();
			}
		}
	}

	/**
	 * Increments the pause counter.
	 *
	 * @access private
	 */
	_pause() {
		this.paused++;
	}

	/**
	 * Removes the last element from a array type config value.
	 *
	 * @param {String|Array.<String>} [key] - The config key.
	 * @param {String|Symbol} [id] - The id for a specific layer to save. If not specified, then it
	 * uses the config's default layer.
	 * @returns {*}
	 * @access public
	 */
	pop(key, id) {
		return this._mutate({ id, key, action: 'pop' });
	}

	/**
	 * Adds an item to the end of an array type config value.
	 *
	 * @param {String|Array.<String>} key - The config key.
	 * @param {*} value - The value to add.
	 * @param {String|Symbol} [id] - The id for a specific layer to save. If not specified, then it
	 * uses the config's default layer.
	 * @returns {*}
	 * @access public
	 */
	push(key, value, id) {
		this._mutate({ id, key, action: 'push', value });
		return this;
	}

	/**
	 * Resolves a destination layer id based on tags extracted from the config filename. If a
	 * config doesn't care about tags, it can simply return the default config layer id. Custom
	 * config implementations are encouraged to override this method.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {String} [opts.action] - The action being performed.
	 * @param {Array.<String>} [opts.tags] - A list of tags parsed from the filename.
	 * @returns {String|Symbol|Array.<String|Symbol>}
	 * @access public
	 */
	resolve() {
		return Config.Base;
	}

	/**
	 * ?
	 *
	 * @access private
	 */
	_resume() {
		this.paused = Math.max(0, this.paused - 1);
		if (!this.paused) {
			this._notify();
		}
	}

	/**
	 * Saves a specific layer's store to disk.
	 *
	 * @param {Object|String} optsOrFile - Various options or a file path.
	 * @param {String} [optsOrFile.file] - The file to write the layers store to. Defaults to the file
	 * loaded into the layer. If there is no filename, an error is thrown.
	 * @param {String|Symbol} [optsOrFile.id] - The id for a specific layer to save. If not specified,
	 * then it uses the config's default layer.
	 * @returns {Config}
	 * @access public
	 */
	save(optsOrFile) {
		let file;
		let id;

		if (optsOrFile) {
			if (typeof optsOrFile === 'object') {
				({ file, id } = optsOrFile);
			} else if (typeof optsOrFile === 'string') {
				file = optsOrFile;
			}
		}

		for (const _id of unique(id || this.resolve({ action: 'save' }))) {
			const layer = this.layers.get(_id);
			if (!layer) {
				throw new Error(`Layer "${String(id)}" not found`);
			}
			layer.save(file);
		}
		return this;
	}

	/**
	 * Sets the value for a given config key.
	 *
	 * @param {String|Array.<String>} key - The key to set.
	 * @param {*} value - The value to set.
	 * @param {String|Symbol} [id] - The id for a specific layer to save. If not specified, then it
	 * uses the config's default layer.
	 * @return {Config}
	 * @access public
	 */
	set(key, value, id) {
		return this._mutate({ id, key, action: 'set', value });
	}

	/**
	 * Removes the first element from a array type config value.
	 *
	 * @param {String|Array.<String>} [key] - The config key.
	 * @param {String|Symbol} [id] - The id for a specific layer. If not specified, then it uses
	 * the config's default layer.
	 * @returns {*}
	 * @access public
	 */
	shift(key, id) {
		return this._mutate({ id, key, action: 'shift' });
	}

	/**
	 * Returns a string prepresentation of the configuration.
	 *
	 * @param {Number} [indentation=2] The number of spaces to indent the JSON formatted output.
	 * @returns {String}
	 * @access public
	 */
	toString(indentation) {
		return this.layers.toString(indentation);
	}

	/**
	 * Unloads a layer and its store by id. If the id does not exist, nothing happens.
	 *
	 * @param {String} id - The id name to unload.
	 * @returns {Boolean} Returns `true` if the id exists and was unloaded.
	 * @access public
	 */
	unload(id) {
		if (!id) {
			throw new TypeError('Missing required layer id to unload');
		}

		const layer = this.layers.get(id);
		if (!layer) {
			throw new Error(`Layer "${String(id)}" not found`);
		}

		return this.layers.remove(id);
	}

	/**
	 * Adds an item to the beginning of an array type config value.
	 *
	 * @param {String|Array.<String>} key - The config key.
	 * @param {*} value - The value to add.
	 * @param {String|Symbol} [id] - The id for a specific layer. If not specified, then it uses
	 * the config's default layer.
	 * @returns {Config}
	 * @access public
	 */
	unshift(key, value, id) {
		this._mutate({ id, key, action: 'unshift', value });
		return this;
	}

	/**
	 * Removes a watch handler.
	 *
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {Config}
	 * @access public
	 */
	unwatch(handler) {
		if (typeof handler !== 'function') {
			throw new TypeError('Expected handler to be a function');
		}

		const handlers = this.watcherMap.get(handler);
		if (handlers) {
			for (const desc of handlers) {
				this.layers.unwatch(desc.wrapped);
			}
			this.watcherMap.delete(handler);
		}
		return this;
	}

	/**
	 * Registers a watch handler.
	 *
	 * @param {String|Array.<String>} [filter] - A property name or array of nested properties to
	 * watch.
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @returns {Config}
	 * @access public
	 */
	watch(filter, handler) {
		if (typeof filter === 'function') {
			handler = filter;
			filter = undefined;
		}

		if (typeof handler !== 'function') {
			throw new TypeError('Expected handler to be a function');
		}

		filter = splitKey(filter);
		let handlers = this.watcherMap.get(handler);
		let desc = handlers?.find(desc => !(desc.filter < filter || desc.filter > filter));

		// check if this handler is already registered
		if (desc) {
			return this;
		}

		if (!handlers) {
			this.watcherMap.set(handler, handlers = []);
		}

		desc = {
			filter,
			wrapped: (...args) => {
				const filterHash = hashValue(filter);

				if (!this.pending[filterHash]) {
					this.pending[filterHash] = new Map();
				}
				this.pending[filterHash].set(handler, { args, filter });

				if (!this.paused) {
					this._notify();
				}
			}
		};

		handlers.push(desc);
		this.layers.watch(filter, desc.wrapped);
		return this;
	}
}
