
> :warning: **Deprecation Notice** :warning:
> This repository has been deprecated. Please use the corresponding package from the [iLib-js monorepo](https://github.com/iLib-js/ilib-mono) instead.

# ilib-loctool-swift

Ilib plugin to parse iOS Swift files looking for strings to extract

## License

This plugin is license under Apache2. See the [LICENSE](./LICENSE)
file for more details.

## Release Notes

### v1.1.3

- update dependencies
- convert unit tests from nodeunit to jest

### v1.1.2

- update dependencies
- use the loctool's logger instead of its own

### v1.1.1

- Fix a bug where the pseudo locales were not initialized properly.
  This fix gets the right set of locales from the project settings to
  see if any of them are pseudo locales.

