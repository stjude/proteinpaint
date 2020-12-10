module.exports = {
	target: 'web',
	mode: 'development',
	entry: './proteinpaint.js',
	output: {
		path: __dirname + '/dist',
		filename: 'proteinpaint.js',
		publicPath: '/react/dist/',
		jsonpFunction: 'ppJsonp',
		libraryTarget: 'umd',
		library: 'testWrapper'
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
