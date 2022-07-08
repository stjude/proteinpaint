const wpServer = require('../server/webpack.config.js')
const WebpackNotifierPlugin = require('webpack-notifier')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const path = require('path')
const fs = require('fs')

function getPortalConfig(env = {}) {
	const config = {
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'web',
		entry: './index.js',
		output: {
			path: path.join(__dirname, '../public/bin'),
			publicPath: (env.url || '') + '/bin/',
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
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'source-map' : false
	}

	/*** OVERRIDES ***/
	if (config.mode != 'production') {
		// do not minify
		if (!config.optimization) config.optimization = {}
		config.optimization.minimizer = []
	}

	return config
}

module.exports = [wpServer, getPortalConfig]
process.traceDeprecation = true
