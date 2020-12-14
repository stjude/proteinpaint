const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')

module.exports = function(env = {}) {
	return {
		mode: env && env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'node',
		externals: [nodeExternals({ allowlist: [/\/src\//] })],
		entry: './app.js',
		output: {
			path: __dirname,
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
		}
	}
}
