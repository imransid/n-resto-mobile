const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * `@env` is virtual for `react-native-dotenv`; Metro still needs a resolvable path (stub).
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      '@env': path.resolve(__dirname, 'src/env'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
