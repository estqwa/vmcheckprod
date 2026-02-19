const fs = require('fs');
const path = require('path');

function resolveExpoPreset() {
  try {
    return require.resolve('babel-preset-expo');
  } catch {
    const pnpmRoot = path.join(__dirname, '..', 'node_modules', '.pnpm');
    if (fs.existsSync(pnpmRoot)) {
      const entry = fs
        .readdirSync(pnpmRoot)
        .find((name) => name.startsWith('babel-preset-expo@'));
      if (entry) {
        return path.join(pnpmRoot, entry, 'node_modules', 'babel-preset-expo');
      }
    }
    throw new Error('Cannot resolve babel-preset-expo');
  }
}

module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [resolveExpoPreset()],
  };
};
