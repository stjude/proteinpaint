const path = require('path')


module.exports = {
	entry:'./src/app.js',
	output:{
		path: path.resolve(__dirname, 'public/bin'),
		filename:'proteinpaint.js'
	},
	
	module: {
		rules: [
			{ test: /\.css$/, use: 'css-loader' }
		]
	},

	mode:'development',
}
