const clientConfigFxn = require('../webpack.config.js')
const path = require('path')
const fs = require('fs')

module.exports = function(env = {}) {
	const config = clientConfigFxn(env)
	config.mode = 'development'
	config.entry = path.join(__dirname, '../src/common/test/termsetting.spec.js')
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

	return config
}
