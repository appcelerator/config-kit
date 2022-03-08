import Store from './store.js';
import snooplogg from 'snooplogg';

const { log } = snooplogg('config-kit')('types');

/**
 * A registry for store type classes.
 */
export default class StoreRegistry {
	/**
	 * A map of store type extensions to the class implementations.
	 *
	 * @type {Object}
	 */
	types = {};

	/**
	 * Validates and registers a store type class by extension.
	 *
	 * @param {Store} cls - The store type class to add.
	 * @returns {TypesMap}
	 * @access public
	 */
	add(cls) {
		if (!cls || typeof cls !== 'function') {
			throw new TypeError('Expected a config type class');
		}

		if (!(cls.prototype instanceof Store)) {
			throw new TypeError('Store type must extend a Store class');
		}

		if (!cls.extension || typeof cls.extension !== 'string') {
			throw new TypeError(`Expected type "${cls.name}" to declare a non-empty string extension`);
		}

		if (this.types[cls.extension] === cls) {
			log(`Store type "${cls.name}" already registered`);
		} else {
			this.types[cls.extension] = cls;
		}

		return this;
	}

	/**
	 * Retrieves the store type class by extension. Returns `undefined` if not found.
	 *
	 * @param {String} ext - The file extension beginning with a period.
	 * @returns {Store}
	 * @access public
	 */
	get(ext) {
		return this.types[ext];
	}

	/**
	 * Unregisters a store type class by extension or class reference. Returns `true` if
	 * successful.
	 *
	 * @param {String|Store} extOrClass - The file extension beginning with a period or a reference
	 * to the store type class.
	 * @returns {Boolean}
	 * @access public
	 */
	remove(extOrClass) {
		let found = false;

		if (extOrClass && typeof extOrClass === 'string') {
			if (this.types[extOrClass]) {
				log(`Unregistering store type "${this.types[extOrClass].name}" for "${extOrClass}" files`);
				delete this.types[extOrClass];
				found = true;
			}
		} else if (typeof extOrClass === 'function' && extOrClass.prototype instanceof Store) {
			log(`Scanning store types for class "${extOrClass.name}"`);
			for (const [ ext, cls ] of Object.entries(this.types)) {
				if (cls === extOrClass) {
					log(`Unregistering store type "${cls.name}" for "${ext}" files`);
					delete this.types[ext];
					found = true;
				}
			}
		} else {
			throw new Error('Expected store type reference to be a file extension or store type class');
		}

		return found;
	}
}
