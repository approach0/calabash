const { dependencies } = require('./package.json')

var webpack = require('webpack')

/* HTML template engine */
const HtmlWebpackPlugin = require('html-webpack-plugin')

/* vue-loader 15 requires a webpack plugin to function */
const VueLoaderPlugin = require('vue-loader/lib/plugin')

/* listen port */
const PORT = 19985

module.exports = (env, options) => {
  const mode = options.mode;
  console.log(`[ this is ${mode} mode, listen port = ${PORT} ]`);
  return {
    /* default is development mode, run 'yarn run build' for production. */
    mode: mode,
    entry: { /* required field */
      app: __dirname + '/main.js'
    },
    output: { /* required field */
      filename: 'bundle.js'
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: { presets: ["@babel/preset-env"] }
          }
        },
        { test: /\.vue$/, use: 'vue-loader' },
        { test: /\.css$/, use: [
          'style-loader', 'css-loader',
          /* need both here to both inject the CSS and
           * convert CSS to JavaScript module. */
        ]},
        { test: /\.s(c|a)ss$/, use: [
          'vue-style-loader', 'css-loader',
          {
            loader: 'sass-loader',
            // Requires sass-loader@^7.0.0
            options: {
              implementation: require('sass'),
              fiber: require('fibers'),
              indentedSyntax: true // optional
            },
            // Requires sass-loader@^8.0.0
            options: {
              implementation: require('sass'),
              sassOptions: {
                fiber: require('fibers'),
                indentedSyntax: true // optional
              },
            },
          }

        ]},
        { test: /\.styl$/, use: [
          'style-loader', 'css-loader', 'stylus-loader'
        ]},
        {
          test: /\.(eot|woff|woff2|svg|ttf)([\?]?.*)$/,
          use: [{
            loader: 'file-loader',
            options: {
              outputPath: 'fonts/'
            }
          }]
        },
      {
      test: /\.(jpe?g|png|gif|svg)$/i,
          use: [{
            loader: 'file-loader',
            options: {
              esModule: false
            }
          }]
      }
      ]
    },
    resolve: {
      alias: {
        vue: 'vue/dist/vue.js'
      }
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: true,
        hash: true, /* cache busting */
        template: __dirname + '/index-template.html',
        filename: 'index.html' /* default goes to ./dist */
      }),
      new VueLoaderPlugin()
    ],
    devServer: {
      contentBase: __dirname + '/dist',
      port: PORT,
      historyApiFallback: true /* make history-mode routing possible */
    }
  };
}
