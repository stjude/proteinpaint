const nodeExternals = require('webpack-node-externals')
const webpack=require('webpack')

module.exports={
	target:'node',
	externals: [nodeExternals()],
	entry:'./app.js',
	output:{
		path: __dirname,
		filename:'server.js',
	},
}
