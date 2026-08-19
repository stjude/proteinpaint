const WebpackNotifierPlugin = require('webpack-notifier')
const path = require('path')
const fs = require('fs')

module.exports = function getPortalConfig(env = {}) {
	const entry = env.entry || path.join(__dirname, 'test/checkers/index.ts')
	const outdir = env.outdir || path.join(__dirname, 'public/bin')
	const config = {
		mode: 'development', //env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'web',
		entry,

		experiments: {
			outputModule: true
		},

		output: {
			module: true,
			path: outdir,
			publicPath: '__PP_URL__',
			filename: 'checkers.js',
			chunkLoadingGlobal: 'ppCheckersJsonp',
			// the library name exposed by this bundle
			library: {
				name: 'ppcheckers',
				type: 'module'
			},
			// the target context to which the library is 'attached' or assigned
			// e.g., window.checkers
			libraryTarget: 'window'
		},
		resolve: {
			// node-polyfill-webpack-plugin removed: verified (with a synthetic entry
			// matching the typia-generated checker code's shape -- pure runtime
			// type-guard logic on plain objects, no Node builtins) that this bundle
			// needs no polyfills at all
		},
		plugins: [],
		module: {
			strictExportPresence: true,
			rules: [
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader']
				}
			]
		},
		devtool: 'source-map' //env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'source-map' : false
	}

	/*** OVERRIDES ***/
	if (config.mode != 'production') {
		// do not minify
		if (!config.optimization) config.optimization = {}
		config.optimization.minimizer = []
	}

	return config
}

process.traceDeprecation = true
