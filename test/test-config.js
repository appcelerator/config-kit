import Config from '../src/index.js';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import { expect } from 'chai';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const tmpDir = tmp.dirSync({
	mode: '755',
	prefix: 'config-kit-test-',
	unsafeCleanup: true
}).name;

function makeTempName() {
	return path.join(tmpDir, Math.random().toString(36).substring(7));
}

function makeTempDir() {
	const dir = makeTempName();
	fs.mkdirsSync(dir);
	return dir;
}

describe('Config', () => {
	after(() => {
		fs.removeSync(tmpDir);
	});

	describe('Constructor', () => {
		it('should error if calling constructor with options', () => {
			expect(() => {
				new Config('foo');
			}).to.throw(Error, 'Please call init with constructor options');

			expect(() => {
				new Config({});
			}).to.throw(Error, 'Please call init with constructor options');
		});

		it('should error if options is invalid', async () => {
			await expect(
				new Config().init('foo')
			).to.eventually.be.rejectedWith(TypeError, 'Expected config options to be an object');
		});

		it('should error if data is invalid', async () => {
			await expect(
				new Config().init({ data: 'foo' })
			).to.eventually.be.rejectedWith(TypeError, 'Expected config data to be an object');

			await new Config().init({ data: null });
		});
	});

	describe('load()', () => {
		it('should error if filename is invalid', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(123)
			).to.eventually.be.rejectedWith(TypeError, 'Expected config file to be a non-empty string');
		});

		it('should error if extension is unsupported', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.load(path.join(__dirname, 'does_not_exist.yaml'))
			).to.eventually.be.rejectedWith(Error, 'Unsupported file type ".yaml"');
		});

		it('should error if options is not an object', async () => {
			const cfg = await new Config().init();

			await expect(
				cfg.load('foo', 123)
			).to.eventually.be.rejectedWith(Error, 'Expected options to be an object');

			await expect(
				cfg.load('foo', null)
			).to.eventually.be.rejectedWith(Error, 'Expected options to be an object');
		});

		it('should error loading a file for a specific layer', async () => {
			const cfg = await new Config().init();

			await expect(
				cfg.layers.get(Config.Base).load()
			).to.eventually.be.rejectedWith(Error, 'Expected config file path to be a string');

			await expect(
				cfg.layers.get(Config.Base).load('')
			).to.eventually.be.rejectedWith(Error, 'Expected config file path to be a string');

			await expect(
				cfg.layers.get(Config.Base).load([])
			).to.eventually.be.rejectedWith(Error, 'Expected config file path to be a string');
		});
	});

	describe('save()', () => {
		it('should error if no filename specified', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.save()
			).to.eventually.be.rejectedWith(TypeError, 'Expected config file path to be a string');
		});

		it('should error if filename is invalid', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.save({ file: 123, id: Config.Runtime })
			).to.eventually.be.rejectedWith(TypeError, 'Expected config file path to be a string');
		});

		it('should error if JSONConfig filename is not json', async () => {
			const cfg = await new Config().init();
			await expect(
				cfg.save({ file: path.join(makeTempName(), 'foo'), id: Config.Runtime })
			).to.eventually.be.rejectedWith(Error, 'Expected JSON config file to have ".json" extension, found ""');
		});

		it('should error if id does not exist', async () => {
			const cfg = await new Config().init();

			await expect(
				cfg.save({ id: 'test' })
			).to.eventually.be.rejectedWith(Error, 'Layer "test" not found');
		});

		it('should save default layer with a filename', async () => {
			const tmp = makeTempDir();
			const file = path.join(tmp, 'foo.json');
			const cfg = await new Config().init();

			fs.copyFileSync(path.join(__dirname, 'fixtures', 'json', 'good.json'), file);

			await cfg.load(file, 'test');
			await cfg.set('foo', 'baz', 'test');
			await cfg.save({ id: 'test' });

			expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
			expect(fs.readFileSync(file, 'utf8')).to.equal('{\n  "foo": "baz"\n}');

			await cfg.set('foo', 'bar', 'test');
			await cfg.save({ id: 'test' });

			expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
			expect(fs.readFileSync(file, 'utf8')).to.equal('{\n  "foo": "bar"\n}');
		});

		it('should save default layer with only a filename', async () => {
			const tmp = makeTempDir();
			const file = path.join(tmp, 'bar.json');
			const cfg = await new Config().init({ file: path.join(tmp, 'foo.json') });

			await cfg.set('foo', 'baz');
			await cfg.save(file);

			expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
			expect(fs.readFileSync(file, 'utf8')).to.equal('{\n  "foo": "baz"\n}');
		});
	});

	describe('unload()', () => {
		it('should load and unload a json file', async () => {
			const cfg = await new Config().init();
			await cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), 'test');
			expect(cfg.get('foo')).to.equal('bar');

			cfg.unload('test');
			expect(cfg.get('foo')).to.equal(undefined);
		});

		it('should error if layer is static', async () => {
			const cfg = await new Config().init();

			expect(() => {
				cfg.unload(Config.Base);
			}).to.throw(Error, 'Cannot unload static layer');

			await cfg.layers.add({ id: 'test', static: true });

			expect(() => {
				cfg.unload('test');
			}).to.throw(Error, 'Cannot unload static layer');
		});

		it('should error trying to unload without a layer id', async () => {
			const cfg = await new Config().init();
			expect(() => {
				cfg.unload();
			}).to.throw(Error, 'Missing required layer id to unload');
		});

		it('should error trying to unload a non-existent id', async () => {
			const cfg = await new Config().init();
			expect(() => {
				cfg.unload('foo');
			}).to.throw(Error, 'Layer "foo" not found');
		});
	});

	describe('watch()/unwatch()', () => {
		it('should error if handler is not a function', async () => {
			const cfg = await new Config().init();

			expect(() => {
				cfg.watch();
			}).to.throw(TypeError, 'Expected handler to be a function');

			expect(() => {
				cfg.watch('foo');
			}).to.throw(TypeError, 'Expected handler to be a function');

			expect(() => {
				cfg.unwatch();
			}).to.throw(TypeError, 'Expected handler to be a function');

			expect(() => {
				cfg.unwatch('foo');
			}).to.throw(TypeError, 'Expected handler to be a function');
		});
	});
});
