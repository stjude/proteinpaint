import pkg from './package.json'
import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
//import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss'

const production = !process.env.ROLLUP_WATCH

function onwarn(message, warn) {
	if (message.code === 'CIRCULAR_DEPENDENCY') return
	warn(message)
}

export default [
	{
		input: '../../src/app.js',
		// input: './index.jsx',
		output: [{ dir: 'dist', format: 'es' }],
		plugins: [
			resolve({
				//browser: true,
				jsnext: true,
				main: true
				//preferBuiltins: true,
				//moduleDirectories: ['./node_modules', '../../node_modules']
			}),
			/*
			babel({
				babelHelpers: 'bundled'
			}),
*/
			commonjs({
				extensions: ['.js']
			}),

			postcss()
		],
		onwarn
	}
]
