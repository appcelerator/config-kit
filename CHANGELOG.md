# v2.1.0 (May 20, 2022)

 * fix: Added missing `src` directory.
 * chore: Updated dependencies.

# v2.0.0 (Mar 8, 2022)

 * BREAKING CHANGE: Require Node.js 14.15.0 LTS or newer.
 * BREAKING CHANGE: Immediately after creating a `Config` instance, you must call `init()`.
   For example, `new Config({ })` becomes `await new Config().init({ })`.
 * BREAKING CHANGE: `Config` methods `load()`, `pop()`, `push()`, `save()`, `set()`, `shift()`, and
   `unshift()` methods are now async.
 * BREAKING CHANGE: `LayerList` methods `add()` and `set()` are now async.
 * BREAKING CHANGE: `.js` store no longer supports CommonJS modules; only ES modules are supported.
 * chore: Updated dependencies.
 * chore: Replaced Travis with GitHub action.

# v1.7.2 (Dec 17, 2021)

 * chore: Switched from `xmldom` to `@xmldom/xmldom`.
 * chore: Updated dependencies.

# v1.7.1 (Jun 8, 2021)

 * fix: Writing a file with a mode was applying the mode to the file and newly created directories.
 * fix: Default new directories to mode 777.

# v1.7.0 (Jun 8, 2021)

 * feat: Added `applyOwner` flag with default of `true` which sets the owner of the metadata file
   to the owner of closest existing parent directory to protect against commands run as sudo.
 * chore: Updated dependencies.

# v1.6.2 (Apr 21, 2021)

 * fix(set): `set()` should return `Config` instance, not `undefined`.
 * chore: Updated dependencies.

# v1.6.1 (Mar 18, 2021)

 * chore: Updated dependencies.

# v1.6.0 (Mar 3, 2021)

 * feat: Added `.xml` store without schemas support.
 * chore: Updated dependencies.

# v1.5.0 (Feb 3, 2021)

 * feat: Added support for `Node.onSet()` callback.
 * chore: Updated dependencies.

# v1.4.3 (Jan 5, 2021)

* chore: Updated dependencies.

# v1.4.2 (Dec 1, 2020)

 * chore: Updated dependencies.

# v1.4.1 (Nov 30, 2020)

 * chore: Updated dependencies.

# v1.4.0 (Nov 18, 2020)

 * feat(store): Added `keys()` method.
 * fix(layer): Account for namespaced layers to be able to load already namespaced data.

# v1.3.1 (Nov 14, 2020)

 * fix(Node): Initialize node to empty object, then manually merge source object using setter to
   avoid mutating original object and properly calculate the hashes.

# v1.3.0 (Nov 9, 2020)

 * feat(Store): Added `schema` getter and setter.
 * feat(Node): Add node class reference to internal metadata for instantiating child nodes. Useful
   if a store wants to use an extended `Node` class.
 * refactor(Store): Changed `Store.load()` to only take a `file`. Not counting this as a breaking
   change as it's an internal API.
 * fix(Layer): Move layer namespace handling from store to layer.
 * fix(Layer): Allow `has()` to be passed an empty key.
 * fix(Layer): Added schema validation when initializing a layer with data.
 * fix(LayerList): Moved `Base` layer definition from `Config` into `LayerList` because the layer
   schema validator needs the base layer's schema and we need to make sure the base layer exists
   and thus needs to own the `Base` symbol.
 * fix(LayerList): Validator should only use base layer's schema and current layer's schema to
   validate, not all layer's schemas.
 * fix(LayerList): Fixed bug where layers were not being inserted into the layer list sequentially.
 * fix(JSONStore): Fixed `get()` and `has()` to only iterate over the data object if the `key` has
   a length.
 * fix(util): In `getSchemaInitialValues()`, only return `env` object if there were environment
   variable values found.
 * build: Update Babel config from Node 8 to Node 10.
 * test: Added several namespace related tests.
 * test: Fixed several bad tests.
 * chore: Migrated from `@hapi/joi` to `joi`.

# v1.2.1 (Jul 3, 2020)

 * fix(config): Fixed duplicate watch events when deleting across multiple layers.
 * fix(node): Node hash was not being properly calculated when a property was deleted.
 * style: Added debug logging to the config mutation functions: `delete()`, `set()`, `push()`,
   `pop()`, `shift()`, and `unshift()`.

# v1.2.0 (Jul 2, 2020)

 * feat(config): Added `graceful` flag to `load()` that won't throw an error if the file does not
   exist.

# v1.1.0 (Jun 30, 2020)

 * fix(config): Fixed bug when loading a layer that already exists with a file that was causing the
   new layer to load the file twice: once by the `Layer` constructor and once by the
   `Config.load()`.
 * fix(config): Only emit change notifications for each distinct filter/handler pair instead of
   stacking notifications the same changes being made to multiple layers.
 * fix(config): Only emit changes when filtered data is affected instead of the entire layer.
 * fix(node): Fixed huge bug where object hashes only took into account values, but not key names.
 * fix(node): Fixed bug where it incorrectly determined a value changed when there was no previous
   listener callback.
 * fix(node): Normalize all undefined object hashes to `null`.
 * feat(layer): Added `graceful` flag to `Layer` constructor. When `true` (default) and specifying
   a `file`, it will not throw an error if the file does not exist.
 * chore: Updated dependencies.

# v1.0.1 (Jun 1, 2020)

 * fix: Added object check when checking if object changed during watch handler execution.
 * chore: Updated dependencies.

# v1.0.0 (Mar 27, 2020)

  * Initial release with support for:
    - Layered data architecture
    - Schema validation using [joi]
    - Default values
    - Environment variable precedence
    - Define custom layers
    - Extensible data store interface
    - Support for array type values
