module.exports = {
	target: 'web',
	mode: 'development',
	entry: './index.jsx',
	output: {
		path: __dirname + '/dist',
		filename: 'proteinpaint.js',
		//publicPath:'/bin/',
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
							presets: ['@babel/preset-env', '@babel/preset-react'],
							plugins: ['syntax-dynamic-import']
						}
					}
				]
			}
		]
	},
	devtool: 'source-map'
}
