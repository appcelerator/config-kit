import Layer from './layer';
import snooplogg from 'snooplogg';
import { arrayify, hashValue, validate } from './util';

const { log } = snooplogg('config-kit')('layer-list');
const { highlight } = snooplogg.styles;

/**
 * A unique symbol used to query all layers.
 * @type {Symbol}
 */
export const All = Symbol('all');

/**
 * The id for the base layer.
 * @type {Symbol}
 */
export const Base = Symbol('base');

/**
 * An indexed list of elements.
 */
export default class LayerList {
	/**
	 * Forces all nodes of a schema to allow nulls.
	 * @type {Boolean}
	 */
	allowNulls = false;

	/**
	 * Allows object values to contain unknown keys.
	 * @type {Boolean}
	 */
	allowUnknown = true;

	/**
	 * The ordered list of layers.
	 * @type {Array.<Layer>}
	 */
	layers = [];

	/**
	 * A quick lookup based on id.
	 * @type {object}
	 */
	map = {};

	/**
	 * A list of all active watchers.
	 * @type {Array.<Object>}
	 */
	watchers = [];

	/**
	 * Initializes the options.
	 *
	 * @param {Object} [opts] - Various options.
	 * @param {Boolean} [opts.allowNulls] - Forces all nodes of a schema to allow nulls.
	 * @param {Boolean} [opts.allowUnknown=true] - Allows object values to contain unknown keys.
	 * @param {Object} [opts.data] - Datwa to initialize the base config layer with.
	 * @param {String} [opts.file] - The file to associate with the base layer.
	 * @param {Object} [opts.schema] - A Joi schema for the base layer.
	 * @param {Store|Function} [opts.store] - A store instance or store class to use for the base
	 * layer.
	 * @access public
	 */
	constructor(opts = {}) {
		this.allowNulls = opts.allowNulls;
		this.allowUnknown = opts.allowUnknown !== false;

		this.layers.push(this.map[Base] = new Layer({
			allowNulls: opts.allowNulls,
			data:       opts.data || {},
			file:       opts.file,
			id:         Base,
			order:      -Infinity,
			readonly:   false,
			schema:     opts.schema,
			static:     true,
			store:      opts.store,
			validate:   args => validate({
				...args,
				validateOptions: {
					allowUnknown: this.allowUnknown,
					...args.validateOptions
				}
			})
		}));
	}

	/**
	 * Adds a layer. If the layer id already exists, it will replace it.
	 *
	 * @param {Layer|Object|String} layer - The layer, layer contructor arguments, or layer id.
	 * @returns {Layer}
	 * @access public
	 */
	add(layer) {
		if (!layer) {
			throw new TypeError('Expected layer to be an object');
		}

		if (typeof layer === 'string' || typeof layer === 'symbol') {
			layer = { id: layer };
		}

		if (typeof layer !== 'object' || Array.isArray(layer)) {
			throw new TypeError('Expected layer to be an object');
		}

		const { id } = layer;

		if (!id) {
			throw new Error('Expected layer to have an id');
		}

		const existing = this.map[id];
		if (existing) {
			for (const prop of [ 'namespace', 'order', 'readonly', 'schema', 'static' ]) {
				if (!Object.prototype.hasOwnProperty.call(layer, prop)) {
					layer[prop] = existing[prop];
				}
			}
		}

		const isLayer = layer instanceof Layer;
		if (isLayer || !layer.validate) {
			layer.validate = args => {
				const schemas = new Set();
				const base = this.layers.find(layer => layer.id === Base)?.schema;
				if (base) {
					schemas.add(base);
				}
				if (args.schemas) {
					for (const schema of args.schemas) {
						schemas.add(schema);
					}
				}

				return validate({
					...args,
					schemas: Array.from(schemas),
					validateOptions: {
						allowUnknown: this.allowUnknown
					}
				});
			};
		}

		layer.allowNulls = this.allowNulls;

		if (!isLayer) {
			log(`Creating new layer: ${highlight(String(id))}`);
			layer = new Layer(layer);
		} else if (existing && Object.prototype.hasOwnProperty.call(existing, 'file')) {
			layer.file = existing.file;
		}

		this.map[id] = layer;

		if (existing) {
			const p = this.layers.findIndex(existing => existing.id === id);
			if (p !== -1) {
				this.layers.splice(p, 1);
			}
		}

		let inserted;
		for (let i = this.layers.length - 1; i >= 0; i--) {
			if (layer.order >= this.layers[i].order) {
				inserted = !!this.layers.splice(i + 1, 0, layer);
				break;
			}
		}
		if (!inserted) {
			this.layers.push(layer);
		}

		// add the watchers to this layer
		for (const { filter, handler } of this.watchers) {
			layer.watch(filter, handler);
		}

		return layer;
	}

	/**
	 * Returns a layer by id.
	 *
	 * @param {String|Symbol} id - The layer id.
	 * @returns {Layer}
	 * @access public
	 */
	get(id) {
		return this.map[id];
	}

	/**
	 * Finds all layers that match a specified ids.
	 *
	 * @param {String|Symbol|Array.<String|Symbol>} id - The layer id or ids.
	 * @param {Boolean} [reverse] - When `true`, the results are iterated in reverse order.
	 * @returns {Object}
	 * @access public
	 */
	query(id, reverse) {
		let ids = [];
		if (id === undefined || id === All) {
			ids = this.layers.map(layer => layer.id);
		} else {
			ids = arrayify(id, true).filter(id => this.map[id]);
			if (!ids.length) {
				throw new Error(`Layer "${String(id)}" not found`);
			}
		}

		if (reverse) {
			ids.reverse();
		}

		return {
			[Symbol.iterator]: () => {
				let i = 0;
				return {
					next: () => {
						const done = i >= ids.length;
						return { done, value: done ? undefined : this.map[ids[i++]] };
					}
				};
			}
		};
	}

	/**
	 * Destroys a layer by id or layer reference.
	 *
	 * @param {String|Symbol|Array.<String|Symbol>} idOrLayer - The layer id or ids.
	 * @param {Boolean} [reverse] - When `true`, the results are iterated in reverse order.
	 * @returns {Object}
	 * @access public
	 */
	remove(idOrLayer) {
		const layer = this.map[idOrLayer];
		const p = this.layers.findIndex(layer => layer === idOrLayer || layer.id === idOrLayer);
		if (layer) {
			log(`Unloading layer: ${highlight(String(idOrLayer))}`);
			this.map[idOrLayer].unload();
			delete this.map[idOrLayer];
		}
		if (p !== -1) {
			this.layers.splice(p, 1);
			return true;
		}
		return false;
	}

	/**
	 * A reverse iterator.
	 *
	 * @type {Object}
	 * @access public
	 */
	reverse = {
		[Symbol.iterator]: () => {
			let i = this.layers.length - 1;
			return {
				next: () => {
					const done = i < 0;
					return { done, value: done ? undefined : this.layers[i--] };
				}
			};
		}
	};

	/**
	 * An alias for `add()`.
	 *
	 * @param {Layer|Object|String} layer - The layer, layer contructor arguments, or layer id.
	 * @returns {Layer}
	 * @access public
	 */
	set(layer) {
		return this.add(layer);
	}

	/**
	 * A reverse iterator.
	 *
	 * @returns {Object}
	 * @access public
	 */
	[Symbol.iterator]() {
		let i = 0;
		return {
			next: () => {
				const done = i >= this.layers.length;
				return { done, value: done ? undefined : this.layers[i++] };
			}
		};
	}

	/**
	 * Returns a string prepresentation of each layer.
	 *
	 * @param {Number} [indentation=2] The number of spaces to indent the JSON formatted output.
	 * @returns {String}
	 * @access public
	 */
	toString(indentation = 2) {
		const obj = {};
		for (const layer of this.layers) {
			const cfg = layer.store.get();
			obj[String(layer.id)] = cfg === undefined ? {} : cfg;
		}
		return JSON.stringify(obj, null, Math.max(indentation, 0));
	}

	/**
	 * Removes a watch handler from all layers.
	 *
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @access public
	 */
	unwatch(handler) {
		if (!handler || typeof handler !== 'function') {
			throw new TypeError('Expected handler to be a function');
		}

		for (let i = 0; i < this.watchers.length; i++) {
			if (this.watchers[i].handler === handler) {
				this.watchers.splice(i--, 1);
			}
		}

		for (const layer of this.layers) {
			layer.unwatch(handler);
		}
	}

	/**
	 * Registers a watch handler on all layers.
	 *
	 * @param {Array.<String>} [filter] - A property name or array of nested properties to watch.
	 * @param {Function} handler - A callback to fire when a change occurs.
	 * @access public
	 */
	watch(filter, handler) {
		if (!handler || typeof handler !== 'function') {
			throw new TypeError('Expected handler to be a function');
		}

		log(`Registering watcher: ${highlight(`${handler.name}()`)} ${filter.length ? filter.join('.') : ''}`);

		this.watchers.push({ filter, filterHash: hashValue(filter), handler });

		for (const layer of this.layers) {
			layer.watch(filter, handler);
		}
	}
}
