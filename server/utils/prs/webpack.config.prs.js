const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')
const path = require('path')

module.exports = function(env = {}) {
	return {
		mode: 'development',
		target: 'node',
		externals: [nodeExternals()],
		entry: path.join(__dirname, './source.js'),
		output: {
			path: path.join(__dirname, './'),
			filename: 'bin.js'
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
