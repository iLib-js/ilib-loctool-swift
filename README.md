# ilib-loctool-swift

Ilib plugin to parse iOS Swift files looking for strings to extract

## License

This plugin is license under Apache2. See the [LICENSE](./LICENSE)
file for more details.

## Release Notes

### v1.1.1

- Fix a bug where the pseudo locales were not initialized properly.
  This fix gets the right set of locales from the project settings to
  see if any of them are pseudo locales.

