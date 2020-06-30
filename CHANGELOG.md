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
