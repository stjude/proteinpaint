const WebpackNotifierPlugin = require('webpack-notifier')
const path = require('path')
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
					test: /\.js$/,
					use: [
						{
							loader: 'babel-loader',
							// TODO: figure out why .babelrc is not being used by webpack during build/deploy
							// babel-loader respects .babelrc, so no need to specify presets and plugins here
							options: {
								presets: [['@babel/preset-env', { loose: true }]],
								plugins: [
									'@babel/plugin-proposal-optional-chaining',
									'@babel/plugin-syntax-dynamic-import',
									'@babel/plugin-transform-runtime'
								]
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
