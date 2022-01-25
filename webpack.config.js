const path = require('path');
const fs = require('fs');
const prettier = require('prettier');
const { merge } = require('webpack-merge');
const config = require('./webpack.config');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');
const package = require('./package.json');

module.exports = [
  {
    name: 'web',

    entry: './web/index.ts',

    output: {
      path: path.resolve(__dirname, 'dist/web'),
      filename: 'web.js',
      clean: true,
      library: {
        name: 'webtest',
        type: 'umd',
      },
    },

    resolve: {
      extensions: ['.ts', '.js'],
      fallback: {
        fs: false,
        path: false,
        crypto: false,
      },
    },

    module: {
      rules: [
        {
          test: /\.(ts)$/,
          exclude: [/node_modules/],
          use: [{ loader: 'ts-loader' }],
        },
      ],
    },

    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'src/cherry',
            to: path.resolve(__dirname, './dist/cherry'),
          },
          {
            from: 'src/scripts',
            to: path.resolve(__dirname, './dist/scripts'),
          },
          {
            from: 'src/types',
            to: path.resolve(__dirname, './dist/types'),
          },
          { from: 'src/index.d.ts', to: path.resolve(__dirname, './dist') },
          {
            from: 'package.json',
            to: path.resolve(__dirname, './dist'),
            transform(content, absoluteFrom) {
              const config = JSON.parse(fs.readFileSync(absoluteFrom));

              const newConfig = {
                name: config.name,
                version: config.version,
                main: 'index.js',
                types: 'index.d.ts',
                repository: config.repository,
                license: config.license,
                bugs: config.bugs,
                homepage: config.homepage,
                peerDependencies: config.peerDependencies,
                engineStrict: config.engineStrict,
                engine: config.engine,
              };

              return prettier.format(JSON.stringify(newConfig), {
                parser: 'json',
              });
            },
          },
        ],
      }),
      new ReplaceInFileWebpackPlugin([
        {
          dir: 'dist',
          files: ['index.js'],
          rules: [
            {
              search: '0.0.0',
              replace: package.version,
            },
          ],
        },
      ]),
      // TODO: Need web based configuration for cherryGL
    ],
  },
];
