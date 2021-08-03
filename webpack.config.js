/*
	Cannot use `npm run dev --workspaces` using
	'&' at the end of each workspace's dev script,
	since those processes end up running in the background
	even with control^C
*/

const wpServer = require('./server/webpack.config.js')
const wpClient = require('./client/webpack.config.js')

function modClient(env) {
	const config = wpClient(env)
	// when exporting multiple configs,
	// babel-loader and/or webpack does not seem to
	// apply .babelrc to each config in the array
	// so need to repeat this options here, for now
	config.module.rules[1].use[0].options = {
		presets: [
			[
				'@babel/preset-env',
				{
					modules: 'umd'
				}
			],
			'@babel/preset-react'
		],
		plugins: [
			'@babel/plugin-proposal-optional-chaining',
			'@babel/plugin-proposal-export-namespace-from',
			'@babel/plugin-syntax-dynamic-import',
			'@babel/plugin-transform-runtime'
		]
	}
	return config
}

module.exports = [wpServer, modClient]
process.traceDeprecation = true
