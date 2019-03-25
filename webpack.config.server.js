const nodeExternals = require('webpack-node-externals')
const webpack=require('webpack')

module.exports=function(env){
	return {
		mode: env.NODE_ENV ? env.NODE_ENV : 'production',
		target:'node',
		externals: [nodeExternals()],
		entry:'./app.js',
		output:{
			path: __dirname,
			filename:'server.js',
		},
	}
}
