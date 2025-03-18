const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Make sure alias exists
  if (!config.resolve.alias) {
    config.resolve.alias = {};
  }
  
  // Add alias for missing asset registry path
  const assetRegistryPatchPath = path.resolve(__dirname, './asset-registry-patch.js');
  
  // Add multiple aliases to cover all possible import paths
  config.resolve.alias['missing-asset-registry-path'] = assetRegistryPatchPath;
  config.resolve.alias['@expo/asset-registry'] = assetRegistryPatchPath;
  config.resolve.alias['react-native-asset-registry'] = assetRegistryPatchPath;
  
  // Additional fallbacks if needed
  if (!config.resolve.fallback) {
    config.resolve.fallback = {};
  }
  config.resolve.fallback['missing-asset-registry-path'] = assetRegistryPatchPath;

  // Ensure proper output configuration for production
  if (env.mode === 'production') {
    config.output = {
      ...config.output,
      publicPath: '/',
      filename: '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash].js',
      clean: true
    };
  }
  
  return config;
}; 