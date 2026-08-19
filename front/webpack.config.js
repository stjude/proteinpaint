const path = require('path')
const fs = require('fs')
const webpack = require('webpack')

// TODO: delete webpack use, once esbuild migration is fully tested and unlikely to be reverted
// as of 1/24/2025: still using webpack since esbuild chunks are still too granular,
// while webpack is able to combine more related code into one for less code downloads;
// will re-investigate using esbuild when future versions results in less bundle chunks

module.exports = function getPortalConfig(env = {}) {
	// TODO: webpack hot reload/rebundling on code change sometimes do not persist the env.NODE_ENV
	// that is supplied on initial bundling call - fix this later
	const mode = env.NODE_ENV ? env.NODE_ENV : 'production'
	const config = {
		mode,
		target: 'web',
		entry: './src/index.js',
		output: {
			path: path.join(__dirname, 'public/bin'),
			publicPath: mode === 'production' ? '__PP_URL__' : '/bin/front/',
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
			// explicit, scoped polyfills only for what this bundle actually needs -- verified
			// by removing node-polyfill-webpack-plugin's blanket polyfilling entirely and
			// confirming no other Node builtin is required (webpack raised no "Can't resolve"
			// errors for anything else)
			fallback: {
				buffer: require.resolve('buffer/')
				// You might need fallbacks for other Node.js modules too, e.g., "stream": require.resolve("stream-browserify")
				// stream: false,
				// fs: false,
				// path: require.resolve('path-browserify'),
				// process: require.resolve('process')
			}
		},
		plugins: [
			new webpack.ProvidePlugin({
				Buffer: ['buffer', 'Buffer']
			})
		],
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
