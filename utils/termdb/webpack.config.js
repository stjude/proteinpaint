const nodeExternals = require('webpack-node-externals')
const path = require('path')

/*
bundling command:

$ ../../node_modules/.bin/webpack --config=webpack.config.js
*/

module.exports = {
	mode: 'development',
	target: 'node',
	entry: path.join(__dirname, './buildTermdb.js'),
	output: {
		path: path.join(__dirname, './'),
		filename: 'buildTermdb.bundle.js'
	},
	externals: [nodeExternals()],
	module: {
		rules: [
			{
				test: /\.js$/,
				use: [
					{
						loader: 'babel-loader',
						options: {
							babelrc: false,
							presets: [['@babel/preset-env', { targets: { node: '12' } }]]
						}
					}
				]
			}
		]
	}
	//devtool: 'source-map'
}
