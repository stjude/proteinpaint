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
		// generated for esbuild.config.mjs nodeLibToBrowser() polyfilled
		// replacement for tape lib in headless browser environment
		filename: 'tape.bundle.js',
		chunkLoading: 'import',
		chunkFormat: 'module',
		//chunkLoadingGlobal: 'ppJsonp',
		library: {
			type: 'module'
		}
	},

	experiments: {
		outputModule: true
	},

	// explicit, scoped polyfills only for what tape's bundle actually needs -- verified
	// by removing node-polyfill-webpack-plugin's blanket polyfilling entirely: webpack's
	// module resolution needed path/stream (added below), and a live-browser load of the
	// bundle additionally caught a runtime-only "process is not defined" (a bare global
	// reference, which resolve.fallback doesn't cover -- it needs its own global binding)
	plugins: [
		new webpack.ProvidePlugin({
			process: 'process/browser'
		})
	],

	resolve: {
		fallback: {
			path: 'path-browserify',
			stream: 'stream-browserify'
		}
	},

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
