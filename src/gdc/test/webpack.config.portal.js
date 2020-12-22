const fs = require('fs')
const path = require('path')
const MODULE_DIR = /(.*([\/\\]node_modules|\.\.)[\/\\](@[^\/\\]+[\/\\])?[^\/\\]+)([\/\\].*)?$/g

module.exports = env => {
	return {
		target: 'web',
		mode: 'development',
		// may call `npm run dev -- --env=noreact`
		entry: env == 'noreact' ? './noreact.js' : './index.js',
		output: {
			path: __dirname + '/public/bin/',
			filename: 'portal.js',
			publicPath: '/portal/bin/',
			jsonpFunction: 'ppJsonp',
			libraryTarget: 'umd',
			library: 'AReactApp'
		},
		module: {
			rules: [
				{
					test: /\.css$/,
					use: [
						{
							loader: 'style-loader'
						},
						{
							loader: 'css-loader'
						}
					]
				},

				{
					test: /.(js|jsx)$/,
					use: [
						{
							loader: 'babel-loader'
						}
					]
					/*include(filepath) {
						if (filepath.split(/[/\\]/).indexOf('node_modules')===-1) return true;
						let pkg, manifest = path.resolve(filepath.replace(MODULE_DIR, '$1'), 'package.json');
						try { pkg = JSON.parse(fs.readFileSync(manifest)); } catch (e) {}
						return !!(pkg.module || pkg['jsnext:main']);
					}*/
				}
			]
		},
		devtool: 'source-map'
	}
}
