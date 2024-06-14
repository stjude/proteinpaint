import pkg from './package.json'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import postcss from 'rollup-plugin-postcss'
import postcssImport from 'postcss-import'
import terser from '@rollup/plugin-terser'
import json from '@rollup/plugin-json'
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars'
import typescript from '@rollup/plugin-typescript'
import path from 'path'

// TODO: uninstall rollup, once esbuild migration is fully tested and unlikely to be reverted

const production = !process.env.ROLLUP_WATCH && process.env.NODE_ENV !== 'dev'

function onwarn(message, warn) {
	if (message.code === 'CIRCULAR_DEPENDENCY') return
	warn(message)
}

export default [
	{
		input: path.join(__dirname, './src/app.js'),
		output: {
			dir: path.join(__dirname, 'dist'),
			format: 'es'
		},
		external: [...Object.keys(pkg.peerDependencies ? pkg.peerDependencies : {})],
		plugins: [
			ignoreTestInternals(),
			resolve({
				main: true,
				//preferBuiltins: false,
				extensions: ['.js', '.ts']
			}),
			json(),
			commonjs({
				// ts files are expected to use esm only
				extensions: ['.js']
			}),
			postcss({
				plugins: [postcssImport()]
			}),
			typescript({
				filterRoot: '../'
			}),
			dynamicImportVars(),
			// for GDC webpack 3 use case: do not use terser by running
			// `cd client && rm -rf dist && NODE_ENV=dev npx rollup -c ./rollup.config.js`
			production && terser({ compress: false })
		],
		onwarn
	}
]

function ignoreTestInternals() {
	return {
		name: 'ignoreTestInternals',
		resolveId(id) {
			return id.includes('/test/internals') ? id : null
		},
		load(id) {
			return id.includes('/test/internals') ? '' : null
		}
	}
}
