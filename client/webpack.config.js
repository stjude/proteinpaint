const WebpackNotifierPlugin = require('webpack-notifier')
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin')
const path = require('path')
const fs = require('fs')
const SpecHelpersWpPlugin = require('./test/specHelpers.js').SpecHelpersWpPlugin

let babelrc
try {
	babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
	babelrc = JSON.parse(babelrc)
} catch (e) {
	throw e
}

const internalsFile = path.join(__dirname, './test/internals.js')
if (!fs.existsSync(internalsFile)) {
	fs.writeFileSync(internalsFile)
}

module.exports = function(env = {}) {
	const config = {
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'web',
		entry: path.join(__dirname, './src/app.js'),
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
		externals: {
			react: 'React',
			'react-dom': 'ReactDOM'
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
		},
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'source-map' : false
	}

	/*** OVERRIDES ***/
	if (config.mode == 'development') {
		config.plugins.push(new WebpackNotifierPlugin(), new SpecHelpersWpPlugin())
		// allow react to be bundled
		delete config.externals
		// delete the rule that empties the ./test/internals.js code,
		// so that the app.testInternals() function will be functional
		config.module.rules.splice(1, 1)
		delete config.module.rules[1].exclude
	}
	if (config.mode != 'production') {
		// do not minify
		if (!config.optimization) config.optimization = {}
		config.optimization.minimizer = []
	}

	return config
}
