// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolution for the missing asset registry path
config.resolver.extraNodeModules = {
  'missing-asset-registry-path': path.resolve(__dirname, './asset-registry-patch.js'),
};

// Make sure we can resolve png files
config.resolver.assetExts.push('png');

module.exports = config;