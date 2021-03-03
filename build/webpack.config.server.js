const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')
const path = require('path')

module.exports = function(env = 'production') {
	return {
		mode: env,
		target: 'node',
		externals: [nodeExternals({ allowlist: [/\/src\//] })],
		entry: path.join(__dirname, '../app.js'),
		output: {
			path: path.join(__dirname, '../'),
			filename: 'server.js'
		},
		module: {
			rules: [
				{
					test: /\.js$/,
					use: [
						{
							loader: 'babel-loader',
							options: { presets: [['es2015', { modules: false }]] }
						}
					]
				}
			]
		},
		devtool: env == 'development' ? 'source-map' : ''
	}
}
