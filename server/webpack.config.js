const path = require('path')
const baseConfig = require('./webpack.base.config')

module.exports = function(env = {}) {
	const config = baseConfig(env)
	config.entry = path.join(__dirname, './src/app.js')
	config.output = {
		path: path.join(__dirname, './'),
		filename: 'server.js'
	}
	// see https://v4.webpack.js.org/configuration/devtool/ for option details
	//
	// devtool: 'eval' is fastest to build/rebuild, no files are written,
	// but the line number in stack traces may be a little bit off
	//
	// devtool: 'source-map' is slowest to build/rebuild, but
	// line numbers in stack traces are accurate
	//
	config.devtool = env.devtool ? env.devtool : env.NODE_ENV === 'development' ? 'source-map' : false
	config.infrastructureLogging = {
		appendOnly: false,
		level: 'info'
	}
	return config
}
