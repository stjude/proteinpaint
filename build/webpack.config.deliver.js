const webpack = require('webpack')
const configfront = require('./webpack.config.client')
const configback = require('./webpack.config.server')()
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

configfront.optimization = {
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

configfront.output.publicPath = 'http://localhost:3000/bin/'
configfront.output.path = __dirname + '/../deploys/deliver/proteinpaint/public/bin/'

configback.optimization = {
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
configback.output.path = __dirname + '/../deploys/deliver/proteinpaint/'

module.exports = [configfront, configback]
