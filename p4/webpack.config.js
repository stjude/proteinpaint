const path = require('path')


module.exports = {
	entry:'./src/app.js',
	output:{
		path: path.resolve(__dirname, 'public/bin'),
		filename:'proteinpaint.js'
	},
	
	module: {
		rules: [
			{ test: /\.css$/, use: [ {loader:'style-loader'}, {loader:'css-loader'}] }
		]
	},

	devtool:'source-map',
	mode:'development',
}
