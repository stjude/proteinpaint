const webpack = require('webpack');
const config=require('../webpack.config');
const path = require('path'); 

module.exports = function(env) {
	if (env.nopolyfill) {
		config.output.path= __dirname+'/../public/builds/'+(env.subdomain?env.subdomain:'proteinpaint')+'/no-babel-polyfill'
		config.output.publicPath='https://'+(env.subdomain?env.subdomain:'proteinpaint')+'.stjude.org/no-babel-polyfill/'
		if (!config.resolve) config.resolve={}
		if (!config.resolve.alias) config.resolve.alias={}
		config.resolve.alias['babel-polyfill']='empty-module'
	}
	else {
		const urlpath=env.subdomain.startsWith('pecan') || env.subdomain.startsWith('pp-prt') ? 'pp/bin/' : 'bin/';
		config.output.publicPath='https://'+(env.subdomain?env.subdomain:'pecan-test')+'.stjude.org/'+ urlpath;
		config.output.path= __dirname+'/../public/builds/'+(env.subdomain?env.subdomain:'pecan-test')
	}

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
