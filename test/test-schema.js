import Config, { Joi } from '../dist/index';
import path from 'path';

describe('Schema', () => {
	after(() => {
		delete process.env.TEST_FOO;
		delete process.env.TEST_BOOL_FALSE;
	});

	it('should error if schema is invalid', () => {
		expect(() => {
			new Config({ schema: 'foo' });
		}).to.throw(Error, 'File not found: foo');

		expect(() => {
			new Config({ schema: 123 });
		}).to.throw(TypeError, 'Expected schema to be an object or file');
	});

	it('should error if schema is not a Joi object', () => {
		expect(() => {
			new Config({
				schema: Joi.string()
			});
		}).to.throw(TypeError, 'Expected schema root to be an object');
	});

	it('should initialize default value from schema', () => {
		const cfg = new Config({
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

	it('should initialize value from environment variable', () => {
		process.env.TEST_FOO = 'BAR';
		process.env.TEST_BOOL_FALSE = 'false';

		const cfg = new Config({
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

	it('should fallback if environment variable can\'t be validated', () => {
		process.env.TEST_FOO = '123';
		let cfg = new Config({
			schema: Joi.object({
				count: Joi.number()
					.meta({ env: 'TEST_FOO' })
			})
		});
		expect(cfg.get('count')).to.equal(123);

		process.env.TEST_FOO = 'BAR';
		cfg = new Config({
			schema: Joi.object({
				count: Joi.number()
					.meta({ env: 'TEST_FOO' })
			})
		});
		expect(cfg.get('count')).to.equal('BAR');
	});

	it('should error loading an unsupported schema file type', () => {
		expect(() => {
			new Config({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad.txt')
			});
		}).to.throw(Error, 'Unsupported schema file type: .txt');
	});

	it('should load a schema .json file', () => {
		new Config({
			schema: path.join(__dirname, 'fixtures', 'schema', 'good.json')
		});
	});

	it('should load a schema .json file with a namespace', () => {
		const cfg = new Config();
		cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
			namespace: 'test',
			schema: path.join(__dirname, 'fixtures', 'schema', 'good.json')
		});
	});

	it('should error manually loading schema', () => {
		expect(() => {
			const cfg = new Config();
			cfg.layers.get(Config.Base).loadSchema();
		}).to.throw(TypeError, 'Expected schema to be an object or file');
	});

	it('should error loading schema .json file with non-object', () => {
		expect(() => {
			new Config({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad1.json')
			});
		}).to.throw(TypeError, 'Expected schema to be an object or file');
	});

	it('should error loading schema .json file with invalid syntax', () => {
		const schema = path.join(__dirname, 'fixtures', 'schema', 'bad2.json');
		expect(() => {
			new Config({
				schema
			});
		}).to.throw(Error, `Failed to parse schema json file: ${schema}: Unexpected token { in JSON at position 1`);
	});

	it('should load a schema .js file', () => {
		new Config({
			schema: path.join(__dirname, 'fixtures', 'schema', 'good.js')
		});
	});

	it('should load a schema .js file with a namespace', () => {
		const cfg = new Config();
		cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
			namespace: 'test',
			schema: path.join(__dirname, 'fixtures', 'schema', 'good-fn.js')
		});
	});

	it('should load a schema .js file with a namespace that is already defined', () => {
		const cfg = new Config();
		cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
			namespace: 'test',
			schema: path.join(__dirname, 'fixtures', 'schema', 'good-fn-ns.js')
		});
	});

	it('should load a schema .js file with function', () => {
		new Config({
			schema: path.join(__dirname, 'fixtures', 'schema', 'good-fn.js')
		});
	});

	it('should error loading schema .js file with non-object', () => {
		expect(() => {
			new Config({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad1.js')
			});
		}).to.throw(TypeError, 'Expected schema to be an object or file');
	});

	it('should error loading schema .js file with invalid syntax', () => {
		expect(() => {
			new Config({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad2.js')
			});
		}).to.throw(Error, /^Failed to parse schema js file/);
	});

	it('should error loading schema .js file function returning non-object', () => {
		expect(() => {
			new Config({
				schema: path.join(__dirname, 'fixtures', 'schema', 'bad3.js')
			});
		}).to.throw(TypeError, 'Expected schema to be an object or file');
	});

	it('should validate change', () => {
		const cfg = new Config({
			schema: Joi.object({
				a: Joi.string().valid('foo'),
				b: Joi.number().min(10).max(20),
				c: Joi.object(),
				d: Joi.array().items(Joi.string()),
				e: Joi.array().items(Joi.string())
			})
		});

		expect(cfg.get('a')).to.equal(undefined);
		cfg.set('a', 'foo');
		expect(cfg.get('a')).to.equal('foo');
		expect(() => {
			cfg.set('a', 'bar');
		}).to.throw(Error, 'Failed to set config value: "value" must be [foo]');

		expect(cfg.get('b')).to.equal(undefined);
		cfg.set('b', 12);
		expect(cfg.get('b')).to.equal(12);
		expect(() => {
			cfg.set('b', 1);
		}).to.throw(Error, 'Failed to set config value: "value" must be larger than or equal to 10');
		expect(() => {
			cfg.set('b', 21);
		}).to.throw(Error, 'Failed to set config value: "value" must be less than or equal to 20');
		expect(() => {
			cfg.set('b', 'bar');
		}).to.throw(Error, 'Failed to set config value: "value" must be a number');

		expect(() => {
			cfg.set('c', 'bar');
		}).to.throw(Error, 'Failed to set config value: "value" must be of type object');
		cfg.set('c', { wiz: 'pow' });

		expect(() => {
			cfg.set('d', 'bar');
		}).to.throw(Error, 'Failed to set config value: "value" must be an array');

		expect(() => {
			cfg.set('d', [ 123 ]);
		}).to.throw(Error, 'Failed to set config value: "[0]" must be a string');
		cfg.set('d', [ 'bar' ]);

		expect(() => {
			cfg.push('e', 123);
		}).to.throw(Error, 'Failed to push config value: "[0]" must be a string');
		cfg.push('e', 'a');
		cfg.push('e', 'b');
		expect(cfg.get('e')).to.deep.equal([ 'a', 'b' ]);
		cfg.pop('e');
		expect(cfg.get('e')).to.deep.equal([ 'a' ]);
		cfg.unshift('e', 'c');
		expect(cfg.get('e')).to.deep.equal([ 'c', 'a' ]);
		cfg.shift('e');
		expect(cfg.get('e')).to.deep.equal([ 'a' ]);
	});

	it('should error when changing readonly property', () => {
		const cfg = new Config({
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
							d: Joi.object().meta({ readonly: true })
						}),
						Joi.number()
					),
				d: Joi.string().meta({ readonly: true }),
				e: Joi.number().meta({ readonly: true })
			})
		});

		expect(() => {
			cfg.set('a', 1);
		}).to.throw(Error, 'Not allowed to set read-only property');

		expect(() => {
			cfg.delete('a');
		}).to.throw(Error, 'Not allowed to delete read-only property');

		expect(() => {
			cfg.set('a.b', 2);
		}).to.throw(Error, 'Not allowed to set read-only property');

		// change parent with readonly descendent is ok
		cfg.set('c', 3);

		// readonly string
		expect(() => {
			cfg.set('d', 4);
		}).to.throw(Error, 'Not allowed to set read-only property');

		// readonly number
		expect(() => {
			cfg.set('e', 'not a number');
		}).to.throw(Error, 'Not allowed to set read-only property');
	});

	it('should validate a file when loading', () => {
		const cfg = new Config({
			schema: Joi.object({
				foo: Joi.string().valid('bar')
			})
		});

		cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'));
		expect(cfg.get('foo')).to.equal('bar');

		expect(() => {
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'bad-schema1.json'));
		}).to.throw(Error, 'Failed to load config file: "foo" must be [bar]');

		expect(() => {
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'bad-schema2.json'));
		}).to.throw(Error, 'Failed to load config file: "foo" must be [bar]');
	});

	it('should not force schema defaults when validating', () => {
		const cfg = new Config({
			schema: Joi.object({
				foo: Joi.string().default('bar')
			})
		});

		cfg.set('baz', 'pow', 'test');

		expect(cfg.get(null, null, 'test')).to.deep.equal({ baz: 'pow' });
	});

	it('should allow nulls', () => {
		let cfg = new Config({
			schema: Joi.object({
				foo: Joi.string()
			})
		});

		expect(() => {
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'null.json'));
		}).to.throw(Error, 'Failed to load config file: "foo" must be a string');

		cfg = new Config({
			allowNulls: true,
			schema: Joi.object({
				foo: Joi.string()
			})
		});

		cfg.load(path.join(__dirname, 'fixtures', 'json', 'null.json'));

		expect(cfg.get()).to.deep.equal({ foo: null });
	});

	it('should allow new schema to be loaded', () => {
		const cfg = new Config({
			schema: Joi.object({
				foo: Joi.string()
			})
		});

		cfg.layers.get(Config.Base).loadSchema(Joi.object({
			foo: Joi.string(),
			bar: Joi.number()
		}));
	});
});
