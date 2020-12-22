const webpack = require('webpack')
const config = require('./webpack.config.client')
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = function(env) {
	config.output.publicPath = !env.url ? '/bin/' : env.url + '/bin/'
	config.output.path = __dirname + '/../public/bin'

	if (env.subdomain != 'ppr') {
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
	}

	delete config.devtool

	return config
}
