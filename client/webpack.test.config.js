const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const path = require('path')
const fs = require('fs')

babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
babelrc = JSON.parse(babelrc)

module.exports = function(env = {}) {
	return {
		mode: 'development',
		target: 'web',
		entry: path.join(__dirname, './test/appTestRunner.js'),
		output: {
			path: path.join(__dirname, '../public/bin'),
			publicPath: (env.url || '') + '/bin/',
			filename: 'testrunproteinpaint.js',
			chunkLoadingGlobal: 'ppJsonp',
			library: 'testrunproteinpaint',
			libraryExport: 'testrunproteinpaint',
			libraryTarget: 'window'
		},
		plugins: [new NodePolyfillPlugin()],

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
}
