const webpack=require('webpack')

// used by edgar, the sqlite server is not used
// so this will not support POSTs or any server requests
// that are handled by the proteinpaint node server

const config={
	entry:'./src/app.hm2.js',
	output:{
		path:'./public/bin',
		filename:'proteinpaint.hm2-prod.js',
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
	new webpack.optimize.UglifyJsPlugin({
      mangle: true,
      compress: {
        warnings: false
      }
    }),
    new webpack.optimize.OccurenceOrderPlugin()

]

module.exports=config
