# config-kit

> A universal, layered configuration system.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]

## Features

 * Layered data architecture
 * Schema validation using [joi]
 * Support for `.json`, `.js`, and `.xml` data stores
 * Default values
 * Environment variable precedence
 * Define custom layers
 * Extensible data store interface
 * Support for array type values
 * Apply parent directory owner when running as sudo

## Installation

    npm install config-kit --save

# Usage

```js
import Config from 'config-kit';

const config = await new Config().init();

await config.set('foo.bar', true);

console.log(config.get('foo')); // { "bar": true }

await config.load('/path/to/myconfig.json');

await config.set('foo.baz', 'pow');

await config.save();
```

## Migrating from v1

v2 introduces major breaking API changes. This package was refactored to be a ES module.
This means `.js` config and schema files also need to be ES modules. Since you can't
synchronously import ES modules, there was no choice but to make nearly every API async.

When creating a new `Config` instance, simply prepend with `await` and call `init()` with the
constructor options:

#### v1

```js
const cfg = new Config({ /* opts */ });
```

#### v2

```js
const cfg = await new Config().init({ /* opts */ });
```

The following functions are now async: `load()`, `pop()`, `push()`, `save()`, `set()`, `shift()`,
`unshift()`.

#### v1

```js
cfg.load({ file: '/path/to/file' });
cfg.set('foo', 'bar');
cfg.push('baz', 'wiz');
cfg.save();
```

#### v2

```js
await cfg.load({ file: '/path/to/file' });
await cfg.set('foo', 'bar');
await cfg.push('baz', 'wiz');
await cfg.save();
```

## License

This project is open source under the [Apache Public License v2][1] and is developed by
[Axway, Inc](http://www.axway.com/) and the community. Please read the [`LICENSE`][1] file included
in this distribution for more information.

[1]: https://github.com/appcelerator/config-kit/blob/master/LICENSE
[npm-image]: https://img.shields.io/npm/v/config-kit.svg
[npm-url]: https://npmjs.org/package/config-kit
[downloads-image]: https://img.shields.io/npm/dm/config-kit.svg
[downloads-url]: https://npmjs.org/package/config-kit
[joi]: https://www.npmjs.com/package/@hapi/joi
