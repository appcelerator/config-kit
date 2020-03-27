import Config from '../dist/index';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';

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
		it('should error if options is invalid', () => {
			expect(() => {
				new Config('foo');
			}).to.throw(TypeError, 'Expected config options to be an object');
		});

		it('should error if data is invalid', () => {
			expect(() => {
				new Config({ data: 'foo' });
			}).to.throw(TypeError, 'Expected config data to be an object');

			expect(() => {
				new Config({ data: null });
			}).to.not.throw(TypeError, 'Expected config data to be an object');
		});
	});

	describe('load()', () => {
		it('should error if filename is invalid', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(123);
			}).to.throw(TypeError, 'Expected config file to be a non-empty string');
		});

		it('should error if extension is unsupported', () => {
			const cfg = new Config();
			expect(() => {
				cfg.load(path.join(__dirname, 'does_not_exist.yaml'));
			}).to.throw(Error, 'Unsupported file type ".yaml"');
		});

		it('should error if options is not an object', () => {
			const cfg = new Config();

			expect(() => {
				cfg.load('foo', 123);
			}).to.throw(Error, 'Expected options to be an object');

			expect(() => {
				cfg.load('foo', null);
			}).to.throw(Error, 'Expected options to be an object');
		});

		it('should error loading a file for a specific layer', () => {
			const cfg = new Config();

			expect(() => {
				cfg.layers.get(Config.Base).load();
			}).to.throw(Error, 'Expected config file path to be a string');

			expect(() => {
				cfg.layers.get(Config.Base).load('');
			}).to.throw(Error, 'Expected config file path to be a string');

			expect(() => {
				cfg.layers.get(Config.Base).load([]);
			}).to.throw(Error, 'Expected config file path to be a string');
		});
	});

	describe('save()', () => {
		it('should error if no filename specified', () => {
			const cfg = new Config();
			expect(() => {
				cfg.save();
			}).to.throw(TypeError, 'Expected config file path to be a string');
		});

		it('should error if filename is invalid', () => {
			const cfg = new Config();
			expect(() => {
				cfg.save({ file: 123, id: Config.Runtime });
			}).to.throw(TypeError, 'Expected config file path to be a string');
		});

		it('should error if JSONConfig filename is not json', () => {
			const cfg = new Config();
			expect(() => {
				cfg.save({ file: path.join(makeTempName(), 'foo'), id: Config.Runtime });
			}).to.throw(Error, 'Expected JSON config file to have ".json" extension, found ""');
		});

		it('should error if id does not exist', () => {
			const cfg = new Config();

			expect(() => {
				cfg.save({ id: 'test' });
			}).to.throw(Error, 'Layer "test" not found');
		});

		it('should save default layer with a filename', () => {
			const tmp = makeTempDir();
			const file = path.join(tmp, 'foo.json');
			const cfg = new Config();

			fs.copyFileSync(path.join(__dirname, 'fixtures', 'json', 'good.json'), file);

			cfg.load(file, 'test');
			cfg.set('foo', 'baz', 'test');
			cfg.save({ id: 'test' });

			expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
			expect(fs.readFileSync(file, 'utf8')).to.equal('{\n  "foo": "baz"\n}\n');

			cfg.set('foo', 'bar', 'test');
			cfg.save({ id: 'test' });

			expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
			expect(fs.readFileSync(file, 'utf8')).to.equal('{\n  "foo": "bar"\n}\n');
		});

		it('should save default layer with only a filename', () => {
			const tmp = makeTempDir();
			const file = path.join(tmp, 'bar.json');
			const cfg = new Config({ file: path.join(tmp, 'foo.json') });

			cfg.set('foo', 'baz');
			cfg.save(file);

			expect(fs.readdirSync(tmp)).to.have.lengthOf(1);
			expect(fs.readFileSync(file, 'utf8')).to.equal('{\n  "foo": "baz"\n}\n');
		});
	});

	describe('unload()', () => {
		it('should load and unload a json file', () => {
			const cfg = new Config();
			cfg.load(path.join(__dirname, 'fixtures', 'json', 'good.json'), 'test');
			expect(cfg.get('foo')).to.equal('bar');

			cfg.unload('test');
			expect(cfg.get('foo')).to.equal(undefined);
		});

		it('should error if layer is static', () => {
			const cfg = new Config();

			expect(() => {
				cfg.unload(Config.Base);
			}).to.throw(Error, 'Cannot unload static layer');

			cfg.layers.add({ id: 'test', static: true });

			expect(() => {
				cfg.unload('test');
			}).to.throw(Error, 'Cannot unload static layer');
		});

		it('should error trying to unload without a layer id', () => {
			const cfg = new Config();
			expect(() => {
				cfg.unload();
			}).to.throw(Error, 'Missing required layer id to unload');
		});

		it('should error trying to unload a non-existent id', () => {
			const cfg = new Config();
			expect(() => {
				cfg.unload('foo');
			}).to.throw(Error, 'Layer "foo" not found');
		});
	});

	describe('watch()/unwatch()', () => {
		it('should error if handler is not a function', () => {
			const cfg = new Config();

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
