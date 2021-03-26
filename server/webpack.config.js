const nodeExternals = require('webpack-node-externals')
const webpack = require('webpack')
const path = require('path')

module.exports = function(env = {}) {
	// the env object is passed to webpack cli call by
	// adding --env.NODE_ENV='...', --env.devtool='...', etc
	return {
		// see https://v4.webpack.js.org/configuration/mode/
		//
		// note that webpack applies commonly used plugins
		// by mode, such as the terser plugin to
		// minify production bundles, so there are less
		// manual configuration settings needed here
		//
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
		target: 'node',
		externals: [nodeExternals({ 
			allowlist: [/\/src\//]
		})],
		entry: path.join(__dirname, './src/app.js'),
		output: {
			path: path.join(__dirname, './'),
			filename: 'server.js'
		},
		module: {
			rules: [
				{
					test: /\.js$/,
					use: [
						{
							loader: 'babel-loader',
							options: { presets: [['es2015', { modules: false }]] }
						}
					]
				}
			]
		},
		// see https://v4.webpack.js.org/configuration/devtool/ for option details
		//
		// devtool: 'eval' is fastest to build/rebuild, no files are written,
		// but the line number in stack traces may be a little bit off
		//
		// devtool: 'source-map' is slowest to build/rebuild, but
		// line numbers in stack traces are accurate
		//
		devtool: env.devtool ? env.devtool : env.NODE_ENV == 'development' ? 'eval' : ''
	}
}
