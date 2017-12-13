const webpack=require('webpack')
var WebpackNotifierPlugin = require('webpack-notifier')
var BrowserSyncPlugin = require('browser-sync-webpack-plugin')

// used by edgar, the sqlite server is not used
// so this will not support POSTs or any server requests
// that are handled by the proteinpaint node server

const config={
	entry:'./src/app.hm2.js',
	output:{
		path:'./public/bin',
		filename:'proteinpaint.hm2.js',
		publicPath:'/bin/',
		jsonpFunction: 'pphm2Jsonp'
	},
	module:{
		loaders:[
			{
			test:/\.js$/,
			exclude:/node_modules/,
			loader:'babel-loader',
			},
			{
			test:/\.css$/,
			loader:'style!css'
			},
		]
	},
	devtool:'source-map',
		
	plugins:[
		new webpack.IgnorePlugin(/jquery/)
	]
}


config.plugins=[
	new webpack.IgnorePlugin(/jquery/),
	new BrowserSyncPlugin({
    	host: 'localhost', // todo replace this with your hostname
       port: 3017,
       //proxy: 'http://localhost:3000/',
       server: { baseDir: ['public'] }
    }),
	new WebpackNotifierPlugin()
]

module.exports=config
