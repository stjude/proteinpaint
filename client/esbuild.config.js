const path = require('path')
const { build } = require('esbuild')

build({
	entryPoints: ['./src/app.js'],
	bundle: true,
	platform: 'browser',
	outdir: path.join(__dirname, './dist'),
	//chunkNames: '[hash].app',
	sourcemap: true,
	splitting: true,
	format: 'esm',
	external: ['*.spec.js']
	//target: 'node12',
	//external: Object.keys(require('../package.json').dependencies),
})
