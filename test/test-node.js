import Node from '../src/node.js';
import { expect } from 'chai';

describe('Node', () => {
	it('should create a new node as an object', () => {
		const n = new Node({});
		expect(n).to.deep.equal({});
	});

	it('should watch for changes', () => {
		const n = new Node({});
		let counter = 0;
		let r;

		n[Node.Meta].watch(() => {
			counter++;
		});

		n.foo = 'bar';
		expect(n).to.deep.equal({
			foo: 'bar'
		});
		expect(counter).to.equal(1);

		// dupe
		n.foo = 'bar';
		expect(n).to.deep.equal({
			foo: 'bar'
		});
		expect(counter).to.equal(1);

		n.baz = [ 'pow' ];
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'pow' ]
		});
		expect(counter).to.equal(2);

		n.baz.push('wiz', 'biz');
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'pow', 'wiz', 'biz' ]
		});
		expect(counter).to.equal(3);

		r = n.baz.pop();
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'pow', 'wiz' ]
		});
		expect(counter).to.equal(4);
		expect(r).to.equal('biz');

		n.baz.unshift('abc');
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'abc', 'pow', 'wiz' ]
		});
		expect(counter).to.equal(5);

		n.baz.splice(1, 1);
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'abc', 'wiz' ]
		});
		expect(counter).to.equal(6);

		r = n.baz.shift();
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'wiz' ]
		});
		expect(counter).to.equal(7);
		expect(r).to.equal('abc');

		n.baz.splice(0, 0, 'lorem', 'ipsum');
		expect(n).to.deep.equal({
			foo: 'bar',
			baz: [ 'lorem', 'ipsum', 'wiz' ]
		});
		expect(counter).to.equal(8);

		n.foo = [ 1, 2, 3, 'a', 'b', 'c', null ];
		expect(n).to.deep.equal({
			foo: [ 1, 2, 3, 'a', 'b', 'c', null ],
			baz: [ 'lorem', 'ipsum', 'wiz' ]
		});
		expect(counter).to.equal(9);

		// dupe
		n.foo = [ 1, 2, 3, 'a', 'b', 'c', null ];
		expect(n).to.deep.equal({
			foo: [ 1, 2, 3, 'a', 'b', 'c', null ],
			baz: [ 'lorem', 'ipsum', 'wiz' ]
		});
		expect(counter).to.equal(9);

		n.foo.splice(1, 1, 2);
		expect(n).to.deep.equal({
			foo: [ 1, 2, 3, 'a', 'b', 'c', null ],
			baz: [ 'lorem', 'ipsum', 'wiz' ]
		});
		expect(counter).to.equal(9);

		delete n.foo;
		expect(n).to.deep.equal({
			baz: [ 'lorem', 'ipsum', 'wiz' ]
		});
		expect(counter).to.equal(10);
	});

	it('should watch filter for changes', () => {
		const n = new Node({
			foo: [],
			bar: []
		});

		let counter = 0;
		let barCounter = 0;

		n[Node.Meta].watch(() => {
			counter++;
		});

		const barListener = () => {
			barCounter++;
		};

		n[Node.Meta].watch('bar', barListener);

		n.foo.push('a');
		expect(counter).to.equal(1);
		expect(barCounter).to.equal(0);

		n.bar.push('b');
		expect(counter).to.equal(2);
		expect(barCounter).to.equal(1);

		n.foo.splice(0, 1, 'a');
		expect(counter).to.equal(2);
		expect(barCounter).to.equal(1);

		n.bar.splice(0, 1, 'b');
		expect(counter).to.equal(2);
		expect(barCounter).to.equal(1);

		n[Node.Meta].unwatch(barListener);

		n.bar.push('c');
		expect(counter).to.equal(3);
		expect(barCounter).to.equal(1);
	});
});
