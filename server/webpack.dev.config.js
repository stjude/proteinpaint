const path = require('path')
const { merge } = require('webpack-merge')
const baseConfig = require('./webpack.base.config')

module.exports = function(env = {}) {
	return merge(baseConfig(env), {
		mode: 'development',
		entry: path.join(__dirname, './src/app.js'),
		output: {
			path: path.join(__dirname, './'),
			filename: 'server.js'
		},
		// see https://v4.webpack.js.org/configuration/devtool/ for option details
		//
		// devtool: 'eval' is fastest to build/rebuild, no files are written,
		// but the line number in stack traces may be a little bit off
		//
		// devtool: 'source-map' is slowest to build/rebuild, but
		// line numbers in stack traces are accurate
		//
		devtool: 'source-map',
		infrastructureLogging: {
			appendOnly: false,
			level: 'info'
		}
	})
}
