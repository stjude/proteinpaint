const WebpackNotifierPlugin = require('webpack-notifier')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const path = require('path')
const fs = require('fs')

module.exports = function getPortalConfig(env = {}) {
	const config = {
		mode: 'development', //env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'web',
		entry: path.join(__dirname, 'transformed/index.js'),
		output: {
			path: path.join(__dirname, 'bin'),
			publicPath: '__PP_URL__',
			filename: 'checkers.js',
			chunkLoadingGlobal: 'ppCheckersJsonp',
			// the library name exposed by this bundle
			library: 'ppcheckers',
			// the target context to which the library is 'attached' or assigned
			// e.g., window.checkers
			libraryTarget: 'window'
		},
		resolve: {
			/* TODO: select polyfills instead of using node-polyfill-webpack-plugin
			fallback: {
				//stream: false,
				//fs: false,
				path: require.resolve('path-browserify'),
				process: require.resolve('process')
			}*/
		},
		plugins: [new NodePolyfillPlugin()],
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
