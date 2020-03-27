/**
 * A node in the config tree that represents the union of a XML node and a schema node.
 */
export default class Node {
	/**
	 * The key for the internal metadata.
	 * @type {Symbol}
	 */
	static Meta = Symbol('meta');

	/**
	 * Initializes the node proxy and metadata.
	 *
	 * @param {*} value - The initial value of this node.
	 * @param {Node} [parent] - The node reference to the parent node.
	 * @access public
	 */
	constructor(value, parent) {
		const internal = {
			hash:      null,
			hashes:    null,
			listeners: null,
			parents:   new Set(),
			previous:  null,
			paused:    0,
			pending:   0,
			schema:    null,

			/**
			 * Dispatches change notifications to the listeners.
			 *
			 * @param {Node} target - The node that changed.
			 */
			notify(target) {
				// if we're paused, add this object to the list of objects that may have changed
				if (this.paused) {
					this.pending++;
					return;
				}

				// notify all of this object's listeners
				if (this.listeners) {
					for (const [ listener, filter ] of this.listeners) {
						if (filter) {
							const { found, hash, value } = filterObject(node, filter);
							const changed = (found && !this.previous) || (this.previous && hash !== this.previous.get(listener));

							if (!this.previous) {
								this.previous = new WeakMap();
							}
							this.previous.set(listener, hash);

							if (changed) {
								listener(value);
							}
						} else {
							listener(target);
						}
					}
				}

				// notify all of this object's parents
				for (const parent of this.parents) {
					parent[Node.Meta].notify(target);
				}
			},

			/**
			 * Increments the pause counter until the counter resets to zero and resumes
			 * notifications.
			 */
			pause() {
				this.paused++;
			},

			/**
			 * Recomputes the hash lookup for all properties, then recomputes this object's hash.
			 * If any properties are not already Nodes, then create them.
			 *
			 * @param {Boolean} [isCtor=false] - Indicates the rehash is being called by the
			 * constructor in which case we do not want to notify parents since the parent is
			 * likely what created this instance in the first place.
			 */
			rehash(isCtor) {
				const isArray = Array.isArray(node);
				const keys = Reflect.ownKeys(node);
				const { hash } = this;

				this.hashes = isArray ? [] : {};

				for (const key of keys) {
					if (key === Node.Meta || (isArray && key === 'length')) {
						continue;
					}

					if (node[key] && typeof node[key] === 'object') {
						if (!node[key]?.[Node.Meta]) {
							node[key] = new Node(node[key], node);
						}
						this.hashes[key] = node[key][Node.Meta].hash;
					} else {
						this.hashes[key] = hashValue(node[key]);
					}
				}

				this.hash = hashValue(isArray ? this.hashes : Object.values(this.hashes));

				if (!isCtor && hash !== this.hash) {
					for (const parent of this.parents) {
						parent[Node.Meta].rehash();
					}
				}
			},

			/**
			 * Unpauses notifications and sends out any pending notifications.
			 */
			resume() {
				this.paused = Math.max(0, this.paused - 1);
				if (this.paused === 0 && this.pending > 0) {
					this.pending = 0;
					this.notify(node);
				}
			},

			/**
			 * Removes a listener.
			 *
			 * @param {Function} [listener] - The function to call when something changes.
			 */
			unwatch(listener) {
				if (listener && typeof listener !== 'function') {
					throw new TypeError('Expected listener to be a function');
				}

				if (!this.listeners) {
					return;
				}

				if (listener) {
					this.listeners.delete(listener);
					if (this.previous) {
						this.previous.delete(listener);
					}
				} else {
					// remove all listeners
					for (const [ listener ] of this.listeners) {
						this.listeners.delete(listener);
						if (this.previous) {
							this.previous.delete(listener);
						}
					}
				}

				if (!this.listeners.size) {
					this.listeners = null;
					this.previous = null;
				}
			},

			/**
			 * Adds a listener to be called when the specified object or any of its
			 * properties/elements are changed.
			 *
			 * @param {String|Array.<String>} [filter] - A property name or array of nested
			 * properties to watch.
			 * @param {Function} listener - The function to call when something changes.
			 */
			watch(filter, listener) {
				if (typeof filter === 'function') {
					listener = filter;
					filter = null;
				}

				if (filter) {
					if (typeof filter === 'string') {
						filter = [ filter ];
					} else if (!Array.isArray(filter)) {
						throw new TypeError('Expected filter to be a string or array of strings');
					}
				}

				if (typeof listener !== 'function') {
					throw new TypeError('Expected listener to be a function');
				}

				if (!this.listeners) {
					this.listeners = new Map();
				}
				this.listeners.set(listener, filter);

				if (filter) {
					const { found, hash } = filterObject(node, filter);
					if (found) {
						if (!this.previous) {
							this.previous = new WeakMap();
						}
						this.previous.set(listener, hash);
					}
				}
			}
		};

		const node = new Proxy(value, {
			deleteProperty(target, prop) {
				let result = true;

				if (Object.prototype.hasOwnProperty.call(target, prop)) {
					// eslint-disable-next-line no-unused-expressions
					target[prop]?.[Node.Meta]?.parents.delete(node);
					result = delete target[prop];

					delete internal.hashes[prop];
					internal.hash = hashValue(Object.values(internal.hashes));

					if (result) {
						internal.notify(node);
					}
				}

				return result;
			},

			get(target, prop) {
				if (Array.isArray(target)) {
					const additive = prop === 'push' || prop === 'unshift';

					if (additive || prop === 'pop' || prop === 'shift') {
						return function (...args) {
							internal.pause();
							const result = Array.prototype[prop].apply(target, args);

							internal.rehash();
							internal.resume();

							if (!additive || args.length) {
								internal.notify(node);
							}

							return result;
						};
					}

					if (prop === 'splice') {
						return function (start, deleteCount, ...items) {
							internal.pause();

							if (start !== undefined && deleteCount === undefined) {
								deleteCount = this.length - start;
							}

							const { hash } = internal;
							const arr = Array.prototype.splice.call(target, start, deleteCount, ...items);
							for (const item of arr) {
								// eslint-disable-next-line no-unused-expressions
								item?.[Node.Meta]?.parents.delete(node);
							}

							internal.rehash();
							internal.resume();

							if (internal.hash !== hash) {
								internal.notify(node);
							}

							return arr;
						};
					}
				}

				return target[prop];
			},

			set(target, prop, value) {
				if (target === value) {
					throw new Error('Cannot set object property to itself');
				}

				let hash = null;
				const desc = Object.getOwnPropertyDescriptor(target, prop);

				if (value && typeof value === 'object' && !(value instanceof Date) && value !== process.env && value !== JSON && value !== Math) {
					if (value[Node.Meta]) {
						value[Node.Meta].parents.add(node);
					} else {
						value = new Node(value, node);
					}
					({ hash } = value[Node.Meta]);
				} else {
					hash = hashValue(value);
				}

				let changed = true;

				if (desc) {
					if (internal.hashes[prop] === hash) {
						return true;
					}

					internal.parents.delete(node);

					// if the destination property has a setter, then we can't assume we need to
					// fire a delete
					if (typeof desc.set !== 'function' && (!Array.isArray(target) || prop !== 'length')) {
						delete target[prop];
					}
				}

				target[prop] = value;

				internal.hashes[prop] = hash;
				internal.hash = hashValue(Array.isArray(target) ? internal.hashes : Object.values(internal.hashes));

				for (const parent of internal.parents) {
					parent[Node.Meta].rehash();
				}

				if (changed) {
					internal.notify(node);
				}

				return true;
			}
		});

		Object.defineProperty(node, Node.Meta, { value: internal });

		if (parent !== undefined) {
			if (!parent?.[Node.Meta]) {
				throw new TypeError('Expected parent to be a Node');
			}

			if (value === parent || value === parent[Node.Meta].value) {
				throw new Error('Parent must be not be the same as the node');
			}

			internal.parents.add(parent);
		}

		if (value && typeof value === 'object') {
			internal.rehash(true);
		}

		return node;
	}

	/**
	 * Recursively merge the value into this object.
	 *
	 * @param {Node} node - The node to pause.
	 * @param {Object} value - The value to merge.
	 * @access public
	 */
	static merge(node, value) {
		if (!node?.[Node.Meta]) {
			throw new TypeError('Expected merge destination to be a Node instance');
		}

		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new TypeError('Expected merge source to be an object');
		}

		node[Node.Meta].pause();

		(function mix(src, dest) {
			for (const key of Reflect.ownKeys(src)) {
				if (key === Node.Meta) {
					continue;
				}

				const srcValue = src[key];

				if (srcValue !== null && typeof srcValue === 'object' && !Array.isArray(srcValue)) {
					if (!dest[key]?.[Node.Meta]) {
						dest[key] = {};
					}
					mix(srcValue, dest[key]);
				} else if (Array.isArray(dest[key]) && Array.isArray(srcValue)) {
					// overwrite destination with new values
					dest[key].splice(0, dest[key].length, ...srcValue);
				} else {
					dest[key] = srcValue;
				}
			}
		}(value, node));

		node[Node.Meta].resume();
	}

	/**
	 * Pauses all change notifications until resumed.
	 *
	 * @param {Node} node - The node to pause.
	 * @returns {Boolean} Returns `true` if it was already paused.
	 * @access public
	 */
	static pause(node) {
		return node[Node.Meta].pause();
	}

	/**
	 * Unpauses notifications and sends out any pending notifications.
	 *
	 * @param {Node} node - The node to resume.
	 * @access public
	 */
	static resume(node) {
		node[Node.Meta].resume();
	}

	/**
	 * Removes a listener.
	 *
	 * @param {Node} node - The node to unwatch.
	 * @param {Function} [listener] - The function to call when something changes.
	 * @access public
	 */
	static unwatch(node, listener) {
		node[Node.Meta].unwatch(listener);
	}

	/**
	 * Adds a listener to be called when the specified object or any of its properties/elements are
	 * changed.
	 *
	 * @param {Node} node - The node to watch.
	 * @param {String|Array.<String>} [filter] - A property name or array of nested properties to
	 * watch.
	 * @param {Function} listener - The function to call when something changes.
	 * @access public
	 */
	static watch(node, filter, listener) {
		node[Node.Meta].watch(filter, listener);
	}
}

/**
 * Filters the specified node.
 *
 * @param {Node} node - The node to filter.
 * @param {Array.<String>} filter - The filter to apply to the node.
 * @returns {Object}
 */
function filterObject(node, filter) {
	let found = true;
	let hash = null;
	let value = node;

	// find the value we're interested in
	for (let i = 0, len = filter.length; value && typeof value === 'object' && i < len; i++) {
		const key = filter[i];
		if (!Object.prototype.hasOwnProperty.call(value, key)) {
			found = false;
			value = undefined;
			break;
		}
		hash = value[Node.Meta].hashes[key];
		value = value[key];
	}

	return { found, hash, value };
}

/**
 * Hashes a value quick and dirty.
 *
 * @param {*} it - A value to hash.
 * @returns {Number}
 */
function hashValue(it) {
	const str = JSON.stringify(it) || '';
	let hash = 5381;
	let i = str.length;
	while (i) {
		hash = hash * 33 ^ str.charCodeAt(--i);
	}
	return hash >>> 0;
}
