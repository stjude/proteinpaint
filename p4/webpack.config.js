const path = require('path')


module.exports = {
	entry:'./src/app.js',
	output:{
		path: path.resolve(__dirname, 'public/bin'),
		publicPath:'/bin/', // required for import() to work
		filename:'proteinpaint.js',
	},
	
	module: {
		rules: [
			{ test: /\.css$/, use: [ {loader:'style-loader'}, {loader:'css-loader'}] },
			{
				test: /\.js$/,
				use: [{
					loader: 'babel-loader',
					options: { presets: [['es2015', {modules: false}]], plugins: ['syntax-dynamic-import'] }
				}]
			}
		]
	},

	devtool:'source-map',
	mode:'development',
}
