const nodeExternals = require('webpack-node-externals')
const path = require('path')
module.exports = {
	mode: 'development',
	target: 'node',
	//externals: [nodeExternals()],
	externals: [
		nodeExternals({
			allowlist: [/\/src\//, 'node-fetch'],
			additionalModuleDirs: [path.resolve(__dirname, '../../node_modules')]
		})
	],
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
	},
	devtool: 'source-map'
}
