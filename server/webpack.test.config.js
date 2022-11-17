const path = require('path')
const baseConfig = require('./webpack.base.config')

module.exports = function(env = {}) {
	const config = baseConfig(env)
	config.mode = 'development'
	config.entry = path.join(__dirname, './test/context/' + env.exportsFilename)
	config.output = {
		path: path.join(__dirname, './'),
		filename: './test/serverTests.js'
	}
	return config
}
