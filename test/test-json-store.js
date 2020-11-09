import Config, { JSONStore } from '../dist/index';
import path from 'path';

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
		it('should load a json file', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if json file does not exist', () => {
			const cfg = new Config();
			const file = path.join(__dirname, 'does_not_exist.json');
			expect(() => {
				cfg.load(file);
			}).to.throw(Error, `File not found: ${file}`);
		});

		it('should error if json file is empty', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'empty.json'));
			}).to.throw(Error, 'Failed to load config file: Unexpected end of JSON input');
		});

		it('should error if file is a directory', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'json'));
			}).to.throw(Error, 'Unsupported file type "json"');
		});

		it('should error if file is a directory with .json extension', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'dir.json'));
			}).to.throw(Error, /^Failed to load config file:/);
		});

		it('should error if json file is bad', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'bad-syntax.json'));
			}).to.throw(Error, 'Failed to load config file: Unexpected end of JSON input');
		});

		it('should error if config does\'t contain an object', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'json', 'string.json'));
			}).to.throw(TypeError, 'Expected config file to be an object');
		});

		it('should load a layer into a namespace', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), { namespace: 'baz' });
			expect(cfg.get('baz.foo')).to.deep.equal('bar');
		});
	});

	describe('get()', () => {
		it('should get a value', () => {
			const cfg = new Config({
				data: { foo: 'bar' },
				file: path.join(__dirname, 'does_not_exist.json')
			});
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should return undefined if not found', () => {
			const cfg = new Config({ data: { bar: 'wiz' } });
			expect(cfg.get('foo')).to.equal(undefined);
			expect(cfg.get('bar.baz')).to.equal(undefined);
		});

		it('should get the default value', () => {
			const cfg = new Config();
			expect(cfg.get('foo', 'bar')).to.equal('bar');
		});

		it('should initialize config and get value', () => {
			const cfg = new Config({
				data: {
					foo: 'bar'
				}
			});
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if key is invalid', () => {
			expect(() => {
				const cfg = new Config();
				cfg.get([ null ]);
			}).to.throw(Error, 'Invalid key');
		});

		it('should get nested value', () => {
			const cfg = new Config({
				data: {
					foo: {
						bar: 'baz'
					}
				}
			});
			expect(cfg.get('foo.bar')).to.equal('baz');
		});

		it('should scan all layers when no specific id is specified', () => {
			class Foo extends Config {
				resolve() {}
			}

			const cfg = new Foo();
			cfg.layers.add({
				id: 'Baz',
				store: new JSONStore({
					data: {
						foo: 'bar'
					}
				})
			});

			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should replace nested config values', () => {
			const cfg = new Config();

			cfg.set('appearance', 'good');
			cfg.set('mood', 'great');
			cfg.set('greeting', [ 'looking {{appearance}}', 'feeling {{mood}}' ]);
			cfg.set('name', 'tester');
			cfg.set('hi', 'hello {{name}}, {{greeting}}!');

			expect(cfg.get('hi')).to.equal('hello tester, looking good,feeling great!');
		});

		it('should error replacing non-existing nested config value', () => {
			const cfg = new Config();

			cfg.set('hi', 'hello {{name}}');

			expect(() => {
				cfg.get('hi');
			}).to.throw(Error, 'Config key "hi" references undefined variable "name"');
		});

		it('should merge all object values', () => {
			const cfg = new Config({
				data: {
					foo: {
						pow: true,
						baz: {
							seg: 12
						}
					}
				}
			});

			cfg.layers.add({
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

			cfg.set('foo.age', 42, 'test');

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

		it('should stop merge objects once non-object found', () => {
			const cfg = new Config({
				data: {
					foo: {
						pow: true
					}
				}
			});

			cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: 'bar'
					}
				})
			});

			cfg.set('foo.age', 42, 'test');

			expect(cfg.get('foo')).to.deep.equal({
				age: 42,
				pow: true
			});
		});

		it('should get a value from a specific layer', () => {
			const cfg = new Config({
				data: {
					foo: 'bar1'
				}
			});

			cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: 'bar3'
					}
				})
			});

			cfg.set('foo', 'bar2', 'test');

			expect(cfg.get('foo', undefined, 'test')).to.equal('bar2');
		});

		it('should get a value from a non-existent layer', () => {
			const cfg = new Config();
			expect(() => {
				cfg.get('foo', undefined, 'test');
			}).to.throw(Error, 'Layer "test" not found');
		});
	});

	describe('has()', () => {
		it('should determine if a key is defined', () => {
			const cfg = new Config({
				data: {
					foo: {
						pow: true
					}
				}
			});

			cfg.layers.add({
				id: 'test',
				store: new JSONStore({
					data: {
						foo: {
							name: 'bar'
						}
					}
				})
			});

			cfg.set('foo.age', 42, 'test');

			expect(cfg.has('bar')).to.equal(false);
			expect(cfg.has('foo.name')).to.equal(true);
			expect(cfg.has('foo.age')).to.equal(true);
			expect(cfg.has('foo.pow')).to.equal(true);
			expect(cfg.has('foo.pow.wiz')).to.equal(false);
		});
	});

	describe('data()', () => {
		it('should get return a layer\'s data object', () => {
			const data = {
				foo: {
					bar: 'baz'
				}
			};
			const cfg = new Config({
				data
			});
			expect(cfg.data(Config.Base)).to.deep.equal(data);
		});

		it('should return undefined if layer is invalid', () => {
			const cfg = new Config();
			expect(cfg.data()).to.equal(undefined);
		});
	});

	describe('delete()', () => {
		it('should delete a value', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar');

			let r = cfg.delete('foo');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({});

			r = cfg.delete('foo');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({});
		});

		it('should delete a deeply nested value', () => {
			const cfg = new Config();
			cfg.set('foo.bar.baz', 'wiz');
			expect(cfg.get()).to.deep.equal({ foo: { bar: { baz: 'wiz' } } });

			let r = cfg.delete('foo.bar.baz');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({});

			r = cfg.delete('foo.bar.baz');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({});
		});

		it('should delete a nested object', () => {
			const cfg = new Config();
			cfg.set('foo.pow', 'wow');
			cfg.set('foo.bar.baz', 'wiz');
			cfg.set('foo.bar.baz', 'wiz', 'test');

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

		it('should fail to delete if layer is readonly', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar', 'test');
			cfg.layers.get('test').readonly = true;

			expect(() => {
				cfg.delete('foo', 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});

		it('should error if no key is specified', () => {
			expect(() => {
				const cfg = new Config();
				cfg.delete();
			}).to.throw(Error, 'Missing required config key');
		});
	});

	describe('set()', () => {
		it('should set a new value', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar');
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should override an existing value', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar');
			cfg.set('foo', 'baz');
			expect(cfg.get('foo')).to.equal('baz');
		});

		it('should fail to delete if layer is readonly', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar', 'test');
			cfg.layers.get('test').readonly = true;

			expect(() => {
				cfg.set('foo', 'baz', 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});

		it('should error if no key is specified', () => {
			expect(() => {
				const cfg = new Config();
				cfg.layers.get(Config.Base).set();
			}).to.throw(Error, 'Missing required config key');
		});
	});

	describe('merge()', () => {
		it('should return immediately if source is not an object', () => {
			const cfg = new Config();
			expect(cfg.merge()).to.equal(cfg);
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {}',
				'}'
			].join('\n'));
		});

		it('should overwrite arrays', () => {
			const cfg = new Config();
			cfg.set('foo', [ 'bar' ]);
			cfg.merge({ foo: [ 'baz' ] });
			expect(cfg.get('foo')).to.deep.equal([ 'baz' ]);
		});

		it('should mix deep objects', () => {
			const cfg = new Config();
			cfg.set('foo', { bar: 'baz' });
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

		it('should fail if layer is readonly', () => {
			const cfg = new Config();
			cfg.layers.add({ id: 'test', readonly: true });
			expect(() => {
				cfg.merge({}, 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});
	});

	describe('push()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.push(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.push();
			}).to.throw(Error, 'Missing required config key');

			expect(() => {
				config.push([]);
			}).to.throw(Error, 'Missing required config key');
		});

		it('should create an array if pre-existing value is not an array', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			config.push('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should create an array if pre-existing value is undefined', () => {
			const config = new Config();
			expect(config.get('foo.bar')).to.equal(undefined);
			config.push('foo.bar', 'baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should push onto an existing array', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz' ] } } });
			config.push('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz', 'wiz' ]);
		});

		it('should not push a duplicate', () => {
			const config = new Config({ data: { foo: [ 'bar' ] } });
			config.push('foo', 'bar');
			expect(config.get('foo')).to.deep.equal([ 'bar' ]);
			config.push('foo', [ 'bar', 'baz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});

		it('should push overwrite an existing falsey value', () => {
			const config = new Config({ data: { foo: { bar: null } } });
			config.push('foo.bar', 'baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should combine multiple types ', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz' ] } } });
			config.push('foo', 'wiz');
			expect(config.get('foo')).to.deep.equal([ { bar: [ 'baz' ] }, 'wiz' ]);
		});

		it('should get existing value and append', () => {
			const config = new Config({ data: { foo: 'bar' } });
			config.push('foo', 'baz', 'test');
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);
		});
	});

	describe('pop()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.pop(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.pop();
			}).to.throw(Error, 'Missing required config key');

			expect(() => {
				config.pop([]);
			}).to.throw(Error, 'Missing required config key');
		});

		it('should return and remove first value of an array', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz', 'wiz' ] } } });
			expect(config.pop('foo.bar')).to.equal('wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'baz' ]);
		});

		it('should return the popped value', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz' ] } } });
			expect(config.pop('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ ]);
		});

		it('should return undefined if array is empty', () => {
			const config = new Config({ data: { foo: { bar: [ ] } } });
			expect(config.pop('foo.bar')).to.equal(undefined);
		});

		it('should convert non-array to array before pop', () => {
			const config = new Config({ data: { foo: { bar: 'baz' } } });
			expect(config.pop('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([]);
		});
	});

	describe('shift()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.shift(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.shift();
			}).to.throw(Error, 'Missing required config key');

			expect(() => {
				config.shift([]);
			}).to.throw(Error, 'Missing required config key');
		});

		it('should return and remove first value of an array', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz', 'wiz' ] } } });
			expect(config.shift('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ 'wiz' ]);
		});

		it('should return ', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz' ] } } });
			expect(config.shift('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([ ]);
		});

		it('should return undefined if no values in array', () => {
			const config = new Config({ data: { foo: { bar: [ ] } } });
			expect(config.shift('foo.bar')).to.equal(undefined);
		});

		it('should convert non-array to array before shift', () => {
			const config = new Config({ data: { foo: { bar: 'baz' } } });
			expect(config.shift('foo.bar')).to.equal('baz');
			expect(config.get('foo.bar')).to.deep.equal([]);
		});
	});

	describe('unshift()', () => {
		it('should error when not given a key', () => {
			const config = new Config();
			expect(() => {
				config.unshift(123);
			}).to.throw(TypeError, 'Expected key to be a string');

			expect(() => {
				config.unshift();
			}).to.throw(Error, 'Missing required config key');

			expect(() => {
				config.unshift([]);
			}).to.throw(Error, 'Missing required config key');
		});

		it('should create an array if pre-existing value is not an array', () => {
			const config = new Config();

			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');

			config.unshift('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'baz', 'bar' ]);
		});

		it('should create an array if pre-existing value is undefined', () => {
			const config = new Config();

			config.set('foo', undefined);
			expect(config.get('foo')).to.equal(undefined);

			config.unshift('foo', 'baz');
			expect(config.get('foo')).to.deep.equal([ 'baz' ]);
		});

		it('should unshift onto an existing array', () => {
			const config = new Config({ data: { foo: { bar: [ 'baz' ] } } });
			config.unshift('foo.bar', 'wiz');
			expect(config.get('foo.bar')).to.deep.equal([ 'wiz', 'baz' ]);
		});

		it('should not unshift a duplicate', () => {
			const config = new Config({ data: { foo: [ 'bar' ] } });

			config.unshift('foo', 'bar');
			expect(config.get('foo')).to.deep.equal([ 'bar' ]);

			config.unshift('foo', [ 'bar', 'baz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'baz' ]);

			config.unshift('foo', [ 'bar', 'foo', 'baz', 'wiz' ]);
			expect(config.get('foo')).to.deep.equal([ 'bar', 'foo', 'baz', 'wiz' ]);
		});

		it('should support adding multiple values', () => {
			const config = new Config();
			config.set('foo', 'bar');
			expect(config.get('foo')).to.equal('bar');
			config.unshift('foo', [ 'baz', 'wiz' ]);
			expect(config.get('foo')).to.deep.equal([ 'baz', 'wiz', 'bar' ]);
		});
	});

	describe('toString()', () => {
		it('should render the config layers to a string', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar');
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});

		it('should render the config layers with custom layer to a string', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), 'good');
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {},',
				'  "good": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});

		it('should stringify the store data', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), 'good');

			expect(cfg.layers.get(Config.Base).store.toString()).to.equal('{}');

			expect(cfg.layers.get('good').store.toString(2)).to.equal([
				'{',
				'  "foo": "bar"',
				'}'
			].join('\n'));
		});
	});

	describe('watch/unwatch', () => {
		it('should call listeners when value changes and stop listening', () => {
			let allCounter = 0;
			const allHandler = () => {
				allCounter++;
			};
			let barbazCounter = 0;
			const barbazHandler = () => {
				barbazCounter++;
			};

			const cfg = new Config();

			cfg.watch(allHandler);
			cfg.watch('bar.baz', barbazHandler);
			cfg.watch('bar.baz', barbazHandler); // no op

			cfg.layers.add('foo');

			cfg.set('a', 'b');
			// { a: 'b' }
			expect(allCounter).to.equal(1);
			expect(barbazCounter).to.equal(0);

			cfg.set('bar.baz.wiz', 'pow');
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

			cfg.set('c', 'd', 'test');
			expect(allCounter).to.equal(3);
			expect(barbazCounter).to.equal(1);

			cfg.set('bar.baz.e', 'f');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(2);

			cfg.unwatch(allHandler);

			cfg.set('g', 'h');
			cfg.set('i', 'j', 'test');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(2);

			cfg.set('bar.baz.k', 'l');
			cfg.set('bar.baz.m', 'n');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(4);

			cfg.unwatch(barbazHandler);

			cfg.set('o', 'p');
			cfg.set('bar.baz.q', 'r');
			cfg.set('s', 't');
			cfg.set('bar.baz.u', 'v');
			expect(allCounter).to.equal(4);
			expect(barbazCounter).to.equal(4);
		});

		it('should watch a node that changes from an object to a non-object', () => {
			class MyConfig extends Config {
				constructor(opts) {
					super(opts);

					this.layers.add({
						id: 'user',
						store: new JSONStore()
					});

					this.layers.add({
						id: 'blah',
						store: new JSONStore()
					});

					this.layers.add({
						id: 'runtime',
						store: new JSONStore()
					});
				}

				resolve() {
					return [ 'runtime', 'user' ];
				}
			}

			const cfg = new MyConfig({
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
			cfg.set('foo', 'wiz');
			expect(callback).to.have.been.calledWith('wiz');
		});
	});
});
