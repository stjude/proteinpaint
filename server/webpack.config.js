const path = require('path')
const { merge } = require('webpack-merge')
const nodeExternals = require('webpack-node-externals')
const fs = require('fs')
const TerserPlugin = require('terser-webpack-plugin')

let babelrc
try {
	babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
	babelrc = JSON.parse(babelrc)
	if (process.env.PP_MODE?.startsWith('container')) {
		babelrc.presets[0][1].targets.node = 16
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
			allowlist: [/\/src\//, /d3-*/, 'internmap', 'delaunator', 'robust-predicates'],
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
	}
}

module.exports = env => {
	const NODE_ENV = env.NODE_ENV || 'production'
	switch (NODE_ENV) {
		case 'production':
			return merge(commonConfig, {
				mode: 'production',
				entry: path.join(__dirname, './src/app.js'),
				output: {
					path: path.join(__dirname, './'),
					filename: 'server.js'
				},
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
				resolve: {
					extensions: ['.js', '.jsx', '.ts', '.tsx']
				}
			})

		case 'development':
			return merge(commonConfig, {
				mode: 'development',
				entry: path.join(__dirname, './src/app.js'),
				output: {
					path: path.join(__dirname, './'),
					filename: 'server.js'
				},
				// see https://v4.webpack.js.org/configuration/devtool/ for option details
				//
				// devtool: 'eval' is fastest to build/rebuild, no files are written,
				// but the line number in stack traces may be a little bit off
				//
				// devtool: 'source-map' is slowest to build/rebuild, but
				// line numbers in stack traces are accurate
				//
				devtool: 'source-map',
				resolve: {
					extensions: ['.js', '.jsx', '.ts', '.tsx']
				}
			})

		case 'test':
			return merge(commonConfig, {
				mode: 'development',
				entry: path.join(__dirname, './test/context/' + env.exportsFilename),
				output: {
					path: path.join(__dirname, './'),
					filename: './test/serverTests.js'
				}
			})
		default:
			throw new Error('No matching configuration was found!')
	}
}
