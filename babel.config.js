module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Add React JSX support
      '@babel/plugin-syntax-jsx',
    ],
  };
};