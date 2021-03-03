const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')
const path = require('path')

module.exports = function(env = {}) {
	// the env object is passed to webpack cli call by
	// adding --env.NODE_ENV='...', --env.devtool='...', etc
	return {
		// see https://v4.webpack.js.org/configuration/mode/
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
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
		// see https://v4.webpack.js.org/configuration/devtool/
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'eval' : ''
	}
}
