/**
 * Build du renderer pour Android (Capacitor).
 *
 * Différences avec `webpack.config.js` (Electron) :
 *   - sortie dans `www/`, qui est le `webDir` lu par Capacitor ;
 *   - le binaire WebAssembly de sql.js est copié à la racine des assets, car
 *     sur mobile la base tourne dans la WebView et non dans le process Node ;
 *   - les modules Node auxquels sql.js se réfère sont neutralisés ;
 *   - pas de source map, pour ne pas alourdir l'APK de plusieurs mégaoctets.
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  target: 'web',
  entry: './src/index.jsx',
  output: {
    path: path.resolve(__dirname, 'www'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.jsx', '.js'],
    // sql.js teste la présence de ces modules pour détecter un environnement
    // Node ; sans ces alias, webpack échoue faute de polyfill.
    fallback: { fs: false, path: false, crypto: false },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.mobile.html',
      filename: 'index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'node_modules/sql.js/dist/sql-wasm.wasm', to: 'sql-wasm.wasm' },
      ],
    }),
  ],
  performance: { hints: false },
  devtool: false,
};
