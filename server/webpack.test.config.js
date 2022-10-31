const nodeExternals = require('webpack-node-externals')
const path = require('path')
const fs = require('fs')

const babelrc = require('./utils/babel/readBabelConfig').readBabelConfig(__dirname, 16)

module.exports = function(env = {}) {
	const config = {
		mode: 'development',
		target: 'node',
		entry: path.join(__dirname, './test/internals.js'),
		externals: [
			nodeExternals({
				allowlist: [/\/src\//, /d3-*/],
				additionalModuleDirs: [path.resolve(__dirname, '../node_modules')]
			})
		],
		externalsPresets: {
			node: true
		},
		output: {
			path: path.join(__dirname, './'),
			filename: './test/serverTests.js'
		},
		module: {
			strictExportPresence: true,
			rules: [
				{
					test: /\.js$/,
					exclude: /\.spec\.js$/,
					use: [
						{
							loader: 'babel-loader',
							options: babelrc
						}
					]
				}
			]
		}
	}
	return config
}
