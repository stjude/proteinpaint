const webpack=require('webpack')
const config=require('../webpack.config')

const _c=require('../serverconfig')

config.output.publicPath = (_c.host || 'http://localhost:3000') + '/bin/'

var WebpackNotifierPlugin = require('webpack-notifier')

config.plugins=[
	new webpack.IgnorePlugin(/jquery/),
	new WebpackNotifierPlugin()
]

module.exports=config
process.traceDeprecation=true
