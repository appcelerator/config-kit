import Config, { JSStore } from '../dist/index';
import path from 'path';

describe('JSStore', () => {
	describe('Constructor', () => {
		it('should default layer options', () => {
			const cfg = new JSStore();
			expect(cfg.data).to.deep.equal({});
		});

		it('should error if options is not an object', () => {
			expect(() => {
				new JSStore({ data: 'foo' });
			}).to.throw(TypeError, 'Expected config data to be an object');

			expect(() => {
				new JSStore({ data: 123 });
			}).to.throw(TypeError, 'Expected config data to be an object');
		});
	});

	describe('load()', () => {
		it('should load a js file', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if js file does not exist', () => {
			const cfg = new Config();
			const file = path.join(__dirname, 'does_not_exist.js');
			expect(() => {
				cfg.load(file);
			}).to.throw(Error, `File not found: ${file}`);
		});

		it('should error if js file is empty', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'empty.js'));
		});

		it('should error if js file is bad', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'js', 'bad-syntax.js'));
			}).to.throw(Error, /Unexpected end of input/);
		});

		it('should error if config does\'t contain an object', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'fixtures', 'js', 'string.js'));
			}).to.throw(TypeError, 'Expected config file to be an object');
		});

		it('should load a babel transpiled js file', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'transpiled.js'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should load a babel transpiled js file with default export', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'transpiled-default.js'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should load a js file that exports a function', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'good-fn.js'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should load a layer into a namespace', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'), { namespace: 'baz' });
			expect(cfg.get('baz.foo')).to.deep.equal('bar');
		});
	});

	describe('get()', () => {
		it('should get a undefined value', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});
			expect(cfg.get('foo', 'bar')).to.equal('bar');
		});

		it('should get the default value', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});
			expect(cfg.get('foo', 'bar')).to.equal('bar');
		});

		it('should initialize config and get value', () => {
			const cfg = new Config({
				store: new JSStore({
					data: {
						foo: 'bar'
					}
				})
			});
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if key is invalid', () => {
			expect(() => {
				const cfg = new Config({ store: JSStore });
				cfg.get([ null ]);
			}).to.throw(Error, 'Invalid key');
		});

		it('should get nested value', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: {
							bar: 'baz'
						}
					}
				})
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
				store: new JSStore({
					data: {
						foo: 'bar'
					}
				})
			});

			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should replace nested config values', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});

			cfg.set('appearance', 'good');
			cfg.set('mood', 'great');
			cfg.set('greeting', [ 'looking {{appearance}}', 'feeling {{mood}}' ]);
			cfg.set('name', 'tester');
			cfg.set('hi', 'hello {{name}}, {{greeting}}!');

			expect(cfg.get('hi')).to.equal('hello tester, looking good,feeling great!');
		});

		it('should error replacing non-existing nested config value', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});

			cfg.set('hi', 'hello {{name}}');

			expect(() => {
				cfg.get('hi');
			}).to.throw(Error, 'Config key "hi" references undefined variable "name"');
		});

		it('should merge all object values', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: {
							pow: true
						}
					}
				})
			});

			cfg.layers.add({
				id: 'test',
				store: new JSStore({
					data: {
						foo: {
							name: 'bar'
						}
					}
				})
			});

			cfg.set('foo.age', 42, 'test');

			expect(cfg.get('foo')).to.deep.equal({
				name: 'bar',
				age: 42,
				pow: true
			});
		});

		it('should stopping merge objects once non-object found', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: {
							pow: true
						}
					}
				})
			});

			cfg.layers.add({
				id: 'test',
				store: new JSStore({
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
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: 'bar1'
					}
				})
			});

			cfg.layers.add({
				id: 'test',
				store: new JSStore({
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
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});

			expect(() => {
				cfg.get('foo', undefined, 'test');
			}).to.throw(Error, 'Layer "test" not found');
		});
	});

	describe('has()', () => {
		it('should determine if a key is defined', () => {
			const cfg = new Config();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: {
							pow: true
						}
					}
				})
			});

			cfg.layers.add({
				id: 'test',
				store: new JSStore({
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
		});
	});

	describe('delete()', () => {
		it('should delete a value', () => {
			const cfg = new Config({ store: JSStore });
			cfg.set('foo', 'bar');

			let r = cfg.delete('foo');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({});

			r = cfg.delete('foo');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({});
		});

		it('should delete a deeply nested value', () => {
			const cfg = new Config({ store: JSStore });
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
			const cfg = new Config({ store: JSStore });
			cfg.set('foo.pow', 'wow');
			cfg.set('foo.bar.baz', 'wiz');

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
			cfg.layers.add({ id: 'test', store: JSStore });
			cfg.set('foo', 'bar', 'test');

			const layer = cfg.layers.get('test');
			layer.readonly = true;

			expect(() => {
				cfg.delete('foo', 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});
	});

	describe('set()', () => {
		it('should set a new value', () => {
			const cfg = new Config({ store: JSStore });
			cfg.set('foo', 'bar');
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should override an existing value', () => {
			const cfg = new Config({ store: JSStore });
			cfg.set('foo', 'bar');
			cfg.set('foo', 'baz');
			expect(cfg.get('foo')).to.equal('baz');
		});
	});

	describe('toString()', () => {
		it('should render the config layers to a string', () => {
			const cfg = new Config();
			cfg.set('foo', 'bar', { id: 'test', store: JSStore });
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {},',
				'  "test": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});

		it('should render the config layers with custom layer to a string', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'), 'good');
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {},',
				'  "good": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});
	});

	describe('save()', () => {
		it('should error trying to save a .js config', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'));

			expect(() => {
				cfg.save();
			}).to.throw(Error, 'Saving JavaScript config files is unsupported');
		});
	});
});
