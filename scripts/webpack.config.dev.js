const webpack=require('webpack')
const config=require('../webpack.config')

const _c=require('../serverconfig')

config.output.publicPath = (_c.host || 'http://localhost:3000') + '/bin/'

var WebpackNotifierPlugin = require('webpack-notifier')
//var BrowserSyncPlugin = require('browser-sync-webpack-plugin')

config.plugins=[
	new webpack.IgnorePlugin(/jquery/),
	/*
	new BrowserSyncPlugin({
    	host: 'localhost', // todo replace this with your hostname
       port: 3000,
       //server: { baseDir: ['public'] },
	   proxy:'http://localhost:3000/'
     }),
	 */
	new WebpackNotifierPlugin()
]

module.exports=config
process.traceDeprecation=true
