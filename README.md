# config-kit

> A universal, layered configuration system.

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Deps][david-image]][david-url]
[![Dev Deps][david-dev-image]][david-dev-url]

## Features

 * Layered data architecture
 * Schema validation using [joi]
 * Default values
 * Environment variable precedence
 * Define custom layers
 * Extensible data store interface
 * Support for array type values

## Installation

    npm install config-kit --save

# Usage

```js
import Config from 'config-kit';

const config = new Config();

config.set('foo.bar', true);

console.log(config.get('foo')); // { "bar": true }

config.load('/path/to/myconfig.json');
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
[david-image]: https://img.shields.io/david/appcelerator/config-kit.svg
[david-url]: https://david-dm.org/appcelerator/config-kit
[david-dev-image]: https://img.shields.io/david/dev/appcelerator/config-kit.svg
[david-dev-url]: https://david-dm.org/appcelerator/config-kit#info=devDependencies
[joi]: https://www.npmjs.com/package/@hapi/joi
