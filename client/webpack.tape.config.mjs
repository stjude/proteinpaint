import NodePolyfillPlugin from 'node-polyfill-webpack-plugin'
import path from 'path'
import fs from 'fs'
import webpack from 'webpack'

// TODO: 
// use a good esbuild node polyfill plugin to avoid having to use webpack,
// to bundle and supplies tape lib with missing node libs

const __dirname = import.meta.dirname

let babelrc = fs.readFileSync(path.join(__dirname, '.babelrc'))
babelrc = JSON.parse(babelrc)

export default {
	mode: 'development',
	devtool: 'source-map',
	target: 'web',

	entry: path.join(__dirname, './test/tape.js'),

	output: {
		path: path.join(__dirname, './test'),
		publicPath: '/bin/bin/test',
		filename: 'tape.bundle.js',
		chunkLoading: 'import',
		chunkFormat: 'module',
		//chunkLoadingGlobal: 'ppJsonp',
		library: {
      type: "module",
    },
	},
	
	experiments: {
    outputModule: true,
  },

	plugins: [
		new NodePolyfillPlugin()
	],

	module: {
		strictExportPresence: true,
		rules: [
			{
				test: /\.(js|ts)$/,
				//exclude: /\.spec.js$/,
				use: [
					{
						loader: 'babel-loader',
						options: babelrc
					}
				]
			}
		]
	}
}
