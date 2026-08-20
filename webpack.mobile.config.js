/**
 * Build du renderer pour Android (Capacitor).
 *
 * Différences avec `webpack.config.js` (Electron) :
 *   - sortie dans `www/`, qui est le `webDir` lu par Capacitor ;
 *   - le binaire WebAssembly de sql.js est intégré au bundle, la WebView
 *     refusant de le servir par fetch() depuis l'origine https://localhost ;
 *   - les modules Node auxquels sql.js se réfère sont neutralisés ;
 *   - pas de source map, pour ne pas alourdir l'APK de plusieurs mégaoctets.
 */

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

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
      {
        // Émis en data URI plutôt qu'en fichier séparé : le module est ainsi
        // remis à sql.js en mémoire, sans requête réseau ni contrainte de CSP.
        test: /sql-wasm\.wasm$/,
        type: 'asset/inline',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.mobile.html',
      filename: 'index.html',
    }),
  ],
  performance: { hints: false },
  devtool: false,
};
