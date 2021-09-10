const nodeExternals = require('webpack-node-externals')

module.exports = {
	mode: 'development',
	target: 'node',
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
	},
	devtool: 'source-map'
}
