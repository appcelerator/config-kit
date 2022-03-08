import LayerList, { Base } from '../src/layer-list.js';
import { expect } from 'chai';

describe('LayerList', () => {
	it('should remove a layer', async () => {
		const list = await new LayerList().init();
		await list.add('foo');
		expect(list.remove('foo')).to.equal(true);
		expect(list.remove('foo')).to.equal(false);
	});

	it('should error if layer being added is invalid', async () => {
		const list = await new LayerList().init();

		await expect(
			list.add()
		).to.eventually.be.rejectedWith(TypeError, 'Expected layer to be an object');

		await expect(
			list.add(123)
		).to.eventually.be.rejectedWith(TypeError, 'Expected layer to be an object');

		await expect(
			list.add([])
		).to.eventually.be.rejectedWith(TypeError, 'Expected layer to be an object');
	});

	it('should error when adding a layer without an id', async () => {
		const list = await new LayerList().init();

		await expect(
			list.add({})
		).to.eventually.be.rejectedWith(Error, 'Expected layer to have an id');

		await expect(
			list.add({ id: null })
		).to.eventually.be.rejectedWith(Error, 'Expected layer to have an id');

		await expect(
			list.add({ id: '' })
		).to.eventually.be.rejectedWith(Error, 'Expected layer to have an id');
	});

	it('should loop over layer list', async () => {
		const list = await new LayerList().init();

		await list.add('a');
		await list.add('b');
		await list.add('c');

		let ids = [];
		for (const item of list) {
			ids.push(item.id);
		}
		expect(ids).to.deep.equal([ Base, 'a', 'b', 'c' ]);

		ids = [];
		for (const item of list.reverse) {
			ids.push(item.id);
		}
		expect(ids).to.deep.equal([ 'c', 'b', 'a', Base ]);
	});

	it('should error if validator is not a function', async () => {
		const list = await new LayerList().init();
		const layer = await list.add('foo');

		expect(() => {
			layer.validate = 'bar';
		}).to.throw(TypeError, 'Expected validator to be a function');
	});

	it('should error if validate is not a function', async () => {
		const list = await new LayerList().init();
		await expect(
			list.add({ id: 'foo', validate: 'bar' })
		).to.eventually.be.rejectedWith(TypeError, 'Expected validate callback to be a function');
	});

	it('should error if watch handler is not a function', async () => {
		const list = await new LayerList().init();

		expect(() => {
			list.watch();
		}).to.throw(TypeError, 'Expected handler to be a function');

		expect(() => {
			list.watch('foo');
		}).to.throw(TypeError, 'Expected handler to be a function');

		expect(() => {
			list.unwatch();
		}).to.throw(TypeError, 'Expected handler to be a function');

		expect(() => {
			list.unwatch('foo');
		}).to.throw(TypeError, 'Expected handler to be a function');
	});

	it('should error adding a layer with invalid data', async () => {
		const list = await new LayerList().init();
		await expect(
			list.add({ id: 'foo', data: 'bar' })
		).to.eventually.be.rejectedWith(TypeError, 'Expected layer data to be an object');
	});

	it('should render a layer to a string', async () => {
		const list = await new LayerList().init();
		const layer = await list.add({ id: 'foo', data: { foo: 'bar' } });
		expect(layer.toString()).to.equal('{"foo":"bar"}');
	});
});
