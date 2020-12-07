const pkg = require('./package.json')

module.exports = {
	target: 'web',
	mode: 'production', // default
	entry: '../../src/app.js',
	output: {
		path: __dirname + '/dist/',
		filename: pkg.main,
		//publicPath:'/bin/',
		jsonpFunction: 'ppJsonp',
		libraryTarget: 'umd'
	},
	module: {
		rules: [
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
