import Config, { Joi } from '../src/index.js';
import path from 'path';
import { expect } from 'chai';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('Namespaces', () => {
	describe('schemaless', () => {
		describe('layer', () => {
			it('should create a new namespaced layer with data', async () => {
				const cfg = await new Config().init();
				await cfg.layers.add({
					data: { foo: 'bar' },
					id: 'test',
					namespace: 'test'
				});
				expect(cfg.get()).to.deep.equal({
					test: {
						foo: 'bar'
					}
				});
			});
		});

		describe('load()', () => {
			it('should load a file into a namespaced layer', async () => {
				const cfg = await new Config().init();
				await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), { namespace: 'test' });

				expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });
				expect(cfg.get('foo')).to.equal(undefined);
				expect(cfg.get('test')).to.deep.equal({ foo: 'bar' });
				expect(cfg.get('test.foo')).to.equal('bar');

				expect(cfg.has('test.foo')).to.equal(true);
				expect(cfg.has('test.bar')).to.equal(false);

				await cfg.set('test.baz', 'wiz');
				expect(cfg.get('test')).to.deep.equal({ foo: 'bar', baz: 'wiz' });

				expect(cfg.delete('test.foo')).to.equal(true);
				expect(cfg.get('test')).to.deep.equal({ baz: 'wiz' });

				expect(cfg.delete('test.foo')).to.equal(false);
				expect(cfg.get('test')).to.deep.equal({ baz: 'wiz' });
			});

			it('should load a file that is already namespaced into a namespaced layer', async () => {
				const cfg = await new Config().init();
				await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good-ns.json'), { namespace: 'test' });

				expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });
				expect(cfg.get('foo')).to.equal(undefined);
				expect(cfg.get('test')).to.deep.equal({ foo: 'bar' });
				expect(cfg.get('test.foo')).to.equal('bar');

				expect(cfg.has('test.foo')).to.equal(true);
				expect(cfg.has('test.bar')).to.equal(false);

				await cfg.set('test.baz', 'wiz');
				expect(cfg.get('test')).to.deep.equal({ foo: 'bar', baz: 'wiz' });

				expect(cfg.delete('test.foo')).to.equal(true);
				expect(cfg.get('test')).to.deep.equal({ baz: 'wiz' });

				expect(cfg.delete('test.foo')).to.equal(false);
				expect(cfg.get('test')).to.deep.equal({ baz: 'wiz' });
			});
		});

		describe('get()', () => {
			it('should get an empty layer', async () => {
				const cfg = await new Config().init();
				expect(cfg.get()).to.deep.equal({});

				await cfg.layers.add({
					id: 'test',
					namespace: 'test'
				});

				expect(cfg.get()).to.deep.equal({ test: {} });
				expect(cfg.get('test')).to.deep.equal({});
				expect(cfg.get('test.foo')).to.equal(undefined);
			});
		});

		describe('has()', () => {
			it('should return undefined for empty layer', async () => {
				const cfg = await new Config().init();
				await cfg.layers.add({
					id: 'test',
					namespace: 'test'
				});

				expect(cfg.has()).to.equal(true);
				expect(cfg.has('foo')).to.equal(false);
				expect(cfg.has('test')).to.equal(true);
				expect(cfg.has('test.foo')).to.equal(false);
			});
		});

		describe('merge()', () => {
			it('should merge data into namespaced layer', async () => {
				const cfg = await new Config().init();
				await cfg.layers.add({
					id: 'test',
					namespace: 'test'
				});

				expect(cfg.get()).to.deep.equal({ test: {} });

				cfg.merge({ foo: 'bar' });

				expect(cfg.get()).to.deep.equal({
					foo: 'bar',
					test: {}
				});

				cfg.merge({ test: { baz: 'wiz' } });

				expect(cfg.get()).to.deep.equal({
					foo: 'bar',
					test: {
						baz: 'wiz'
					}
				});
			});
		});

		describe('set()/delete()', () => {
			it('should set a value in a namespaced layer', async () => {
				const cfg = await new Config().init();
				await cfg.layers.add({
					id: 'test',
					namespace: 'test'
				});

				await cfg.set('test.foo', 'bar', 'test');
				expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });

				expect(cfg.data('test')).to.deep.equal({ foo: 'bar' });

				cfg.delete('test.foo');
				expect(cfg.data('test')).to.deep.equal({});
				expect(cfg.get('test')).to.deep.equal({});
				expect(cfg.get()).to.deep.equal({ test: {} });

				cfg.delete('test');
				expect(cfg.data('test')).to.deep.equal({});
				expect(cfg.get('test')).to.deep.equal({});
			});
		});
	});

	describe('schema', () => {
		describe('load()', () => {
			it('should fail if loaded file validation fails', async () => {
				const cfg = await new Config().init();
				await expect(
					cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), {
						namespace: 'test',
						schema: Joi.object({
							foo: Joi.string().valid('baz'),
							count: Joi.number().valid(1)
						})
					})
				).to.eventually.be.rejectedWith(Error, /^Failed to load config file/);
			});
		});

		describe('merge()', () => {
			it('should fail to merge if schema validation fails', async () => {
				const cfg = await new Config().init();
				await cfg.layers.add({
					id: 'test',
					namespace: 'test',
					schema: Joi.object({
						foo: Joi.string().valid('bar'),
						count: Joi.number().valid(0)
					})
				});

				expect(cfg.get()).to.deep.equal({ test: {} });

				cfg.merge({ test: { foo: 'bar' } });
				expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });

				expect(() => {
					cfg.merge({ test: { count: 'bar' } });
				}).to.throw(Error, /^Failed to merge config value/);
			});
		});

		describe('set()/delete()', () => {
			it('should fail to delete a value', async () => {
				const cfg = await new Config().init();
				await cfg.layers.add({
					data: { foo: 'bar' },
					id: 'test',
					namespace: 'test',
					schema: Joi.object({
						foo: Joi.string().valid('bar').meta({ readonly: true })
					})
				});

				expect(cfg.get()).to.deep.equal({ test: { foo: 'bar' } });

				await expect(
					cfg.set('test.foo', 'baz', 'test')
				).to.eventually.be.rejectedWith(Error, 'Not allowed to set read-only property');

				expect(() => {
					cfg.delete('test.foo');
				}).to.throw(Error, 'Not allowed to delete read-only property');
			});
		});
	});
});
