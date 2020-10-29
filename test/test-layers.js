import LayerList, { Base } from '../dist/layer-list';

describe('LayerList', () => {
	it('should remove a layer', () => {
		const list = new LayerList();
		list.add('foo');
		expect(list.remove('foo')).to.equal(true);
		expect(list.remove('foo')).to.equal(false);
	});

	it('should error if layer being added is invalid', () => {
		const list = new LayerList();

		expect(() => {
			list.add();
		}).to.throw(TypeError, 'Expected layer to be an object');

		expect(() => {
			list.add(123);
		}).to.throw(TypeError, 'Expected layer to be an object');

		expect(() => {
			list.add([]);
		}).to.throw(TypeError, 'Expected layer to be an object');
	});

	it('should error when adding a layer without an id', () => {
		const list = new LayerList();

		expect(() => {
			list.add({});
		}).to.throw(Error, 'Expected layer to have an id');

		expect(() => {
			list.add({ id: null });
		}).to.throw(Error, 'Expected layer to have an id');

		expect(() => {
			list.add({ id: '' });
		}).to.throw(Error, 'Expected layer to have an id');
	});

	it('should loop over layer list', () => {
		const list = new LayerList();
		list.add('a');
		list.add('b');
		list.add('c');

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

	it('should error if validator is not a function', () => {
		const list = new LayerList();
		const layer = list.add('foo');

		expect(() => {
			layer.validate = 'bar';
		}).to.throw(TypeError, 'Expected validator to be a function');
	});

	it('should error if validate is not a function', () => {
		const list = new LayerList();
		expect(() => {
			list.add({ id: 'foo', validate: 'bar' });
		}).to.throw(TypeError, 'Expected validate callback to be a function');
	});

	it('should error if watch handler is not a function', () => {
		const list = new LayerList();

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

	it('should error adding a layer with invalid data', () => {
		const list = new LayerList();
		expect(() => {
			list.add({ id: 'foo', data: 'bar' });
		}).to.throw(TypeError, 'Expected layer data to be an object');
	});

	it('should render a layer to a string', () => {
		const list = new LayerList();
		const layer = list.add({ id: 'foo', data: { foo: 'bar' } });
		expect(layer.toString()).to.equal('{"foo":"bar"}');
	});
});
