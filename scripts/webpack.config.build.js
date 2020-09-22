const webpack = require('webpack')
const config = require('../webpack.config')
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = function(env) {
	const protocol = !env.subdomain ? '' : 'https:'
	config.output.publicPath = !env.subdomain ? '/bin/' : 'https://' + env.subdomain + '.stjude.org/bin/'
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
