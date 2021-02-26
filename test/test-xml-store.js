/* eslint-disable quote-props */

// import Config, { Joi } from 'config-kit';
// import fs from 'fs-extra';
// import path from 'path';
// import tmp from 'tmp';
import { XMLStore } from '../dist/index';

// const tmpDir = tmp.dirSync({
// 	mode: '755',
// 	prefix: 'config-kit-test-',
// 	unsafeCleanup: true
// }).name;

// function makeTempName() {
// 	return path.join(tmpDir, Math.random().toString(36).substring(7));
// }

// function makeTempDir() {
// 	const dir = makeTempName();
// 	fs.mkdirsSync(dir);
// 	return dir;
// }

// class XMLConfig extends Config {
// 	constructor(opts) {
// 		super(opts, { stores: XMLStore });
// 	}
// }

describe('XMLStore', () => {
	describe('Empty and error handling', () => {
		it('should initialize empty object', () => {
			const store = new XMLStore();
			expect(store.get()).to.deep.equal({});
			expect(store.toString()).to.equal('<?xml version="1.0" encoding="UTF-8"?>');
		});

		it('should error if schema is not an object', () => {
			expect(() => {
				new XMLStore({ schema: 'foo' });
			}).to.throw(TypeError, 'Expected schema to be an object');
		});

		it('should error if data is not an object', () => {
			expect(() => {
				new XMLStore({ data: 'foo' });
			}).to.throw(TypeError, 'Expected data to be an object');
		});
	});

	describe('JSON, no XML, no schema', () => {
		it('should initialize object and get property', () => {
			const store = new XMLStore({
				data: {
					foo: 'bar'
				}
			});
			expect(store.get()).to.deep.equal({ foo: 'bar' });
			expect(store.get([ 'foo' ])).to.equal('bar');
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<foo>bar</foo>'
			].join('\n'));
		});

		it('should set a new simple value', () => {
			const store = new XMLStore();
			store.set([ 'foo' ], 'bar');
			expect(store.get()).to.deep.equal({ foo: 'bar' });
			expect(store.get([ 'foo' ])).to.equal('bar');
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<foo>bar</foo>'
			].join('\n'));

			store.set([ 'pi' ], 3.14);
			expect(store.get()).to.deep.equal({ foo: 'bar', pi: 3.14 });
			expect(store.get([ 'pi' ])).to.equal(3.14);
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<foo>bar</foo>',
				'<pi>3.14</pi>'
			].join('\n'));

			store.set([ 'a', 'b', 'c' ], [ 'v1', 'v2', 'v3' ]);
			expect(store.get()).to.deep.equal({ foo: 'bar', pi: 3.14, a: { b: { c: [ 'v1', 'v2', 'v3' ] } } });
			expect(store.get([ 'a', 'b', 'c' ])).to.deep.equal([ 'v1', 'v2', 'v3' ]);
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<foo>bar</foo>',
				'<pi>3.14</pi>',
				'<a>',
				'	<b>',
				'		<c>v1</c>',
				'		<c>v2</c>',
				'		<c>v3</c>',
				'	</b>',
				'</a>'
			].join('\n'));
		});

		it('should set array of values with attributes', () => {
			const store = new XMLStore({
				data: {
					'my-app': {
						foo: [
							{ '@bar': 'alpha', '#text': true },
							{ '@bar': 'beta', '#text': true },
							{ '@bar': 'gamma', '#text': false }
						]
					}
				}
			});
			expect(store.get()).to.deep.equal({
				'my-app': {
					foo: [
						{ '@bar': 'alpha', '#text': true },
						{ '@bar': 'beta', '#text': true },
						{ '@bar': 'gamma', '#text': false }
					]
				}
			});
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<my-app>',
				'	<foo bar="alpha">true</foo>',
				'	<foo bar="beta">true</foo>',
				'	<foo bar="gamma">false</foo>',
				'</my-app>'
			].join('\n'));
		});
	});

	describe('Initialized with xml, no schema', () => {
		it('should initialize with xml', () => {
			const store = new XMLStore().loadFromString('<foo/>');
			expect(store.get()).to.deep.equal({ foo: '' });
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<foo/>'
			].join('\n'));
		});

		it('should initialize namespaced xml', () => {
			const store = new XMLStore().loadFromString([
				'<ti:app xmlns:ti="http://ti.appcelerator.org">',
				'	<foo>bar</foo>',
				'</ti:app>'
			].join('\n'));
			expect(store.get()).to.deep.equal({
				app: {
					foo: 'bar'
				}
			});
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<ti:app xmlns:ti="http://ti.appcelerator.org">',
				'	<foo>bar</foo>',
				'</ti:app>'
			].join('\n'));
		});

		it('should cast numeric value', () => {
			const store = new XMLStore().loadFromString([
				'<wiz>',
				'	<foo>123</foo>',
				'	<bar>3.14</bar>',
				'</wiz>'
			].join('\n'));
			expect(store.get()).to.deep.equal({
				wiz: {
					foo: 123,
					bar: 3.14
				}
			});
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<wiz>',
				'	<foo>123</foo>',
				'	<bar>3.14</bar>',
				'</wiz>'
			].join('\n'));
		});

		it('should handle nested object and group multiple tags into an array', () => {
			const store = new XMLStore().loadFromString([
				'<app>',
				'	<foo>',
				'		<bar>',
				'			<color>red</color>',
				'			<color>green</color>',
				'			<color>blue</color>',
				'		</bar>',
				'	</foo>',
				'</app>'
			].join('\n'));
			expect(store.get()).to.deep.equal({
				app: {
					foo: {
						bar: {
							color: [
								'red',
								'green',
								'blue'
							]
						}
					}
				}
			});
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<app>',
				'	<foo>',
				'		<bar>',
				'			<color>red</color>',
				'			<color>green</color>',
				'			<color>blue</color>',
				'		</bar>',
				'	</foo>',
				'</app>'
			].join('\n'));
		});

		it('should handle list of things with an indentifier as an attribute', () => {
			const store = new XMLStore().loadFromString([
				'<my-app>',
				'	<foo bar="alpha">true</foo>',
				'	<foo bar="beta">true</foo>',
				'	<foo bar="gamma">false</foo>',
				'</my-app>'
			].join('\n'));
			expect(store.get()).to.deep.equal({
				'my-app': {
					foo: [
						{ '@bar': 'alpha', '#text': true },
						{ '@bar': 'beta', '#text': true },
						{ '@bar': 'gamma', '#text': false }
					]
				}
			});
			expect(store.toString()).to.equal([
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<my-app>',
				'	<foo bar="alpha">true</foo>',
				'	<foo bar="beta">true</foo>',
				'	<foo bar="gamma">false</foo>',
				'</my-app>'
			].join('\n'));
		});
	});

	describe('get()', () => {
		// it('should get a string', () => {
		// 	const cfg = new XMLConfig();
		// 	cfg.load(path.join(__dirname, 'fixtures', 'good.xml'));
		// 	console.log(cfg.get());
		// 	// expect(cfg.get('string-test')).to.deep.equal({ _text: 'foo' });
		// });

		// it('should get an object without a schema', () => {
		// 	const cfg = new XMLConfig();
		// 	cfg.load(path.join(__dirname, 'fixtures', 'good.xml'));
		// 	expect(cfg.get()).to.deep.equal({
		// 		'string-test': {
		// 			_text: 'foo'
		// 		},
		// 		'number-test': {
		// 			_text: '123'
		// 		},
		// 		'bool-true-test': {
		// 			_text: 'true'
		// 		},
		// 		'bool-false-test': {
		// 			_text: 'false'
		// 		},
		// 		'array-test': {
		// 			'item': [
		// 				{ _text: '123' },
		// 				{ _text: 'abc' }
		// 			],
		// 			'pi': {
		// 				_text: '3.14'
		// 			}
		// 		}
		// 	});
		// });

		// it('should get an object with a schema', () => {
		// 	const cfg = new XMLConfig({
		// 		schema: Joi.object({
		// 			'string-test': Joi.string(),
		// 			'number-test': Joi.number(),
		// 			'bool-true-test': Joi.boolean(),
		// 			'bool-false-test': Joi.boolean(),
		// 			'array-test': Joi.object({
		// 				item: Joi.array().items(Joi.number(), Joi.string()),
		// 				pi: Joi.number()
		// 			})
		// 		})
		// 	});
		// 	cfg.load(path.join(__dirname, 'fixtures', 'good.xml'));
		// 	expect(cfg.get()).to.deep.equal({
		// 		'string-test': 'foo',
		// 		'number-test': 123,
		// 		'bool-true-test': true,
		// 		'bool-false-test': false,
		// 		'array-test': {
		// 			item: [ 123, 'abc' ],
		// 			pi: 3.14
		// 		}
		// 	});
		// });

		// it('should get an object with a schema and tag definitions', () => {
		// 	const cfg = new XMLConfig({
		// 		schema: Joi.object({
		// 			stringTest: Joi.string().meta({ tag: 'string-test' }),
		// 			numberTest: Joi.number().meta({ tag: 'number-test' }),
		// 			boolTrueTest: Joi.boolean().meta({ tag: 'bool-true-test' }),
		// 			boolFalseTest: Joi.boolean().meta({ tag: 'bool-false-test' }),
		// 			arrayTest: Joi.object({
		// 				items: Joi.array().items(Joi.number(), Joi.string()).meta({ tag: 'item' }),
		// 				pi: Joi.number()
		// 			}).meta({ tag: 'array-test' })
		// 		})
		// 	});
		// 	cfg.load(path.join(__dirname, 'fixtures', 'good.xml'));
		// 	expect(cfg.get()).to.deep.equal({
		// 		stringTest: 'foo',
		// 		numberTest: 123,
		// 		boolTrueTest: true,
		// 		boolFalseTest: false,
		// 		arrayTest: {
		// 			items: [ 123, 'abc' ],
		// 			pi: 3.14
		// 		}
		// 	});
		// });
	});

	describe('set()', () => {
		// it('should add a new object without a schema', () => {
		// 	const cfg = new XMLConfig({
		// 		file: path.join(__dirname, 'fixtures', 'good.xml'),
		// 		store: XMLStore
		// 	});

		// 	cfg.set('test', 'works');

		// 	expect(cfg.layers.get(XMLConfig.Base).store.root).to.deep.equal({
		// 		'string-test': { _text: 'foo' },
		// 		'number-test': { _text: '123' },
		// 		'bool-true-test': { _text: 'true' },
		// 		'bool-false-test': { _text: 'false' },
		// 		'array-test': {
		// 			'item': [
		// 				{
		// 					_text: '123'
		// 				},
		// 				{
		// 					_text: 'abc'
		// 				}
		// 			],
		// 			'pi': {
		// 				_text: '3.14'
		// 			}
		// 		},
		// 		'test': {
		// 			'works': {}
		// 		}
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.toString()).to.equal([
		// 		'<?xml version="1.0" encoding="UTF-8"?>',
		// 		'<awesome>',
		// 		'	<string-test>foo</string-test>',
		// 		'	<number-test>123</number-test>',
		// 		'	<bool-true-test>true</bool-true-test>',
		// 		'	<bool-false-test>false</bool-false-test>',
		// 		'	<array-test>',
		// 		'		<item>123</item>',
		// 		'		<item>abc</item>',
		// 		'		<pi>3.14</pi>',
		// 		'	</array-test>',
		// 		'	<test>',
		// 		'		<works/>',
		// 		'	</test>',
		// 		'</awesome>'
		// 	].join('\n'));
		// });

		// it.skip('should add a new object with a schema', () => {
		// 	const cfg = new XMLConfig({
		// 		file: path.join(__dirname, 'fixtures', 'good.xml'),
		// 		store: XMLStore,
		// 		schema: Joi.object({
		// 			stringTest: Joi.string().meta({ tag: 'string-test' }),
		// 			numberTest: Joi.number().meta({ tag: 'number-test' }),
		// 			boolTrueTest: Joi.boolean().meta({ tag: 'bool-true-test' }),
		// 			boolFalseTest: Joi.boolean().meta({ tag: 'bool-false-test' }),
		// 			arrayTest: Joi.object({
		// 				items: Joi.array().items(Joi.number(), Joi.string()).meta({ tag: 'item' }),
		// 				pi: Joi.number()
		// 			}).meta({ tag: 'array-test' }),
		// 			anotherString: Joi.string().meta({ tag: 'another-string' })
		// 		})
		// 	});

		// 	cfg.set('string-test', 'bar');

		// 	/*
		// 	expect(cfg.layers.get(XMLConfig.Base).store.root).to.deep.equal({
		// 		'stringTest': { _text: 'bar' },
		// 		'numberTest': { _text: '123' },
		// 		'boolTrueTest': { _text: 'true' },
		// 		'boolFalseTest': { _text: 'false' },
		// 		'arrayTest': {
		// 			'item': [
		// 				{
		// 					_text: '123'
		// 				},
		// 				{
		// 					_text: 'abc'
		// 				}
		// 			],
		// 			'pi': {
		// 				_text: '3.14'
		// 			}
		// 		}
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.toString()).to.equal([
		// 		'<?xml version="1.0" encoding="UTF-8"?>',
		// 		'<awesome>',
		// 		'	<string-test>bar</string-test>',
		// 		'	<number-test>123</number-test>',
		// 		'	<bool-true-test>true</bool-true-test>',
		// 		'	<bool-false-test>false</bool-false-test>',
		// 		'	<array-test>',
		// 		'		<item>123</item>',
		// 		'		<item>abc</item>',
		// 		'		<pi>3.14</pi>',
		// 		'	</array-test>',
		// 		'</awesome>'
		// 	].join('\n'));

		// 	cfg.set('anotherString', 'baz');

		// 	expect(cfg.layers.get(XMLConfig.Base).store.root).to.deep.equal({
		// 		'stringTest': { _text: 'bar' },
		// 		'numberTest': { _text: '123' },
		// 		'boolTrueTest': { _text: 'true' },
		// 		'boolFalseTest': { _text: 'false' },
		// 		'arrayTest': {
		// 			'item': [
		// 				{
		// 					_text: '123'
		// 				},
		// 				{
		// 					_text: 'abc'
		// 				}
		// 			],
		// 			'pi': {
		// 				_text: '3.14'
		// 			}
		// 		},
		// 		'anotherString': 'baz'
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.toString()).to.equal([
		// 		'<?xml version="1.0" encoding="UTF-8"?>',
		// 		'<awesome>',
		// 		'	<string-test>bar</string-test>',
		// 		'	<number-test>123</number-test>',
		// 		'	<bool-true-test>true</bool-true-test>',
		// 		'	<bool-false-test>false</bool-false-test>',
		// 		'	<array-test>',
		// 		'		<item>123</item>',
		// 		'		<item>abc</item>',
		// 		'		<pi>3.14</pi>',
		// 		'	</array-test>',
		// 		'	<another-string>baz</another-string>',
		// 		'</awesome>'
		// 	].join('\n'));

		// 	cfg.set('oneMoreString', 'pow');

		// 	expect(cfg.layers.get(XMLConfig.Base).store.root).to.deep.equal({
		// 		'string-test': { _text: 'bar' },
		// 		'number-test': { _text: '123' },
		// 		'bool-true-test': { _text: 'true' },
		// 		'bool-false-test': { _text: 'false' },
		// 		'array-test': {
		// 			'item': [
		// 				{
		// 					_text: '123'
		// 				},
		// 				{
		// 					_text: 'abc'
		// 				}
		// 			],
		// 			'pi': {
		// 				_text: '3.14'
		// 			}
		// 		},
		// 		'another-string': 'baz',
		// 		'oneMoreString': {
		// 			'pow': {}
		// 		}
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.toString()).to.equal([
		// 		'<?xml version="1.0" encoding="UTF-8"?>',
		// 		'<awesome>',
		// 		'	<string-test>bar</string-test>',
		// 		'	<number-test>123</number-test>',
		// 		'	<bool-true-test>true</bool-true-test>',
		// 		'	<bool-false-test>false</bool-false-test>',
		// 		'	<array-test>',
		// 		'		<item>123</item>',
		// 		'		<item>abc</item>',
		// 		'		<pi>3.14</pi>',
		// 		'	</array-test>',
		// 		'	<another-string>baz</another-string>',
		// 		'	<oneMoreString>',
		// 		'		<pow/>',
		// 		'	</oneMoreString>',
		// 		'</awesome>'
		// 	].join('\n'));
		// 	*/
		// });

		// it('should add an object with text and an attribute without a schema', () => {
		// 	const cfg = new XMLConfig({
		// 		file: path.join(__dirname, 'fixtures', 'good.xml'),
		// 		store: XMLStore
		// 	});

		// 	cfg.set('test.works', {
		// 		'@a': 'b',
		// 		_text: 'foo'
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.root).to.deep.equal({
		// 		'string-test': { _text: 'foo' },
		// 		'number-test': { _text: '123' },
		// 		'bool-true-test': { _text: 'true' },
		// 		'bool-false-test': { _text: 'false' },
		// 		'array-test': {
		// 			'item': [
		// 				{
		// 					_text: '123'
		// 				},
		// 				{
		// 					_text: 'abc'
		// 				}
		// 			],
		// 			'pi': {
		// 				_text: '3.14'
		// 			}
		// 		},
		// 		'test': {
		// 			'works': {
		// 				'@a': 'b',
		// 				_text: 'foo'
		// 			}
		// 		}
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.toString()).to.equal([
		// 		'<?xml version="1.0" encoding="UTF-8"?>',
		// 		'<awesome>',
		// 		'	<string-test>foo</string-test>',
		// 		'	<number-test>123</number-test>',
		// 		'	<bool-true-test>true</bool-true-test>',
		// 		'	<bool-false-test>false</bool-false-test>',
		// 		'	<array-test>',
		// 		'		<item>123</item>',
		// 		'		<item>abc</item>',
		// 		'		<pi>3.14</pi>',
		// 		'	</array-test>',
		// 		'	<test>',
		// 		'		<works a="b">foo</works>',
		// 		'	</test>',
		// 		'</awesome>'
		// 	].join('\n'));
		// });
	});

	describe('delete()', () => {
		// it('should delete some values', () => {
		// 	const cfg = new XMLConfig({
		// 		file: path.join(__dirname, 'fixtures', 'good.xml')
		// 	});

		// 	cfg.delete('string-test');
		// 	cfg.delete('array-test');

		// 	expect(cfg.layers.get(XMLConfig.Base).store.root).to.deep.equal({
		// 		'number-test': { _text: '123' },
		// 		'bool-true-test': { _text: 'true' },
		// 		'bool-false-test': { _text: 'false' }
		// 	});

		// 	expect(cfg.layers.get(XMLConfig.Base).store.toString()).to.equal([
		// 		'<?xml version="1.0" encoding="UTF-8"?>',
		// 		'<awesome>',
		// 		'	<number-test>123</number-test>',
		// 		'	<bool-true-test>true</bool-true-test>',
		// 		'	<bool-false-test>false</bool-false-test>',
		// 		'</awesome>'
		// 	].join('\n'));
		// });
	});

	describe('save()', () => {
		// it('should error if no filename specified', () => {
		// 	const cfg = new XMLConfig();
		// 	expect(() => {
		// 		cfg.save();
		// 	}).to.throw(TypeError, 'Expected config file path to be a string');
		// });

		// it('should error if filename is invalid', () => {
		// 	const cfg = new XMLConfig();
		// 	expect(() => {
		// 		cfg.save({ file: 123, id: Config.Runtime });
		// 	}).to.throw(TypeError, 'Expected config file path to be a string');
		// });

		// it('should error if id does not exist', () => {
		// 	const cfg = new XMLConfig();
		// 	expect(() => {
		// 		cfg.save({ id: 'test' });
		// 	}).to.throw(Error, 'Layer "test" not found');
		// });

		// it('should save default layer with a filename', () => {
		// 	const tmp = makeTempDir();
		// 	const file = path.join(tmp, 'foo.xml');
		// 	const cfg = new XMLConfig({ file });

		// 	cfg.save(file);

		// 	expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
		// 	expect(fs.readFileSync(file, 'utf8')).to.equal('<?xml version="1.0" encoding="UTF-8"?>');
		// });
	});
});
