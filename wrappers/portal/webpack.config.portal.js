module.exports = {
	target: 'web',
	mode: 'development', // default
	entry: './index.js',
	output: {
		path: __dirname + '/public/bin/',
		filename: 'portal.js',
		publicPath: '/bin/',
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
