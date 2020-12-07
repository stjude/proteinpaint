import pkg from './package.json'
import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import commonjs from '@rollup/plugin-commonjs'
//import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss'

const production = !process.env.ROLLUP_WATCH

export default [
	// browser-friendly UMD build
	/*{
		input: 'index.js',
		output: {
			name: 'runproteinpaint',
			file: pkg.browser,
			format: 'umd',
			inlineDynamicImports : true
		},
		plugins: [
			resolve(),
			commonjs({
				include: /node_modules/,
				extensions: ['.js'],
				namedExports: {
					'../../node_modules/debounce/index.js': ['debounce'],
					//'../../node_modules/d3-beeswarm/index.js': ['beeswarm']
				}
			}),
			postcss({plugins: []}), 
			//production && terser()
		]
	},*/

	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// an array for the `output` option, where we can specify
	// `file` and `format` for each target)
	{
		input: 'index.js',
		output: [
			//{ file: pkg.main, format: 'cjs' },
			//{ file: pkg.module, format: 'es' }
			{ dir: 'public/bin', format: 'es' }
		],
		plugins: [
			resolve({
				browser: true,
				//jsnext: true,
				//main: true,
				preferBuiltins: false
			}),

			babel({
				babelHelpers: 'bundled'
			}),

			commonjs({
				extensions: ['.js'],
				//include: ['node_modules/**'],
				namedExports: {
					'../../node_modules/debounce/index.js': ['debounce']
				}
			}),

			postcss({ plugins: [] })
		]
	}
]
