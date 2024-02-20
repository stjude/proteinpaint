const path = require('path')
const { merge } = require('webpack-merge')
const nodeExternals = require('webpack-node-externals')
const fs = require('fs')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

let babelrc
try {
	babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
	babelrc = JSON.parse(babelrc)
	if (process.env.PP_MODE?.startsWith('container')) {
		babelrc.presets[0][1].targets.node = 20
	}
} catch (e) {
	throw e
}

const commonConfig = {
	// see https://v4.webpack.js.org/configuration/mode/
	//
	// note that webpack applies commonly used plugins
	// by mode, such as the terser plugin to
	// minify production bundles, so there are less
	// manual configuration settings needed here
	//

	target: 'node',
	externals: [
		nodeExternals({
			allowlist: [/\/src\//, /d3-*/, 'internmap', 'delaunator', 'robust-predicates', '@sjcrh/augen'],
			additionalModuleDirs: [
				path.resolve(__dirname, '../node_modules'),
				path.resolve(__dirname, '../../node_modules'),
				path.resolve(__dirname, '../../../node_modules')
			]
		})
	],
	externalsPresets: {
		node: true
	},
	infrastructureLogging: {
		appendOnly: false,
		level: 'info'
	},
	module: {
		strictExportPresence: true,
		rules: [
			{
				test: /\.(js|jsx|tsx|ts)$/,
				use: [
					{
						loader: 'babel-loader',
						options: babelrc
					}
				]
			}
		]
	},
	resolve: {
		extensions: ['.js', '.jsx', '.ts', '.tsx']
	}
}

module.exports = env => {
	const NODE_ENV = env.NODE_ENV || 'production'
	switch (NODE_ENV) {
		case 'production':
			return merge(commonConfig, {
				mode: 'production',
				entry: path.join(__dirname, './src/run.js'),
				output: {
					path: path.join(__dirname, './'),
					filename: 'server.js'
				},
				plugins: [
					// ignore spec files by default
					new webpack.IgnorePlugin({
						resourceRegExp: /\.(spec|md)$/gi
					})
				],
				optimization: {
					minimizer: [
						new TerserPlugin({
							extractComments: false,
							terserOptions: {
								format: {
									comments: false
								}
							}
						})
					]
				},
				devtool: 'source-map'
			})

		case 'development':
			return merge(commonConfig, {
				mode: 'development',
				entry: path.join(__dirname, './src/run.js'),
				output: {
					path: path.join(__dirname, './'),
					filename: 'server.js'
				},
				plugins: [
					// ignore spec files by default
					new webpack.IgnorePlugin({
						resourceRegExp: /\.md$/gi
					})
				],
				optimization: {
					emitOnErrors: true
				},
				// see https://v4.webpack.js.org/configuration/devtool/ for option details
				//
				// devtool: 'eval' is fastest to build/rebuild, no files are written,
				// but the line number in stack traces may be a little bit off
				//
				// devtool: 'source-map' is slowest to build/rebuild, but
				// line numbers in stack traces are accurate
				//
				devtool: 'source-map'
			})

		case 'test':
			// process.env variable can override webpack specific variable for exportsFilename
			const exportsFile = process.env.exportsFilename || './test/context/' + env.exportsFilename
			return merge(commonConfig, {
				mode: 'development',
				entry: path.join(__dirname, exportsFile),
				output: {
					path: path.join(__dirname, './'),
					filename: './test/serverTests.js'
				}
			})
		default:
			throw new Error('No matching configuration was found!')
	}
}
