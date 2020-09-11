const webpack = require('webpack')
const config = require('../webpack.config')
const path = require('path')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = function(env) {
	const protocol = env.subdomain == 'pp-test' ? '' : 'https:'
	const urlpath = env.subdomain.startsWith('pecan') || env.subdomain.startsWith('pp-prt') ? 'pp/bin/' : 'bin/'
	config.output.publicPath =
		env.subdomain == 'dist'
			? urlpath
			: protocol + '//' + (env.subdomain ? env.subdomain : 'pecan-test') + '.stjude.org/' + urlpath
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
