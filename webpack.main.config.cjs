const path = require('path');

module.exports = {
  entry: './electron/main.cjs',
  target: 'electron-main',
  mode: 'production',
  output: {
    filename: 'main.cjs',
    path: path.resolve(__dirname, 'build'),
    chunkFormat: 'commonjs'
  },
  module: {
    rules: [
      {
        test: /\.(js|cjs|mjs)$/,
        exclude: /node_modules\/(?!(@langchain|langchain))/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  node: 'current'
                },
                modules: 'commonjs'
              }]
            ],
            plugins: [
              '@babel/plugin-transform-runtime',
              '@babel/plugin-transform-modules-commonjs'
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.cjs', '.mjs'],
    fallback: {
      "path": require.resolve("path-browserify"),
      "fs": false,
      "crypto": false
    },
    mainFields: ['main', 'module'],
    conditionNames: ['require', 'node', 'default']
  },
  externals: [
    'electron',
    'hnswlib-node'
  ],
  node: {
    __dirname: false,
    __filename: false
  },
  experiments: {
    topLevelAwait: true
  }
};
