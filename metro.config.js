const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Alias websocket-polyfill to a local empty shim
config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'websocket-polyfill': path.resolve(__dirname, 'shims/websocket-polyfill.js'),
};

module.exports = config;
