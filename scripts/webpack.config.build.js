const webpack = require('webpack');
const config=require('../webpack.config');
const path = require('path');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = function(env) {
	const protocol=env.subdomain=='pp-test' ? '' : 'https:'
	if (env.nopolyfill) {
		config.output.path= __dirname+'/../public/builds/'+(env.subdomain?env.subdomain:'proteinpaint')+'/no-babel-polyfill'
		
		config.output.publicPath=protocol+'//'+(env.subdomain?env.subdomain:'proteinpaint')+'.stjude.org/no-babel-polyfill/'
		if (!config.resolve) config.resolve={}
		if (!config.resolve.alias) config.resolve.alias={}
		config.resolve.alias['babel-polyfill']='empty-module'
	}
	else {
		const urlpath=env.subdomain.startsWith('pecan') || env.subdomain.startsWith('pp-prt') ? 'pp/bin/' : 'bin/';
		config.output.publicPath=protocol+'//'+(env.subdomain?env.subdomain:'pecan-test')+'.stjude.org/'+ urlpath;
		config.output.path= __dirname+'/../public/builds/'+(env.subdomain?env.subdomain:'pecan-test')
	}

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
