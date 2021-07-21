const WebpackNotifierPlugin = require('webpack-notifier')
const path = require('path')

module.exports = function(env = {}) {
	const publicPath = (env.url || '') + '/bin/'
	const outputPath = path.join(__dirname, '../public/bin')

	const config = {
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'web',
		entry: path.join(__dirname, './src/app.js'),
		output: {
			path: outputPath,
			publicPath,
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
			rules: [
				/*
			{
				test:/\.js$/,
				exclude:/node_modules/,
				loader:'babel-loader',
			},
			*/
				{
					test: /\.css$/,
					use: [
						{
							loader: 'style-loader'
						},
						{
							loader: 'css-loader'
						}
					]
				},

				{
					test: /\.js$/,
					use: [
						{
							loader: 'babel-loader',
							options: {
								plugins: ['@babel/syntax-dynamic-import']
							}
						}
					]
				}
			]
		},
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'source-map' : ''
	}

	if (config.mode == 'development') {
		config.plugins = [new WebpackNotifierPlugin()]
	}
	if (config.mode != 'production') {
		// do not minify
		if (!config.optimization) config.optimization = {}
		config.optimization.minimizer = []
	}

	return config
}
