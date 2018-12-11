const webpack = require('webpack');
const config=require('../webpack.config');
const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')


config.optimization = {
	minimizer: [
		new UglifyJsPlugin({
			cache: true,
			parallel: true,
			uglifyOptions: {
				mangle: true,
				compress: true
			}
		})
	]
}



config.output.publicPath='http://localhost:3000/bin/'
config.output.path=__dirname+'/../deploys/deliver/proteinpaint/public/bin/'




module.exports = config
