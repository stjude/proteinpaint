const webpack = require('webpack');
const config=require('../webpack.config');
const path = require('path');

module.exports = function(env) {

	//config.output.path= __dirname+'/../public/deliver'
	config.output.publicPath='https://pecan.stjude.org/pp/bin/'
	config.output.path=__dirname+'/../deploys/deliver/proteinpaint/public/bin/'

	config.plugins = [
		new webpack.optimize.UglifyJsPlugin({
	      mangle: true,
	      compress: {
	        warnings: false
	      }
	    }),
	    new webpack.optimize.OccurrenceOrderPlugin(),
	]

	delete config.devtool

	return config
}
