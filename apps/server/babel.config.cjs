// This file uses the .cjs extension to ensure it is loaded as a CommonJS module,
// preventing the "native ECMAScript module configuration file" error when running synchronously
// inside Jest/Babel.
module.exports = {
  // Use the env preset to convert ES6+ features (like import/export in dependencies) to CommonJS
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    // Ensure TypeScript syntax is understood by Babel when processing .js files
    '@babel/preset-typescript'
  ],
};
