const serverconfig = require('../serverconfig')
const webpack = require('webpack')
const wpFront = require('./webpack.config.client')
const wpBack = require('./webpack.config.server')
const WebpackNotifierPlugin = require('webpack-notifier')

wpBack.mode = 'development'
wpFront.mode = 'development'
wpFront.output.publicPath = (serverconfig.host || '') + '/bin/'
wpFront.plugins = [new WebpackNotifierPlugin()]

module.exports = [wpBack, wpFront]
process.traceDeprecation = true
