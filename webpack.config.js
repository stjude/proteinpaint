const webpack=require('webpack')
const path = require('path')

module.exports={
	entry:'./src/app.js',
	output:{
		path: __dirname+'/public/bin',
		filename:'proteinpaint.js',
		publicPath:'/bin/',
		jsonpFunction: 'ppJsonp'
	},
	module:{
		rules:[
		/*
		{
			test:/\.js$/,
			exclude:/node_modules/,
			loader:'babel-loader',
		},
		*/
		{
			test:/\.css$/,
			use: [{
				loader: "style-loader"
			},{
				loader: "css-loader"
			}]
		},

		{
			test: /\.js$/,
			use: [{
				loader: 'babel-loader',
				options: { presets: [['es2015', {modules: false}]], plugins: ['syntax-dynamic-import'] }
			}]
		}
		]
	},
	devtool:'source-map',

		
	plugins:[
		new webpack.IgnorePlugin(/jquery/),
	]
}
