const serverConfigFxn = require('../../server/webpack.config')
const nodeExternals = require('webpack-node-externals')
const path = require('path')

module.exports = function(env = {}) {
	const config = serverConfigFxn(env)
	;(config.entry = './setterms.js'),
		(config.output = {
			path: path.join(__dirname, './'),
			filename: './setterms.bundle.js'
		})
	config.externals = [
		nodeExternals({
			allowlist: [path.join(__dirname, '../../server/src'), path.join(__dirname, '../../server/shared')]
		})
	]
	return config
}
