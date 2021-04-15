import pkg from './package.json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'
import { terser } from 'rollup-plugin-terser'

const production = !process.env.ROLLUP_WATCH

function onwarn(message, warn) {
	if (message.code === 'CIRCULAR_DEPENDENCY') return
	warn(message)
}

export default [
	{
		input: './src/app.js',
		output: { dir: 'dist', format: 'es' },
		external: [...Object.keys(pkg.peerDependencies ? pkg.peerDependencies : {})],
		plugins: [
			resolve({
				main: true
			}),
			commonjs({
				extensions: ['.js']
			}),
			postcss()
			//production && terser()
		],
		onwarn
	}
]
