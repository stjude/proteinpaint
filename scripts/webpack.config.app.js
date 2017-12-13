/*
This generic webpack config is meant for stand-alone 
apps such as pc.chord, tsv.chord, tsv.survival, etc.

Example usage:
See package.json: {scripts: {tsvchord: }}}
*/


const webpack=require('webpack')
const path = require('path');


module.exports=function(env){
	if (!env.app) env.app='unknownSub'
	if (!env.target) env.target='public-stage'

	const config={
		entry:'./src/charts/'+env.app+'.js',
		output:{
			path: __dirname+'/../public/bin',
			filename:'proteinpaint.'+env.app+'.js',
			publicPath:'/bin/',
			jsonpFunction: 'ppJsonp'+env.app
		},

		module:{
			rules:[{
				test:/\.js$/,
				exclude:/node_modules/,
				loader:'babel-loader',
			},{
				test:/\.css$/,
				use: [{
					loader: "style-loader"
				},{
					loader: "css-loader"
				}]
			}]
		},

		devtool:'source-map',
			
		plugins: [
			new webpack.IgnorePlugin(/jquery/)
		]
	}

	if (env.target=='public-stage' || env.target=='public-prod') {
		/*delete config.devtool
		config.plugins=[
		 	new webpack.optimize.UglifyJsPlugin({
		      mangle: true,
		      compress: {
		        warnings: false
		      }
		    }),
		    new webpack.optimize.OccurrenceOrderPlugin()
		]*/
	}
	else {
		config.plugins.push([
			new webpack.IgnorePlugin(/jquery/),
			new BrowserSyncPlugin({
		    	host: 'localhost', // todo replace this with your hostname
		       port: 3007,
		       proxy: 'http://localhost:3000/',
		       //server: { baseDir: ['public'] }
		    }),
			new WebpackNotifierPlugin()
		])
	}

	return config
}
