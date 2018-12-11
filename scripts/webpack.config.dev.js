const webpack=require('webpack')
const config=require('../webpack.config')
const _c=require('../serverconfig')
const WebpackNotifierPlugin = require('webpack-notifier')

config.mode = 'development'
config.output.publicPath = (_c.host || 'http://localhost:3000') + '/bin/'

config.plugins=[
	new webpack.IgnorePlugin(/jquery/),
	new WebpackNotifierPlugin()
]

module.exports=config
process.traceDeprecation=true
