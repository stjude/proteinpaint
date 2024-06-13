const WebpackNotifierPlugin = require('webpack-notifier')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const path = require('path')
const fs = require('fs')
const SpecHelpersWpPlugin = require('./test/specHelpers.js').SpecHelpersWpPlugin
const webpack = require('webpack')

// TODO: delete webpack use, once esbuild migration is fully tested and unlikely to be reverted

let babelrc
try {
	babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
	babelrc = JSON.parse(babelrc)
	const internalsFile = path.join(__dirname, './test/internals.js')
	if (!fs.existsSync(internalsFile)) {
		fs.writeFileSync(internalsFile, '')
	}
} catch (e) {
	throw e
}

module.exports = function (env = {}) {
	const config = {
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'web',
		entry: path.join(__dirname, './src/app.js'),
		output: {
			path: path.join(__dirname, '../public/bin'),
			publicPath: (env.url || '') + '/bin/',
			//filename: '[contenthash].proteinpaint.js',
			filename: 'proteinpaint.js',
			chunkLoadingGlobal: 'ppJsonp',
			// the library name exposed by this bundle
			library: 'runproteinpaint',
			// the exported value from the entry point file
			// here the runproteinpaint() function will be used as exported by ./src/app.js
			libraryExport: 'runproteinpaint',
			// the target context to which the library is 'attached' or assigned
			// e.g., window.runproteinpaint
			libraryTarget: 'window'
		},
		resolve: {
			extensions: ['*', '.js', '.jsx', '.tsx', '.ts']
		},
		plugins: [
			new NodePolyfillPlugin(),
			// ignore spec files by default
			new webpack.IgnorePlugin({
				resourceRegExp: /(.mjs|.spec.js)$/
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
					// by default, this rule will empty out internals.js,
					// so that no spec files are imported into it
					// and thus not bundled -- UNLESS this rule is
					// removed in mode=development
					test: path.join(__dirname, './test/internals.js'),
					use: [path.join(__dirname, './test/empty-wp-loader.js')]
				},
				{
					test: /\.(js|jsx|tsx|ts)$/,
					exclude: /\.spec\.js$/,
					use: [
						{
							loader: 'babel-loader',
							options: babelrc
						}
					]
				}
			]
		},
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'source-map' : false
	}

	/*** OVERRIDES ***/
	if (config.mode == 'development') {
		// allow react to be bundled
		delete config.externals

		config.plugins.push(new WebpackNotifierPlugin(), new SpecHelpersWpPlugin())
		// delete the ignore plugin for spec files
		{
			const i = config.plugins.findIndex(p => p && p instanceof webpack.IgnorePlugin)
			if (i !== -1) config.plugins.splice(i, 1)
		}

		// delete the rule that empties the ./test/internals.js code,
		// so that the app.testInternals() function will be functional
		{
			const i = config.module.rules.findIndex(
				r =>
					(typeof r.test == 'string' && r.test.includes('internals.js')) ||
					(r.test instanceof RegExp && r.test.test('internals.js'))
			)
			if (i !== -1) config.module.rules.splice(i, 1)
			const babelLoader = config.module.rules.find(r => r.use?.[0]?.loader == 'babel-loader')
			if (babelLoader) delete babelLoader.exclude
		}
	}
	if (config.mode != 'production') {
		// do not minify
		if (!config.optimization) config.optimization = {}
		config.optimization.minimizer = []
	}

	if (config.mode == 'production') {
		config.output['chunkFilename'] = '[name].[contenthash].proteinpaint.js'
	}

	return config
}
