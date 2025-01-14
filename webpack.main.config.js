const path = require('path');

module.exports = {
  entry: './electron/main.cjs',
  target: 'electron-main',
  mode: 'production',
  output: {
    filename: 'main.cjs',
    path: path.resolve(__dirname, '.vite/build'),
    chunkFormat: 'commonjs'
  },
  module: {
    rules: [
      {
        test: /\.(js|cjs|mjs)$/,
        exclude: /node_modules\/(?!(@langchain|langchain))/,
        use: 'babel-loader'
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
    mainFields: ['main', 'module']
  },
  externals: [
    'electron',
    'hnswlib-node'
  ],
  node: {
    __dirname: false,
    __filename: false
  }
};
