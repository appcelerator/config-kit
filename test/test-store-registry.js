import { JSONStore, Store } from '../dist/index';
import StoreRegistry from '../dist/store-registry';

describe('StoreRegistry', () => {
	it('should error if adding an invalid store class', () => {
		const reg = new StoreRegistry();

		expect(() => {
			reg.add();
		}).to.throw(TypeError, 'Expected a config type class');

		expect(() => {
			reg.add({});
		}).to.throw(TypeError, 'Expected a config type class');

		expect(() => {
			reg.add(function () {});
		}).to.throw(TypeError, 'Store type must extend a Store class');

		class NotAStore {}

		expect(() => {
			reg.add(NotAStore);
		}).to.throw(TypeError, 'Store type must extend a Store class');

		class BadStore extends Store {}

		expect(() => {
			reg.add(BadStore);
		}).to.throw(TypeError, 'Expected type "BadStore" to declare a non-empty string extension');
	});

	it('should get a store type by extension', () => {
		const reg = new StoreRegistry();
		reg.add(JSONStore);
		expect(reg.get('.json')).to.equal(JSONStore);
		expect(reg.get('.blah')).to.equal(undefined);
		expect(reg.get()).to.equal(undefined);
	});

	it('should remove a store type by extension', () => {
		const reg = new StoreRegistry();
		reg.add(JSONStore);
		expect(reg.get('.json')).to.equal(JSONStore);
		expect(reg.remove(JSONStore)).to.equal(true);
		expect(reg.get('.json')).to.equal(undefined);
		expect(reg.remove(JSONStore)).to.equal(false);
	});

	it('should remove a store type by class', () => {
		const reg = new StoreRegistry();
		reg.add(JSONStore);
		expect(reg.get('.json')).to.equal(JSONStore);
		expect(reg.remove('.json')).to.equal(true);
		expect(reg.get('.json')).to.equal(undefined);
		expect(reg.remove('.json')).to.equal(false);
	});

	it('should error if removing store type with invalid reference', () => {
		const t = new StoreRegistry();
		expect(() => {
			t.remove(function () {});
		}).to.throw(Error, 'Expected store type reference to be a file extension or store type class');
	});
});
