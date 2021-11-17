const clientConfigFxn = require('../webpack.config.js')
const path = require('path')
const fs = require('fs')
const glob = require('glob')

const entry = glob.sync('./src/**/*.spec.js').filter(filename => {
	return !filename.startsWith('./src/test/example')
})

module.exports = function(env = {}) {
	const config = clientConfigFxn(env)
	config.mode = 'development'
	config.entry = entry
	config.output = {
		path: path.join(__dirname, '../../public/bin'),
		publicPath: (env.url || '') + '/bin/',
		filename: 'spec.bundle.js',
		jsonpFunction: 'specJsonp'
	}

	// tape uses node's 'fs' module,
	// should avoid webpack error in bundling
	config.node = {
		fs: 'empty'
	}

	delete config.externals
	delete config.module.rules[1].exclude

	return config
}
