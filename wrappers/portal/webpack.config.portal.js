module.exports = {
	target: 'web',
	mode: 'development',
	entry: './index.js',
	output: {
		path: __dirname + '/public/bin/',
		filename: 'portal.js',
		publicPath: '/bin/',
		jsonpFunction: 'ppJsonp',
		libraryTarget: 'umd',
		library: 'AReactApp'
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
				test: /.(js|jsx)$/,
				use: [
					{
						loader: 'babel-loader',
						options: {
							presets: ['@babel/preset-react'],
							plugins: ['syntax-dynamic-import']
						}
					}
				]
			}
		]
	},
	devtool: 'source-map'
}
