const webpack = require('webpack')
const path = require('path')
const nodeExternals=require('webpack-node-externals')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports={
  target: 'node',
  externals: [nodeExternals()],
  entry: './server.min.js',
  output: {
    path: __dirname+'/../pp-server',
    filename: 'server.js',
  },
  module: {
    rules: [{
      test: /\.js$/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['env', {
              'targets': {
                'node': 'current'
              }
            }]
          ]
        }
      }
    }]
  }
}
