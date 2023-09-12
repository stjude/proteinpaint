const path = require('path')
const { merge } = require('webpack-merge')
const nodeExternals = require('webpack-node-externals')
const fs = require('fs')
const TerserPlugin = require('terser-webpack-plugin')

let babelrc
try {
	babelrc = fs.readFileSync(path.join(__dirname, '../.babelrc'))
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
			allowlist: [/\/src\//, /d3-*/, 'internmap', 'delaunator', 'robust-predicates', '@sjcrh/augen'],
			additionalModuleDirs: [
				path.resolve(__dirname, '../node_modules'),
				path.resolve(__dirname, '../../node_modules'),
				path.resolve(__dirname, '../../../node_modules'),
				path.resolve(__dirname, '../../../../node_modules'),
				path.resolve(__dirname, '../../../../../node_modules')
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
	return merge(commonConfig, {
		mode: 'production',
		entry: path.join(__dirname, './emitPrepFiles.js'),
		output: {
			path: __dirname,
			filename: 'emitPrepFiles.bundle.js'
		}
		// see https://v4.webpack.js.org/configuration/devtool/ for option details
		//
		// devtool: 'eval' is fastest to build/rebuild, no files are written,
		// but the line number in stack traces may be a little bit off
		//
		// devtool: 'source-map' is slowest to build/rebuild, but
		// line numbers in stack traces are accurate
		//
		// devtool: 'source-map'
	})
}
