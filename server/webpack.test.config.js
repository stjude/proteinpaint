const path = require('path')
const baseConfig = require('./webpack.base.config')
const { merge } = require('webpack-merge')

module.exports = function(env = {}) {
	return merge(baseConfig(env), {
		mode: 'development',
		entry: path.join(__dirname, './test/context/' + env.exportsFilename),
		output: {
			path: path.join(__dirname, './'),
			filename: './test/serverTests.js'
		}
	})
}
