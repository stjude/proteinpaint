const nodeExternals = require('webpack-node-externals')
const webpack=require('webpack')

module.exports={
	target:'node',
	externals: [nodeExternals()],
	entry:'./server.js',
	output:{
		path: __dirname,
		filename:'server.min.js',
	},
}
