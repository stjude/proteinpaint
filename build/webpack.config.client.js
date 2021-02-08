const webpack = require('webpack')
const path = require('path')

module.exports = {
	target: 'web',
	mode: 'production', // default
	entry: path.join(__dirname, '/../src/app.js'),
	output: {
		path: path.join(__dirname, '/../public/bin'),
		filename: 'proteinpaint.js',
		publicPath: '/bin/',
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
						options: { presets: [['es2015', { modules: false }]], plugins: ['syntax-dynamic-import'] }
					}
				]
			}
		]
	},
	devtool: 'source-map'
}
