import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Config, { JSStore } from '../src/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

chai.use(chaiAsPromised);

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
		it('should load a js file', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if js file does not exist', async () => {
			const cfg = await new Config().init();
			const file = path.join(__dirname, 'does_not_exist.js');
			await expect(
				cfg.load(file)
			).to.eventually.be.rejectedWith(Error, `File not found: ${file}`);
		});

		it('should not error if js file is empty', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'empty.js'));
		});

		it('should error if js file is bad', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'js', 'bad-syntax.js'))
			).to.eventually.be.rejectedWith(Error, /Unexpected end of input/);
		});

		it('should error if config does\'t contain an object', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'js', 'string.js'))
			).to.eventually.be.rejectedWith(TypeError, 'Expected config file to be an object');
		});

		it('should load a js file that exports a function', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'good-fn.js'));
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should load a layer into a namespace', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'), { namespace: 'baz' });
			expect(cfg.get('baz.foo')).to.deep.equal('bar');
		});

		it('should load a esm js file with an import', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'import.js'));
			expect(cfg.get('foo')).to.have.lengthOf(32);
		});

		it('should error if js file contains require()', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'fixtures', 'js', 'require.js'))
			).to.eventually.be.rejectedWith(Error, /require is not defined/);
		});
	});

	describe('get()', () => {
		it('should get a undefined value', async () => {
			const cfg = await new Config().init();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});
			expect(cfg.get('foo', 'bar')).to.equal('bar');
		});

		it('should get the default value', async () => {
			const cfg = await new Config().init();
			cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});
			expect(cfg.get('foo', 'bar')).to.equal('bar');
		});

		it('should initialize config and get value', async () => {
			const cfg = await new Config().init({
				store: new JSStore({
					data: {
						foo: 'bar'
					}
				})
			});
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should error if key is invalid', async () => {
			const cfg = await new Config().init({ store: JSStore });
			expect(() => {
				cfg.get([ null ]);
			}).to.throw(Error, 'Invalid key');
		});

		it('should get nested value', async () => {
			const cfg = await new Config().init();
			await cfg.layers.set({
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

		it('should scan all layers when no specific id is specified', async () => {
			class Foo extends Config {
				resolve() {}
			}

			const cfg = await new Foo().init();
			await cfg.layers.add({
				id: 'Baz',
				store: new JSStore({
					data: {
						foo: 'bar'
					}
				})
			});

			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should replace nested config values', async () => {
			const cfg = await new Config().init();

			await cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});

			await cfg.set('appearance', 'good');
			await cfg.set('mood', 'great');
			await cfg.set('greeting', [ 'looking {{appearance}}', 'feeling {{mood}}' ]);
			await cfg.set('name', 'tester');
			await cfg.set('hi', 'hello {{name}}, {{greeting}}!');

			expect(cfg.get('hi')).to.equal('hello tester, looking good,feeling great!');
		});

		it('should error replacing non-existing nested config value', async () => {
			const cfg = await new Config().init();

			await cfg.layers.set({
				id: Config.Base,
				store: new JSStore()
			});

			await cfg.set('hi', 'hello {{name}}');

			expect(() => {
				cfg.get('hi');
			}).to.throw(Error, 'Config key "hi" references undefined variable "name"');
		});

		it('should merge all object values', async () => {
			const cfg = await new Config().init();

			await cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: {
							pow: true
						}
					}
				})
			});

			await cfg.layers.add({
				id: 'test',
				store: new JSStore({
					data: {
						foo: {
							name: 'bar'
						}
					}
				})
			});

			await cfg.set('foo.age', 42, 'test');

			expect(cfg.get('foo')).to.deep.equal({
				name: 'bar',
				age: 42,
				pow: true
			});
		});

		it('should stopping merge objects once non-object found', async () => {
			const cfg = await new Config().init();

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

			await cfg.layers.add({
				id: 'test',
				store: new JSStore({
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
			const cfg = await new Config().init();

			cfg.layers.set({
				id: Config.Base,
				store: new JSStore({
					data: {
						foo: 'bar1'
					}
				})
			});

			await cfg.layers.add({
				id: 'test',
				store: new JSStore({
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
		it('should determine if a key is defined', async () => {
			const cfg = await new Config().init();

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

			await cfg.layers.add({
				id: 'test',
				store: new JSStore({
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
		});
	});

	describe('delete()', () => {
		it('should delete a value', async () => {
			const cfg = await new Config().init({ store: JSStore });
			await cfg.set('foo', 'bar');

			let r = cfg.delete('foo');
			expect(r).to.equal(true);
			expect(cfg.get()).to.deep.equal({});

			r = cfg.delete('foo');
			expect(r).to.equal(false);
			expect(cfg.get()).to.deep.equal({});
		});

		it('should delete a deeply nested value', async () => {
			const cfg = await new Config().init({ store: JSStore });
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
			const cfg = await new Config().init({ store: JSStore });
			await cfg.set('foo.pow', 'wow');
			await cfg.set('foo.bar.baz', 'wiz');

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
			await cfg.layers.add({ id: 'test', store: JSStore });
			await cfg.set('foo', 'bar', 'test');

			const layer = cfg.layers.get('test');
			layer.readonly = true;

			expect(() => {
				cfg.delete('foo', 'test');
			}).to.throw(Error, 'Layer "test" is readonly');
		});
	});

	describe('set()', () => {
		it('should set a new value', async () => {
			const cfg = await new Config().init({ store: JSStore });
			await cfg.set('foo', 'bar');
			expect(cfg.get('foo')).to.equal('bar');
		});

		it('should override an existing value', async () => {
			const cfg = await new Config().init({ store: JSStore });
			await cfg.set('foo', 'bar');
			await cfg.set('foo', 'baz');
			expect(cfg.get('foo')).to.equal('baz');
		});
	});

	describe('toString()', () => {
		it('should render the config layers to a string', async () => {
			const cfg = await new Config().init();
			await cfg.set('foo', 'bar', { id: 'test', store: JSStore });
			expect(cfg.toString()).to.equal([
				'{',
				'  "Symbol(base)": {},',
				'  "test": {',
				'    "foo": "bar"',
				'  }',
				'}'
			].join('\n'));
		});

		it('should render the config layers with custom layer to a string', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'), 'good');
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
		it('should error trying to save a .js config', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'js', 'good.js'));

			await expect(cfg.save()).to.eventually.be.rejectedWith(Error, 'Saving JavaScript config files is unsupported');
		});
	});
});
