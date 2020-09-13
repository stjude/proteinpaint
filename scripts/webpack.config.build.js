const webpack = require('webpack')
const config = require('../webpack.config')
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = function(env) {
	config.output.publicPath = !env.subdomain ? '/bin' : 'https://' + env.subdomain + '.stjude.org/bin'
	config.output.path = __dirname + '/../public/bin'

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

	delete config.devtool

	return config
}
