import Config, { Joi } from '../src/index.js';
import path from 'path';
import { expect } from 'chai';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('Schema', () => {
	after(() => {
		delete process.env.TEST_FOO;
		delete process.env.TEST_BOOL_FALSE;
	});

	it('should error if schema is invalid', async () => {
		await expect(
			new Config().init({ schema: 'foo' })
		).to.eventually.be.rejectedWith(Error, 'File not found: foo');

		await expect(
			new Config().init({ schema: 123 })
		).to.eventually.be.rejectedWith(TypeError, 'Expected schema to be an object or file');
	});

	it('should error if schema is not a Joi object', async () => {
		await expect(
			new Config().init({
				schema: Joi.string()
			})
		).to.eventually.be.rejectedWith(TypeError, 'Expected schema root to be an object');
	});

	it('should initialize default value from schema', async () => {
		const cfg = await new Config().init({
			schema: Joi.object({
				foo: Joi.string().default('bar'),
				wiz: Joi.object({
					pow: Joi.number().default(123)
				})
			})
		});

		expect(cfg.get('foo')).to.equal('bar');
		expect(cfg.get('wiz.pow')).to.equal(123);
	});

	it('should initialize value from environment variable', async () => {
		process.env.TEST_FOO = 'BAR';
		process.env.TEST_BOOL_FALSE = 'false';

		const cfg = await new Config().init({
			schema: Joi.object({
				foo: Joi.string()
					.default('bar')
					.meta({ env: 'TEST_FOO' }),

				baz: Joi.object({
					enabled: Joi.boolean()
						.meta({ env: 'TEST_BOOL_FALSE' })
				})
			})
		});

		expect(cfg.get('foo')).to.equal('BAR');
		expect(cfg.get('baz.enabled')).to.equal(false);
	});

	it('should fallback if environment variable can\'t be validated', async () => {
		process.env.TEST_FOO = '123';
		let cfg = await new Config().init({
			schema: Joi.object({
				count: Joi.number()
					.meta({ env: 'TEST_FOO' })
			})
		});
		expect(cfg.get('count')).to.equal(123);

		process.env.TEST_FOO = 'BAR';
		cfg = await new Config().init({
			schema: Joi.object({
				count: Joi.number()
					.meta({ env: 'TEST_FOO' })
			})
		});
		expect(cfg.get('count')).to.equal('BAR');
	});

	it('should error loading an unsupported schema file type', async () => {
		await expect(
			new Config().init({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad.txt')
			})
		).to.eventually.be.rejectedWith(Error, 'Unsupported schema file type: .txt');
	});

	it('should load a schema .json file', async () => {
		await new Config().init({
			schema: path.join(__dirname, 'fixtures', 'schema', 'good.json')
		});
	});

	it('should load a schema .json file with a namespace', async () => {
		const cfg = await new Config().init();
		await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
			namespace: 'test',
			schema: path.join(__dirname, 'fixtures', 'schema', 'good.json')
		});

		expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });
		cfg.merge({ baz: 'wiz' });
		expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });

		cfg.merge({ test: { baz: 'wiz' } });
		expect(cfg.get()).to.deep.equal({ test: { foo: 'bar', baz: 'wiz' } });
	});

	it('should error manually loading schema', async () => {
		const cfg = await new Config().init();
		await expect(
			cfg.layers.get(Config.Base).loadSchema()
		).to.eventually.be.rejectedWith(TypeError, 'Expected schema to be an object or file');
	});

	it('should error loading schema .json file with non-object', async () => {
		await expect(
			new Config().init({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad1.json')
			})
		).to.eventually.be.rejectedWith(TypeError, 'Expected schema to be an object or file');
	});

	it('should error loading schema .json file with invalid syntax', async () => {
		const schema = path.join(__dirname, 'fixtures', 'schema', 'bad2.json');
		await expect(
			new Config().init({
				schema
			})
		).to.eventually.be.rejectedWith(Error, `Failed to parse schema json file: ${schema}: Unexpected token { in JSON at position 1`);
	});

	it('should load a schema .js file', async () => {
		await new Config().init({
			schema: path.join(__dirname, 'fixtures', 'schema', 'good.js')
		});
	});

	it('should load a schema .js file with a namespace', async () => {
		const cfg = await new Config().init();
		await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
			namespace: 'test',
			schema: path.join(__dirname, 'fixtures', 'schema', 'good-fn.js')
		});
	});

	it('should load a schema .js file with a namespace that is already defined', async () => {
		const cfg = await new Config().init();
		await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
			namespace: 'test',
			schema: path.join(__dirname, 'fixtures', 'schema', 'good-fn-ns.js')
		});
	});

	it('should load a schema .js file with function', async () => {
		await new Config().init({
			schema: path.join(__dirname, 'fixtures', 'schema', 'good-fn.js')
		});
	});

	it('should error loading schema .js file with non-object', async () => {
		await expect(
			new Config().init({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad1.js')
			})
		).to.eventually.be.rejectedWith(TypeError, 'Expected schema to be an object or file');
	});

	it('should error loading schema .js file with invalid syntax', async () => {
		await expect(
			new Config().init({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad2.js')
			})
		).to.eventually.be.rejectedWith(Error, /^Failed to parse schema js file/);
	});

	it('should error loading schema .js file function returning non-object', async () => {
		expect(
			new Config().init({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad3.js')
			})
		).to.eventually.be.rejectedWith(TypeError, 'Expected schema to be an object or file');
	});

	it('should validate change', async () => {
		const cfg = await new Config().init({
			schema: Joi.object({
				a: Joi.string().valid('foo'),
				b: Joi.number().min(10).max(20),
				c: Joi.object(),
				d: Joi.array().items(Joi.string()),
				e: Joi.array().items(Joi.string())
			})
		});

		expect(cfg.get('a')).to.equal(undefined);
		await cfg.set('a', 'foo');
		expect(cfg.get('a')).to.equal('foo');
		await expect(
			cfg.set('a', 'bar')
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "value" must be [foo]');

		expect(cfg.get('b')).to.equal(undefined);
		await cfg.set('b', 12);
		expect(cfg.get('b')).to.equal(12);
		expect(
			cfg.set('b', 1)
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "value" must be greater than or equal to 10');
		await expect(
			cfg.set('b', 21)
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "value" must be less than or equal to 20');
		await expect(
			cfg.set('b', 'bar')
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "value" must be a number');

		await expect(
			cfg.set('c', 'bar')
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "value" must be of type object');
		await cfg.set('c', { wiz: 'pow' });

		await expect(
			cfg.set('d', 'bar')
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "value" must be an array');

		await expect(
			cfg.set('d', [ 123 ])
		).to.eventually.be.rejectedWith(Error, 'Failed to set config value: "[0]" must be a string');
		await cfg.set('d', [ 'bar' ]);

		await expect(
			cfg.push('e', 123)
		).to.eventually.be.rejectedWith(Error, 'Failed to push config value: "[0]" must be a string');
		await cfg.push('e', 'a');
		await cfg.push('e', 'b');
		expect(cfg.get('e')).to.deep.equal([ 'a', 'b' ]);
		await cfg.pop('e');
		expect(cfg.get('e')).to.deep.equal([ 'a' ]);
		await cfg.unshift('e', 'c');
		expect(cfg.get('e')).to.deep.equal([ 'c', 'a' ]);
		await cfg.shift('e');
		expect(cfg.get('e')).to.deep.equal([ 'a' ]);
	});

	it('should error when changing readonly property', async () => {
		const cfg = await new Config().init({
			data: {
				a: {
					b: 'foo'
				},
				c: {
					d: 'bar'
				}
			},
			schema: Joi.object({
				a: Joi.object().meta({ readonly: true }),
				c: Joi.alternatives()
					.try(
						Joi.object({
							d: Joi.string().meta({ readonly: true })
						}),
						Joi.number()
					),
				d: Joi.string().meta({ readonly: true }),
				e: Joi.number().meta({ readonly: true })
			})
		});

		await expect(
			cfg.set('a', 1)
		).to.eventually.be.rejectedWith(Error, 'Not allowed to set read-only property');

		expect(() => {
			cfg.delete('a');
		}).to.throw(Error, 'Not allowed to delete read-only property');

		await expect(
			cfg.set('a.b', 2)
		).to.eventually.be.rejectedWith(Error, 'Not allowed to set read-only property');

		// change parent with readonly descendent is ok
		await cfg.set('c', 3);

		// readonly string
		await expect(
			cfg.set('d', 4)
		).to.eventually.be.rejectedWith(Error, 'Not allowed to set read-only property');

		// readonly number
		await expect(
			cfg.set('e', 'not a number')
		).to.eventually.be.rejectedWith(Error, 'Not allowed to set read-only property');
	});

	it('should validate a file when loading', async () => {
		const cfg = await new Config().init({
			schema: Joi.object({
				foo: Joi.string().valid('bar')
			})
		});

		await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'));
		expect(cfg.get('foo')).to.equal('bar');

		await expect(
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'bad-schema1.json'))
		).to.eventually.be.rejectedWith(Error, 'Failed to load config file: "foo" must be [bar]');

		await expect(
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'bad-schema2.json'))
		).to.eventually.be.rejectedWith(Error, 'Failed to load config file: "foo" must be [bar]');
	});

	it('should not force schema defaults when validating', async () => {
		const cfg = await new Config().init({
			schema: Joi.object({
				foo: Joi.string().default('bar')
			})
		});

		await cfg.set('baz', 'pow', 'test');

		expect(cfg.get(null, null, 'test')).to.deep.equal({ baz: 'pow' });
	});

	it('should allow nulls', async () => {
		let cfg = await new Config().init({
			schema: Joi.object({
				foo: Joi.string()
			})
		});

		await expect(
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'null.json'))
		).to.eventually.be.rejectedWith(Error, 'Failed to load config file: "foo" must be a string');

		cfg = await new Config().init({
			allowNulls: true,
			schema: Joi.object({
				foo: Joi.string()
			})
		});

		await cfg.load(path.join(__dirname, 'fixtures', 'json', 'null.json'));

		expect(cfg.get()).to.deep.equal({ foo: null });
	});

	it('should allow new schema to be loaded', async () => {
		const cfg = await new Config().init({
			schema: Joi.object({
				foo: Joi.string()
			})
		});

		await cfg.layers.get(Config.Base).loadSchema(Joi.object({
			foo: Joi.string(),
			bar: Joi.number()
		}));
	});
});
