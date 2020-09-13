const webpack = require('webpack')
const config = require('../webpack.config')
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = function(env) {
	const protocol = !env.subdomain ? '' : 'https:'
	config.output.publicPath = !env.subdomain ? '/bin' : protocol + '//' + env.subdomain + '.stjude.org/bin'
	config.output.path = __dirname + '/../public/builds/' + (env.subdomain ? env.subdomain : 'pecan-test')

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
