const webpack=require('webpack')
const config=require('../webpack.config')
const WebpackNotifierPlugin = require('webpack-notifier')
const BrowserSyncPlugin = require('browser-sync-webpack-plugin')

// used by edgar

config.output.publicPath='//localhost:3007/bin/'

config.plugins=[
	new webpack.IgnorePlugin(/jquery/),
	new BrowserSyncPlugin({
    	host: 'localhost', // todo replace this with your hostname
       //https: true,
       port: 3007,
       proxy: 'http://localhost:3000/',
       //server: { baseDir: ['public'] }
    }),
	new WebpackNotifierPlugin()
]

module.exports=config
