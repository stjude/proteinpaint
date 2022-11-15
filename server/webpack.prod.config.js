const path = require('path')
const { merge } = require('webpack-merge')
const baseConfig = require('./webpack.base.config')

module.exports = function(env = {}) {
	return merge(baseConfig(env), {
		mode: 'production',
		entry: path.join(__dirname, './src/app.js'),
		output: {
			path: path.join(__dirname, './'),
			filename: 'server.js'
		},
		devtool: false,
		infrastructureLogging: {
			appendOnly: false,
			level: 'info'
		}
	})
}
