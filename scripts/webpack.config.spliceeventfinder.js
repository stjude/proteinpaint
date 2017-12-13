const webpack=require('webpack')

module.exports={
	entry:'./utils/findspliceevent/source.js',
	target:'node',
	output:{
		path:'/home/xzhou/node/es6/utils/findspliceevent/',
		filename:'bin.js',
	},
}
