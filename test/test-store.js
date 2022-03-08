import { expect } from 'chai';
import { Store } from '../src/index.js';

describe('Store', () => {
	it('should error instantiating a store base class', () => {
		expect(() => {
			new Store();
		}).to.throw(TypeError, 'Cannot create instance of abstract Store class');
	});

	it('should error if options is invalid', () => {
		class MockStore extends Store {}

		expect(() => {
			new MockStore('foo');
		}).to.throw(TypeError, 'Expected store options to be an object');
	});

	it('should error when calling un-implemented store API', async () => {
		class MockStore extends Store {}
		const store = new MockStore();

		expect(() => {
			store.delete();
		}).to.throw(Error, 'delete() not implemented');

		expect(() => {
			store.get();
		}).to.throw(Error, 'get() not implemented');

		expect(() => {
			store.has();
		}).to.throw(Error, 'has() not implemented');

		await expect(
			store.load()
		).to.eventually.be.rejectedWith(Error, 'load() not implemented');

		expect(() => {
			store.merge();
		}).to.throw(Error, 'merge() not implemented');

		await expect(
			store.save()
		).to.eventually.be.rejectedWith(Error, 'save() not implemented');

		expect(() => {
			store.set();
		}).to.throw(Error, 'set() not implemented');

		expect(store.toString()).to.equal('[object Object]');

		// call noop functions to make istanbul happy
		store.watch();
		store.unwatch();
	});
});
