const fs = require('fs');
const { createFilter } = require('rollup-pluginutils');
const versionInjector = require('rollup-plugin-version-injector');
const analyze = require('rollup-plugin-analyzer');
const image = require('@rollup/plugin-image');
let arraybuffer = require('@wemap/rollup-plugin-arraybuffer')


const uglify = require('uglify-js');
const generatePackageJson = require('rollup-plugin-generate-package-json');

const template = (base64) => `
function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; ++i) { bytes[i] = binary.charCodeAt(i); }
    return bytes.buffer;
}
export default base64ToBuffer("${base64}");
`;

function binary2base64(options = {}) {
  if (!options.include) {
    throw Error("include option should be specified");
  }
  const filter = createFilter(options.include, options.exclude);

  return {
    name: "binary",
    load(id) {
      if (filter(id)) {
        return new Promise((res, reject) => {
          readFile(id, (error, buffer) => {
            if (error != null) {
              reject(error);
            }
            res(buffer.toString("binary"));
          });
        });
      }
      return null;
    },
    transform(code, id) {
        if (!filter(id)) {
          return null;
      }

      const base64 = fs.readFileSync(id, { encoding: 'base64' });
      return {
          code: template(base64),
          map: { mappings: '' }
      };
      if (filter(id)) {
        // const src = Buffer.from(code, "binary").toString("base64");
        // return `export default ${JSON.stringify(src)}`;
      }
    }
  };
}

function string(opts = {}) {
  if (!opts.include) {
    throw Error('include option should be specified');
  }

  const filter = createFilter(opts.include, opts.exclude);

  return {
    name: 'string',
    transform(_, id) {
      if (filter(id)) {
        const content = fs.readFileSync(id, { encoding: 'utf-8' });

        if (process.env.NODE_ENV === 'development') {
          return {
            code: `export default ${JSON.stringify(content)};`,
            map: { mappings: '' },
          };
        }
        const mini = uglify.minify(content, { warnings: true }).code;
        return {
          code: `export default ${JSON.stringify(mini)};`,
          map: { mappings: '' },
        };
      }
    },
  };
}

module.exports = {
  rollup(config, options) {
    config.output.strict = false;
    config.plugins.push(versionInjector());
    config.plugins.push(analyze({ summaryOnly: true }));
    config.plugins.push(arraybuffer({ include: './src/assets/scripts/**/*.wasm' }));
    config.plugins.push(string({ include: './src/assets/scripts/**/*.png' }));
    config.plugins.push(string({ include: './src/assets/scripts/**/*.js' }));
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
