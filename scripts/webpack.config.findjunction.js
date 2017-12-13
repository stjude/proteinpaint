const webpack=require('webpack')

module.exports={
	entry:'./utils/findjunctionwithsnv/source.js',
	target:'node',
	output:{
		path:'./utils/findjunctionwithsnv/',
		filename:'bin.js',
	},
}
