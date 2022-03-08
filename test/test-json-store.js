import chai from 'chai';
import Config, { JSONStore } from '../src/index.js';
import path from 'path';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { expect } from 'chai';

chai.use(sinonChai);

const __dirname = path.dirname(new URL('', import.meta.url).pathname);

describe('JSONStore', () => {
	describe('Constructor', () => {
		it('should default layer options', () => {
			const cfg = new JSONStore();
			expect(cfg.data).to.deep.equal({});
		});

		it('should error if options is not an object', () => {
			expect(() => {
				new JSONStore({ data: 'foo' });
			}).to.throw(TypeError, 'Expected config data to be an object');

			expect(() => {
				new JSONStore({ data: 123 });
			}).to.throw(TypeError, 'Expected config data to be an object');
		});
	});

	describe('load()', () => {
		it('should load a json file', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if json file does not exist', async () => {
			const cfg = await new Config().init();
			const file = path.join(__dirname, 'does_not_exist.json');
			await expect(
				cfg.load(file)
			).to.eventually.be.rejectedWith(Error, `File not found: ${file}`);
		});

		it('should error if json file is empty', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'empty.json'))
			).to.eventually.be.rejectedWith(Error, 'Failed to load config file: Unexpected end of JSON input');
		});

		it('should error if file is a directory', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'json'))
			).to.eventually.be.rejectedWith(Error, 'Unsupported file type "json"');
		});

		it('should error if file is a directory with .json extension', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'dir.json'))
			).to.eventually.be.rejectedWith(Error, /^Failed to load config file:/);
		});

		it('should error if json file is bad', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'bad-syntax.json'))
			).to.eventually.be.rejectedWith(Error, 'Failed to load config file: Unexpected end of JSON input');
		});

		it('should error if config does\'t contain an object', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'string.json'))
			).to.eventually.be.rejectedWith(TypeError, 'Expected config file to be an object');
		});

		it('should load a layer into a namespace', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), { namespace: 'baz' });
			expect(cfg.get('baz.foo')).to.deep.equal('bar');
		});
	});

	describe('get()', () => {
		it('should get a value', async () => {
			const cfg = await new Config().init({
				data: { foo: 'bar' },
				file: path.join(__dirname, 'does_not_exist.json')
			});
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should return undefined if not found', async () => {
			const cfg = await new Config().init({ data: { bar: 'wiz' } });
			expect(cfg.get('foo')).to.equal(undefined);
			expect(cfg.get('bar.baz')).to.equal(undefined);
		});

		it('should get the default value', async () => {
			const cfg = await new Config().init();
			expect(cfg.get('foo', 'bar')).to.equal('bar');
		});

		it('should initialize config and get value', async () => {
			const cfg = await new Config().init({
				data: {
					foo: 'bar'
				}
			});
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if key is invalid', async () => {
			const cfg = await new Config().init();
			expect(() => {
				cfg.get([ null ]);
			}).to.throw(Error, 'Invalid key');
		});

		it('should get nested value', async () => {
			const cfg = await new Config().init({
				data: {
					foo: {
						bar: 'baz'
					}
				}
			});
			expect(cfg.get('foo.bar')).to.equal('baz');
		});

		it('should scan all layers when no specific id is specified', async () => {
			class Foo extends Config {
				resolve() {}
			}

			const cfg = await new Foo().init();
			await cfg.layers.add({
				id: 'Baz',
				store: new JSONStore({
					data: {
						foo: 'bar'
					}
				})
			});

			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should replace nested config values', async () => {
			const cfg = await new Config().init();

			await cfg.set('appearance', 'good');
			await cfg.set('mood', 'great');
			await cfg.set('greeting', [ 'looking {{appearance}}', 'feeling {{mood}}' ]);
			await cfg.set('name', 'tester');
			await cfg.set('hi', 'hello {{name}}, {{greeting}}!');

			expect(cfg.get('hi')).to.equal('hello tester, looking good,feeling great!');
		});

		it('should error replacing non-existing nested config value', async () => {
			const cfg = await new Config().init();

			await cfg.set('hi', 'hello {{name}}');

			expect(() => {
				cfg.get('hi');
			}).to.throw(Error, 'Config key "hi" references undefined variable "name"');
		});

		it('should merge all object values', async () => {
			const cfg = await new Config().init({
				data: {
					foo: {
						pow: true,
						baz: {
							seg: 12
						}
					}
				}
			});

			await cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: {
							name: 'bar',
							baz: {
								rval: 'wiz'
							}
						}
					}
				})
			});

			await cfg.set('foo.age', 42, 'test');

			expect(cfg.get('foo')).to.deep.equal({
				name: 'bar',
				age: 42,
				pow: true,
				baz: {
					seg: 12,
					rval: 'wiz'
				}
			});
		});

		it('should stop merge objects once non-object found', async () => {
			const cfg = await new Config().init({
				data: {
					foo: {
						pow: true
					}
				}
			});

			await cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: 'bar'
					}
				})
			});

			await cfg.set('foo.age', 42, 'test');

			expect(cfg.get('foo')).to.deep.equal({
				age: 42,
				pow: true
			});
		});

		it('should get a value from a specific layer', async () => {
			const cfg = await new Config().init({
				data: {
					foo: 'bar1'
				}
			});

			await cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: 'bar3'
					}
				})
			});

			await cfg.set('foo', 'bar2', 'test');

			expect(cfg.get('foo', undefined, 'test')).to.equal('bar2');
		});

		it('should get a value from a non-existent layer', async () => {
			const cfg = await new Config().init();
			expect(() => {
				cfg.get('foo', undefined, 'test');
			}).to.throw(Error, 'Layer "test" not found');
		});
	});

	describe('has()', () => {
		it('should determine if a key is defined', async () => {
			const cfg = await new Config().init({
				data: {
					foo: {
						pow: true
					}
				}
			});

			await cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: {
							name: 'bar'
						}
					}
				})
			});

			await cfg.set('foo.age', 42, 'test');

			expect(cfg.has('bar')).to.equal(false);
			expect(cfg.has('foo.name')).to.equal(true);
			expect(cfg.has('foo.age')).to.equal(true);
			expect(cfg.has('foo.pow')).to.equal(true);
			expect(cfg.has('foo.pow.wiz')).to.equal(false);
		});

		it('should handle empty key', async () => {
			let cfg = await new Config().init();
			expect(cfg.has([])).to.equal(true);

			cfg = await new Config().init({
				data: {
					foo: {
						pow: true
					}
				}
			});
			expect(cfg.has([])).to.equal(true);
		});
	});

	describe('data()', () => {
		it('should get return a layer\'s data object', async () => {
			const data = {
				foo: {
					bar: 'baz'
				}
			};
			const cfg = await new Config().init({
				data
			});
			expect(cfg.data(Config.Base)).to.deep.equal(data);
		});

		it('should return undefined if layer is invalid', async () => {
			const cfg = await new Config().init();
			expect(cfg.data()).to.equal(undefined);
		});
	});

	describe('delete()', () => {
		it('should delete a value', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar');

			let r = cfg.delete('foo');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({});

			r = cfg.delete('foo');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({});
		});

		it('should delete a deeply nested value', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo.bar.baz', 'wiz');
			expect(cfg.get()).to.deep.equal({ foo: { bar: { baz: 'wiz' } } });

			let r = cfg.delete('foo.bar.baz');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({});

			r = cfg.delete('foo.bar.baz');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({});
		});

		it('should delete a nested object', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo.pow', 'wow');
			await cfg.set('foo.bar.baz', 'wiz');
			await cfg.set('foo.bar.baz', 'wiz', 'test');

			expect(cfg.get()).to.deep.equal({
				foo: {
					pow: 'wow',
					bar: { baz: 'wiz' }
				}
			});

			let r = cfg.delete('foo.bar');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({
				foo: {
					pow: 'wow'
				}
			});

			r = cfg.delete('foo.bar');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({
				foo: {
					pow: 'wow'
				}
			});
		});

		it('should fail to delete if layer is readonly', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar', 'test');
			cfg.layers.get('test').readonly = true;

			expect(() => {
				cfg.delete('foo', 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});

		it('should error if no key is specified', async () => {
			const cfg = await new Config().init();
			expect(() => {
				cfg.delete();
			}).to.throw(Error, 'Missing required config key');
		});
	});

	describe('set()', () => {
		it('should set a new value', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar');
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should override an existing value', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar');
			await cfg.set('foo', 'baz');
			expect(cfg.get('foo')).to.equal('baz');
		});

		it('should fail to delete if layer is readonly', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar', 'test');
			cfg.layers.get('test').readonly = true;

			await expect(
				cfg.set('foo', 'baz', 'test')
			).to.eventually.be.rejectedWith(Error, 'Layer "test" is readonly');
		});

		it('should error if no key is specified', async () => {
			const cfg = await new Config().init();
			expect(() => {
				cfg.layers.get(Config.Base).set();
			}).to.throw(Error, 'Missing required config key');
		});
	});

	describe('merge()', () => {
		it('should return immediately if source is not an object', async () => {
			const cfg = await new Config().init();
			expect(cfg.merge()).to.equal(cfg);
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {}',
				'}'
			].join('\n'));
		});

		it('should overwrite arrays', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', [ 'bar' ]);
			cfg.merge({ foo: [ 'baz' ] });
			expect(cfg.get('foo')).to.deep.equal([ 'baz' ]);
		});

		it('should mix deep objects', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', { bar: 'baz' });
			cfg.merge({ foo: { wiz: 'pow' } });
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {',
				'    "foo": {',
				'      "bar": "baz",',
				'      "wiz": "pow"',
				'    }',
				'  }',
				'}'
			].join('\n'));
		});

		it('should fail if layer is readonly', async () => {
			const cfg = await new Config().init();
			await cfg.layers.add({ id: 'test', readonly: true });
			expect(() => {
				cfg.merge({}, 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});
	});

	describe('push()', () => {
		it('should error when not given a key', async () => {
			const config = await new Config().init();
			await expect(
				config.push(123)
			).to.eventually.be.rejectedWith(TypeError, 'Expected key to be a string');

			await expect(
				config.push()
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');

			await expect(
				config.push([])
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');
		});

		it('should create an array if pre-existing value is not an array', async () => {
			const config = await new Config().init();
			await config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			await config.push('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should create an array if pre-existing value is undefined', async () => {
			const config = await new Config().init();
			expect(config.get('foo.bar')).to.equal(undefined);
			await config.push('foo.bar', 'baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should push onto an existing array', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz' ] } } });
			await config.push('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz', 'wiz' ]);
		});

		it('should not push a duplicate', async () => {
			const config = await new Config().init({ data: { foo: [ 'bar' ] } });
			await config.push('foo', 'bar');
			expect(config.get('foo')).to.deep.equal([ 'bar' ]);
			await config.push('foo', [ 'bar', 'baz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should push overwrite an existing falsey value', async () => {
			const config = await new Config().init({ data: { foo: { bar: null } } });
			await config.push('foo.bar', 'baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should combine multiple types ', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz' ] } } });
			await config.push('foo', 'wiz');
			expect(config.get('foo')).to.deep.equal([ { bar: [ 'baz' ] }, 'wiz' ]);
		});

		it('should get existing value and append', async () => {
			const config = await new Config().init({ data: { foo: 'bar' } });
			await config.push('foo', 'baz', 'test');
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});
	});

	describe('pop()', () => {
		it('should error when not given a key', async () => {
			const config = await new Config().init();
			await expect(
				config.pop(123)
			).to.eventually.be.rejectedWith(TypeError, 'Expected key to be a string');

			await expect(
				config.pop()
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');

			await expect(
				config.pop([])
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');
		});

		it('should return and remove first value of an array', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz', 'wiz' ] } } });
			await expect(config.pop('foo.bar')).to.eventually.equal('wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should return the popped value', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz' ] } } });
			await expect(config.pop('foo.bar')).to.eventually.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ ]);
		});

		it('should return undefined if array is empty', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ ] } } });
			await expect(config.pop('foo.bar')).to.eventually.equal(undefined);
		});

		it('should convert non-array to array before pop', async () => {
			const config = await new Config().init({ data: { foo: { bar: 'baz' } } });
			await expect(config.pop('foo.bar')).to.eventually.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([]);
		});
	});

	describe('shift()', () => {
		it('should error when not given a key', async () => {
			const config = await new Config().init();
			await expect(
				config.shift(123)
			).to.eventually.be.rejectedWith(TypeError, 'Expected key to be a string');

			await expect(
				config.shift()
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');

			await expect(
				config.shift([])
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');
		});

		it('should return and remove first value of an array', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz', 'wiz' ] } } });
			await expect(config.shift('foo.bar')).to.eventually.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'wiz' ]);
		});

		it('should return first value and leave empty array', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz' ] } } });
			await expect(config.shift('foo.bar')).to.eventually.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ ]);
		});

		it('should return undefined if no values in array', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ ] } } });
			await expect(config.shift('foo.bar')).to.eventually.equal(undefined);
		});

		it('should convert non-array to array before shift', async () => {
			const config = await new Config().init({ data: { foo: { bar: 'baz' } } });
			await expect(config.shift('foo.bar')).to.eventually.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([]);
		});
	});

	describe('unshift()', () => {
		it('should error when not given a key', async () => {
			const config = await new Config().init();
			await expect(
				config.unshift(123)
			).to.eventually.be.rejectedWith(TypeError, 'Expected key to be a string');

			await expect(
				config.unshift()
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');

			await expect(
				config.unshift([])
			).to.eventually.be.rejectedWith(Error, 'Missing required config key');
		});

		it('should create an array if pre-existing value is not an array', async () => {
			const config = await new Config().init();

			await config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');

			await config.unshift('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'baz', 'bar' ]);
		});

		it('should create an array if pre-existing value is undefined', async () => {
			const config = await new Config().init();

			await config.set('foo', undefined);
			expect(config.get('foo')).to.equal(undefined);

			await config.unshift('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'baz' ]);
		});

		it('should unshift onto an existing array', async () => {
			const config = await new Config().init({ data: { foo: { bar: [ 'baz' ] } } });
			await config.unshift('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'wiz', 'baz' ]);
		});

		it('should not unshift a duplicate', async () => {
			const config = await new Config().init({ data: { foo: [ 'bar' ] } });

			await config.unshift('foo', 'bar');
			expect(config.get('foo')).to.deep.equal([ 'bar' ]);

			await config.unshift('foo', [ 'bar', 'baz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);

			await config.unshift('foo', [ 'bar', 'foo', 'baz', 'wiz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'foo', 'baz', 'wiz' ]);
		});

		it('should support adding multiple values', async () => {
			const config = await new Config().init();
			await config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			await config.unshift('foo', [ 'baz', 'wiz' ]);
			expect(config.get('foo')).to.deep.equal([ 'baz', 'wiz', 'bar' ]);
		});
	});

	describe('toString()', () => {
		it('should render the config layers to a string', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar');
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});

		it('should render the config layers with custom layer to a string', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), 'good');
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {},',
				'  "good": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});

		it('should stringify the store data', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), 'good');

			expect(cfg.layers.get(Config.Base).store.toString()).to.equal('{}');

			expect(cfg.layers.get('good').store.toString(2)).to.equal([
				'{',
				'  "foo": "bar"',
				'}'
			].join('\n'));
		});
	});

	describe('watch/unwatch', () => {
		it('should call listeners when value changes and stop listening', async () => {
			let allCounter = 0;
			const allHandler = () => {
				allCounter++;
			};
			let barbazCounter = 0;
			const barbazHandler = () => {
				barbazCounter++;
			};

			const cfg = await new Config().init();

			cfg.watch(allHandler);
			cfg.watch('bar.baz', barbazHandler);
			cfg.watch('bar.baz', barbazHandler); // no op

			await cfg.layers.add('foo');

			await cfg.set('a', 'b');
			// { a: 'b' }
			expect(allCounter).to.equal(1);
			expect(barbazCounter).to.equal(0);

			await cfg.set('bar.baz.wiz', 'pow');
			// {
			//     a: 'b',
			//     bar: {
			//         baz: {
			//             wiz: 'pow'
			//         }
			//     }
			// }
			expect(allCounter).to.equal(2);
			expect(barbazCounter).to.equal(1);

			await cfg.set('c', 'd', 'test');
			expect(allCounter).to.equal(3);
			expect(barbazCounter).to.equal(1);

			await cfg.set('bar.baz.e', 'f');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(2);

			cfg.unwatch(allHandler);

			await cfg.set('g', 'h');
			await cfg.set('i', 'j', 'test');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(2);

			await cfg.set('bar.baz.k', 'l');
			await cfg.set('bar.baz.m', 'n');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(4);

			cfg.unwatch(barbazHandler);

			await cfg.set('o', 'p');
			await cfg.set('bar.baz.q', 'r');
			await cfg.set('s', 't');
			await cfg.set('bar.baz.u', 'v');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(4);
		});

		it('should watch a node that changes from an object to a non-object', async () => {
			class MyConfig extends Config {
				async init(opts) {
					await super.init(opts);

					await this.layers.add({
						id: 'user',
						store: new JSONStore()
					});

					await this.layers.add({
						id: 'blah',
						store: new JSONStore()
					});

					await this.layers.add({
						id: 'runtime',
						store: new JSONStore()
					});

					return this;
				}

				resolve() {
					return [ 'runtime', 'user' ];
				}
			}

			const cfg = await new MyConfig().init({
				data: {
					foo: {
						bar: 'baz'
					},
					fiz: {
						pow: 'wam'
					}
				}
			});

			const callback = sinon.spy();
			cfg.watch('foo', callback);
			await cfg.set('foo', 'wiz');
			expect(callback).to.have.been.calledWith('wiz');
		});
	});
});
