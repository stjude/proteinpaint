const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const path = require('path')
const fs = require('fs')
const { merge } = require('webpack-merge')
const webpack = require('webpack')

// TODO: delete webpack use, once esbuild migration is fully tested and unlikely to be reverted

let babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
babelrc = JSON.parse(babelrc)

const commonConfig = {
	mode: 'development',
	devtool: 'source-map',
	target: 'web',
	plugins: [
		new NodePolyfillPlugin(),
		new webpack.IgnorePlugin({
			resourceRegExp: /test\/internals.js$/
		})
	],

	module: {
		strictExportPresence: true,
		rules: [
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.(js|jsx|tsx|ts)$/,
				exclude: /\.spec.js$/,
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

module.exports = env => {
	const TEST_TYPE = env.TEST_TYPE || 'integration'
	switch (TEST_TYPE) {
		case 'unit':
			return merge(commonConfig, {
				entry: path.join(__dirname, './test/unitTestRunner.js'),
				output: {
					path: path.join(__dirname, '../public/bin'),
					publicPath: (env.url || '') + '/bin/',
					filename: 'unittest.js',
					chunkLoadingGlobal: 'ppJsonp',
					library: 'unittest',
					libraryExport: 'unittest',
					libraryTarget: 'window'
				},
				resolve: {
					extensions: ['*', '.js', '.jsx', '.tsx', '.ts']
				}
			})

		case 'integration':
			return merge(commonConfig, {
				entry: path.join(__dirname, './test/integrationTestRunner.js'),
				output: {
					path: path.join(__dirname, '../public/bin'),
					publicPath: (env.url || '') + '/bin/',
					filename: 'testrunproteinpaint.js',
					chunkLoadingGlobal: 'ppJsonp',
					library: 'testrunproteinpaint',
					libraryExport: 'testrunproteinpaint',
					libraryTarget: 'window'
				},
				resolve: {
					extensions: ['*', '.js', '.jsx', '.tsx', '.ts']
				}
			})

		default:
			throw new Error('No matching configuration was found!')
	}
}
