/*
	to bundle:
	cd proteinpaint # run at project root
	npx webpack --config=./utils/pnet/webpack.config.js
*/
const serverConfigFxn = require('../../server/webpack.config')
const nodeExternals = require('webpack-node-externals')
const path = require('path')

module.exports = function(env = {}) {
	const config = serverConfigFxn(env)
	config.entry = path.join(__dirname, './setterms.js')
	config.output = {
		path: path.join(__dirname, './'),
		filename: './setterms.bundle.js'
	}
	config.externals = [
		nodeExternals({
			allowlist: [path.join(__dirname, '../../server/src'), path.join(__dirname, '../../server/shared')]
		})
	]
	return config
}
