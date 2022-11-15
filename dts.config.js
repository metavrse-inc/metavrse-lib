const fs = require('fs');
const { createFilter } = require('rollup-pluginutils');
const versionInjector = require('rollup-plugin-version-injector');
const analyze = require('rollup-plugin-analyzer');
const image = require('@rollup/plugin-image');
let arraybuffer = require('@wemap/rollup-plugin-arraybuffer')
const copy = require("rollup-plugin-copy")

const uglify = require('uglify-js');
const generatePackageJson = require('rollup-plugin-generate-package-json');

module.exports = {
  rollup(config, options) {
    config.output.strict = false;
    config.plugins.push(versionInjector());
    config.plugins.push(analyze({ summaryOnly: true }));
    config.plugins.push(copy({
      targets: [
        { src: './src/cherry/CherryGL.wasm', dest: 'dist' },
      ]
    }))
    config.plugins.push(arraybuffer({ include: './src/cherry/**/*.wasm' }));
    config.plugins.push(arraybuffer({ include: './src/assets/scripts/**/*.wasm' }));
    config.plugins.push(arraybuffer({ include: './src/assets/scripts/**/*.c3b' }));
    config.plugins.push(arraybuffer({ include: './src/assets/scripts/**/*.png' }));
    config.plugins.push(arraybuffer({ include: './src/assets/scripts/**/*.js' }));
    config.plugins.push(
      generatePackageJson({
        outputFolder: 'dist',
        baseContents: (pkg) => ({
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          main: 'metavrse-lib.esm.js',
          module: 'metavrse-lib.esm.js',
          typings: 'index.d.ts',
          repository: pkg.repository,
          license: pkg.license,
          bugs: pkg.bugs,
          homepage: pkg.homepage,
          engineStrict: pkg.engineStrict,
          engine: pkg.engine,
        }),
      })
    );
    return config;
  },
};
