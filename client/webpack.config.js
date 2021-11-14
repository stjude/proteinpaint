const WebpackNotifierPlugin = require('webpack-notifier')
const path = require('path')
const fs = require('fs')

let babelrc
try {
	babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
	babelrc = JSON.parse(babelrc)
} catch (e) {
	throw e
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
			jsonpFunction: 'ppJsonp',
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
		module: {
			strictExportPresence: true,
			rules: [
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader']
				},
				{
					// will remove this rule in development mode
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
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'source-map' : ''
	}

	if (config.mode == 'development') {
		config.plugins = [new WebpackNotifierPlugin()]
		// delete the rule that empties the test internals code,
		// so that selected internals may be exposed during development or testing
		config.module.rules.splice(1, 1)
	}
	if (config.mode != 'production') {
		// do not minify
		if (!config.optimization) config.optimization = {}
		config.optimization.minimizer = []
	}

	return config
}
